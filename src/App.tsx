import React, { useState, useEffect, useCallback } from 'react';
import { UserProfile, JournalEntry, SafetyRegion } from './types';
import {
  subscribeToAuth,
  subscribeToUserEntries,
  saveUserEntry,
  deleteUserEntry,
  logOut
} from './lib/firebase';
import { getSafetyPreferences } from './lib/firebase';
import { LandingPage } from './components/LandingPage';
import { Sidebar } from './components/Sidebar';
import { JournalEditor } from './components/JournalEditor';
import { AdminDashboard } from './components/AdminDashboard';
import { NotificationSettings } from './components/NotificationSettings';
import { SafetySettings } from './components/SafetySettings';
import { Bell, HeartHandshake, ShieldCheck, Sparkles } from 'lucide-react';
import { LanguageProvider, useLanguage } from './i18n/LanguageContext';

function AppContent() {
  const { t } = useLanguage();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'saving' | 'error'>('synced');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  const [showSafetySettings, setShowSafetySettings] = useState(false);
  const [safetyRegion, setSafetyRegion] = useState<SafetyRegion>('GLOBAL');

  // Subscribe to Firebase Auth state
  useEffect(() => {
    const unsubscribe = subscribeToAuth((currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setSafetyRegion('GLOBAL');
      return;
    }
    void getSafetyPreferences(user.uid)
      .then((preferences) => setSafetyRegion(preferences.countryCode))
      .catch(() => setSafetyRegion('GLOBAL'));
  }, [user]);

  // Subscribe to user Firestore entries
  useEffect(() => {
    if (!user) {
      setEntries([]);
      setSelectedEntryId(null);
      return;
    }

    const unsubscribe = subscribeToUserEntries(
      user.uid,
      (fetchedEntries) => {
        setEntries(fetchedEntries);
        setSyncStatus('synced');
        setSaveError(null);

        // Auto-select latest if none selected or if selected was deleted
        setSelectedEntryId((prevId) => {
          if (prevId && fetchedEntries.some((e) => e.id === prevId)) {
            return prevId;
          }
          return fetchedEntries.length > 0 ? fetchedEntries[0].id : null;
        });
      },
      (err) => {
        console.error('Failed to subscribe to user entries:', err);
        setSyncStatus('error');
        setSaveError(t('firestoreConnectionError'));
      }
    );

    return () => unsubscribe();
  }, [user, t]);

  // Create new journal entry
  const handleNewEntry = useCallback(async () => {
    if (!user) return;

    const newId = 'entry-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
    const newEntry: JournalEntry = {
      id: newId,
      userId: user.uid,
      title: 'New Reflection',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tags: ['reflection'],
      mood: 'reflective',
      messages: [],
      wordCount: 0,
    };

    setSyncStatus('saving');
    try {
      await saveUserEntry(newEntry);
      setSelectedEntryId(newId);
      setSyncStatus('synced');
      setSaveError(null);
    } catch (err: any) {
      console.error('Error creating entry:', err);
      setSyncStatus('error');
      setSaveError(t('failedToCreateEntry') + (err?.message || ''));
    }
  }, [user, t]);

  // Save/Update entry in Firestore
  const handleUpdateEntry = async (updated: JournalEntry) => {
    if (!user) return;

    // Optimistic UI update
    setEntries((prev) =>
      prev.map((e) => (e.id === updated.id ? updated : e))
    );
    setSyncStatus('saving');

    try {
      await saveUserEntry(updated);
      setSyncStatus('synced');
      setSaveError(null);
    } catch (err: any) {
      console.error('Error saving entry:', err);
      setSyncStatus('error');
      setSaveError(t('failedToSaveEntry'));
    }
  };

  // Delete entry
  const handleDeleteEntry = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!user) return;

    setDeleteConfirmId(id);
  };

  const confirmDelete = async () => {
    if (!user || !deleteConfirmId) return;
    try {
      await deleteUserEntry(user.uid, deleteConfirmId);
      setDeleteConfirmId(null);
      if (selectedEntryId === deleteConfirmId) {
        const remaining = entries.filter((e) => e.id !== deleteConfirmId);
        setSelectedEntryId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (err: any) {
      console.error('Error deleting entry:', err);
      setSaveError(t('failedToDeleteEntry') + err.message);
    }
  };

  const handleSignOut = async () => {
    try {
      await logOut();
      setUser(null);
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  // Initial loading spinner
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#404835] text-[#DCE7D0] flex items-center justify-center animate-pulse shadow-2xs">
            <Sparkles className="w-5 h-5" />
          </div>
          <p className="text-xs font-medium text-[#7A746B]">{t('verifyingAuth')}</p>
        </div>
      </div>
    );
  }

  // If not signed in, show Landing Page
  if (!user) {
    return <LandingPage onAuthSuccess={() => {}} />;
  }

  const selectedEntry = entries.find((e) => e.id === selectedEntryId) || null;

  return (
    <div className="flex h-screen w-screen bg-[#F0EBE1] overflow-hidden font-sans">
      {/* Sidebar for navigation, history & user profile */}
      <Sidebar
        entries={entries}
        selectedEntryId={selectedEntryId}
        onSelectEntry={(id) => setSelectedEntryId(id)}
        onNewEntry={handleNewEntry}
        onDeleteEntry={handleDeleteEntry}
        user={user}
        onSignOut={handleSignOut}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        syncStatus={syncStatus}
      />

      {/* Main Workspace Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {selectedEntry ? (
          <JournalEditor
            key={selectedEntry.id}
            entry={selectedEntry}
            onUpdateEntry={handleUpdateEntry}
            onDeleteEntry={(id) => handleDeleteEntry(id)}
            onOpenSidebar={() => setSidebarOpen(true)}
            isSaving={syncStatus === 'saving'}
            saveError={saveError}
            onRetrySave={() => {
              if (selectedEntry) handleUpdateEntry(selectedEntry);
            }}
            supportCountry={safetyRegion}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-[#FAF8F5]">
            <div className="w-16 h-16 rounded-2xl bg-[#EBF0E5] text-[#404835] flex items-center justify-center mb-4 shadow-2xs">
              <Sparkles className="w-8 h-8 text-[#404835]" />
            </div>
            <h2 className="font-serif font-bold text-2xl text-[#2B2926]">{t('emptySpaceTitle')}</h2>
            <p className="mt-2 text-sm text-[#6B655B] max-w-sm">
              {t('emptySpaceDesc')}
            </p>
            <button
              id="empty-state-new-entry-btn"
              onClick={handleNewEntry}
              className="mt-6 px-6 py-2.5 bg-[#404835] hover:bg-[#32392A] text-[#FAF8F5] rounded-xl text-sm font-medium shadow-2xs transition-colors cursor-pointer"
            >
              {t('startFirstReflection')}
            </button>
          </div>
        )}
      </main>

      <div className="fixed right-4 top-4 z-40 flex gap-2">
        {(user.role === 'admin' || user.role === 'owner') && (
          <button
            onClick={() => setShowAdminDashboard(true)}
            className="rounded-xl border border-[#D8D1C7] bg-[#FAF8F5] p-2.5 text-[#404835] shadow-sm hover:bg-[#EBF0E5]"
            aria-label="Open administration overview"
            title="Administration"
          >
            <ShieldCheck className="h-5 w-5" />
          </button>
        )}
        <button
          onClick={() => setShowNotificationSettings(true)}
          className="rounded-xl border border-[#D8D1C7] bg-[#FAF8F5] p-2.5 text-[#404835] shadow-sm hover:bg-[#EBF0E5]"
          aria-label="Open notification settings"
          title="Notifications"
        >
          <Bell className="h-5 w-5" />
        </button>
        <button
          onClick={() => setShowSafetySettings(true)}
          className="rounded-xl border border-[#D8D1C7] bg-[#FAF8F5] p-2.5 text-[#404835] shadow-sm hover:bg-[#EBF0E5]"
          aria-label="Open safety-resource settings"
          title="Safety resources"
        >
          <HeartHandshake className="h-5 w-5" />
        </button>
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-[#2B2926]/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl border border-[#E5DDD3]">
            <h3 className="font-serif font-bold text-lg text-[#2B2926]">{t('deleteConfirmTitle')}</h3>
            <p className="mt-2 text-xs text-[#6B655B] leading-relaxed">
              {t('deleteConfirmDesc')}
            </p>
            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 text-xs font-medium text-[#6B655B] hover:bg-[#EFEAE2] rounded-xl transition-colors cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                id="confirm-delete-entry-btn"
                onClick={confirmDelete}
                className="px-4 py-2 text-xs font-semibold bg-[#A83823] hover:bg-[#912F1C] text-white rounded-xl shadow-2xs transition-colors cursor-pointer"
              >
                {t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}
      {showNotificationSettings && <NotificationSettings user={user} onClose={() => setShowNotificationSettings(false)} />}
      {showAdminDashboard && (user.role === 'admin' || user.role === 'owner') && (
        <AdminDashboard user={user} onClose={() => setShowAdminDashboard(false)} />
      )}
      {showSafetySettings && (
        <SafetySettings user={user} value={safetyRegion} onChange={setSafetyRegion} onClose={() => setShowSafetySettings(false)} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}
