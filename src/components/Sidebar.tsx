import React, { useState } from 'react';
import {
  Plus,
  Search,
  BookOpen,
  Trash2,
  LogOut,
  Tag,
  Sparkles,
  Shield,
  Calendar,
  X,
  Smile,
  Frown,
  Meh,
  Sun,
  Flame,
  Coffee,
  CheckCircle
} from 'lucide-react';
import { JournalEntry, UserProfile } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import { LanguageSelector } from './LanguageSelector';

interface SidebarProps {
  entries: JournalEntry[];
  selectedEntryId: string | null;
  onSelectEntry: (id: string) => void;
  onNewEntry: () => void;
  onDeleteEntry: (id: string, e: React.MouseEvent) => void;
  user: UserProfile;
  onSignOut: () => void;
  isOpen: boolean;
  onClose: () => void;
  syncStatus: 'synced' | 'saving' | 'error';
}

export const Sidebar: React.FC<SidebarProps> = ({
  entries,
  selectedEntryId,
  onSelectEntry,
  onNewEntry,
  onDeleteEntry,
  user,
  onSignOut,
  isOpen,
  onClose,
  syncStatus,
}) => {
  const { t, locale } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Extract unique tags
  const allTags = Array.from(
    new Set(entries.flatMap((entry) => entry.tags || []))
  );

  // Filter entries
  const filteredEntries = entries.filter((entry) => {
    const matchesSearch =
      entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.messages.some((m) =>
        m.content.toLowerCase().includes(searchQuery.toLowerCase())
      );
    const matchesTag = selectedTag ? entry.tags?.includes(selectedTag) : true;
    return matchesSearch && matchesTag;
  });

  const getMoodIcon = (mood?: string) => {
    switch (mood) {
      case 'calm':
        return <Sun className="w-3.5 h-3.5 text-[#5B7553]" />;
      case 'inspired':
        return <Flame className="w-3.5 h-3.5 text-[#B86B35]" />;
      case 'grateful':
        return <Smile className="w-3.5 h-3.5 text-[#4E6E45]" />;
      case 'reflective':
        return <Sparkles className="w-3.5 h-3.5 text-[#735D78]" />;
      case 'anxious':
        return <Frown className="w-3.5 h-3.5 text-[#A25A4B]" />;
      case 'tired':
        return <Coffee className="w-3.5 h-3.5 text-[#7A7368]" />;
      default:
        return <Meh className="w-3.5 h-3.5 text-[#7A7368]" />;
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    const dateLocale = locale === 'zh-TW' ? 'zh-TW' : 'en-US';
    if (isToday) {
      return date.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString(dateLocale, { month: 'short', day: 'numeric' });
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-[#2B2926]/40 z-30 xl:hidden backdrop-blur-xs"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed xl:static inset-y-0 left-0 z-40 w-80 max-w-[85vw] h-screen h-[100dvh] max-h-[100dvh] bg-[#F4EFEA] border-r border-[#E5DDD3] flex flex-col justify-between transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full xl:translate-x-0'
        }`}
      >
        {/* Header & New Entry */}
        <div className="p-4 landscape:max-lg:p-2 landscape:max-lg:pb-1.5 border-b border-[#E5DDD3] flex-none">
          <div className="flex items-center justify-between mb-4 landscape:max-lg:mb-1.5">
            <div className="flex items-center gap-2.5 landscape:max-lg:gap-2">
              <div className="w-8 h-8 landscape:max-lg:w-6 landscape:max-lg:h-6 rounded-xl landscape:max-lg:rounded-lg bg-[#404835] text-[#DCE7D0] flex items-center justify-center font-serif font-bold text-sm landscape:max-lg:text-xs shadow-2xs">
                R
              </div>
              <div>
                <h2 className="font-serif font-bold text-[#2B2926] leading-tight landscape:max-lg:text-xs">{t('appName')}</h2>
                <div className="flex items-center gap-1 text-[11px] landscape:max-lg:text-[10px] text-[#554E45]">
                  <Shield className="w-3 h-3 landscape:max-lg:w-2.5 landscape:max-lg:h-2.5 text-[#4D5A3F]" />
                  <span>{t('isolatedPathActive')}</span>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="xl:hidden p-1.5 landscape:max-lg:p-1 text-[#7A746B] hover:text-[#2B2926] rounded-md"
            >
              <X className="w-5 h-5 landscape:max-lg:w-4 landscape:max-lg:h-4" />
            </button>
          </div>

          <button
            id="sidebar-new-entry-btn"
            onClick={() => {
              onNewEntry();
              if (window.innerWidth < 1280) onClose();
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 landscape:max-lg:py-1.5 px-4 landscape:max-lg:px-2.5 bg-[#404835] hover:bg-[#32392A] text-[#FAF8F5] rounded-xl landscape:max-lg:rounded-lg text-sm landscape:max-lg:text-xs font-medium shadow-2xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 landscape:max-lg:w-3.5 landscape:max-lg:h-3.5" />
            <span>{t('newReflection')}</span>
          </button>
        </div>

        {/* Search & Tags */}
        <div className="p-3 landscape:max-lg:p-1.5 border-b border-[#E5DDD3] space-y-2.5 landscape:max-lg:space-y-1 bg-[#EFE9E2]/60 flex-none">
          <div className="relative">
            <Search className="w-4 h-4 landscape:max-lg:w-3.5 landscape:max-lg:h-3.5 absolute left-3 landscape:max-lg:left-2 top-1/2 -translate-y-1/2 text-[#9A9287]" />
            <input
              id="sidebar-search-input"
              type="text"
              placeholder={t('searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 landscape:max-lg:pl-7 pr-3 landscape:max-lg:pr-2.5 py-1.5 landscape:max-lg:py-0.5 bg-white border border-[#DDD5C8] rounded-xl landscape:max-lg:rounded-lg text-xs landscape:max-lg:text-[11px] text-[#2B2926] placeholder:text-[#9A9287] focus:outline-hidden focus:ring-1 focus:ring-[#535C45]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 landscape:max-lg:right-2 top-1/2 -translate-y-1/2 text-[#9A9287] hover:text-[#33312E] text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {allTags.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 landscape:max-lg:pb-0.5 no-scrollbar text-xs">
              <button
                onClick={() => setSelectedTag(null)}
                className={`px-2 py-0.5 rounded-lg text-[11px] landscape:max-lg:text-[10px] whitespace-nowrap font-medium transition-colors cursor-pointer ${
                  selectedTag === null
                    ? 'bg-[#404835] text-[#FAF8F5]'
                    : 'bg-white text-[#665F55] hover:bg-[#E5DDD2] border border-[#DDD5C8]'
                }`}
              >
                {t('allFilter')} ({entries.length})
              </button>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                  className={`px-2 py-0.5 rounded-lg text-[11px] landscape:max-lg:text-[10px] whitespace-nowrap font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                    selectedTag === tag
                      ? 'bg-[#404835] text-[#FAF8F5]'
                      : 'bg-white text-[#665F55] hover:bg-[#E5DDD2] border border-[#DDD5C8]'
                  }`}
                >
                  <Tag className="w-2.5 h-2.5" />
                  <span>{tag}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Entry List */}
        <div className="flex-1 min-h-0 overflow-y-auto p-2.5 landscape:max-lg:p-1.5 space-y-1.5 landscape:max-lg:space-y-1 overscroll-contain">
          {filteredEntries.length === 0 ? (
            <div className="p-6 landscape:max-lg:p-3 text-center text-xs text-[#7A746B] flex flex-col items-center justify-center h-48 landscape:max-lg:h-28">
              <BookOpen className="w-8 h-8 landscape:max-lg:w-5 landscape:max-lg:h-5 text-[#C4BCB0] mb-2 landscape:max-lg:mb-1" />
              <p className="font-medium text-[#4A433A]">{t('noReflectionsFound')}</p>
              <p className="mt-1 text-[#9A9287]">
                {searchQuery || selectedTag
                  ? t('noReflectionsSub')
                  : t('noReflectionsStart')}
              </p>
            </div>
          ) : (
            filteredEntries.map((entry) => {
              const isSelected = entry.id === selectedEntryId;
              const lastMessage = entry.messages[entry.messages.length - 1];
              const snippet = lastMessage?.content || t('emptyEntrySnippet');

              return (
                <div
                  key={entry.id}
                  id={`entry-item-${entry.id}`}
                  onClick={() => {
                    onSelectEntry(entry.id);
                    if (window.innerWidth < 1280) onClose();
                  }}
                  className={`group relative p-3 landscape:max-lg:p-2 rounded-xl landscape:max-lg:rounded-lg cursor-pointer transition-all border ${
                    isSelected
                      ? 'bg-white border-[#D2C7B8] shadow-2xs ring-1 ring-[#404835]/15'
                      : 'border-transparent hover:bg-[#EAE4DC] text-[#443E36]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {getMoodIcon(entry.mood)}
                      <h4 className="font-medium text-sm landscape:max-lg:text-xs text-[#2B2926] truncate">
                        {entry.title || t('untitledReflection')}
                      </h4>
                    </div>
                    <span className="text-[11px] landscape:max-lg:text-[10px] text-[#9A9287] shrink-0 font-mono">
                      {formatDate(entry.updatedAt || entry.createdAt)}
                    </span>
                  </div>

                  <p className="mt-1 landscape:max-lg:mt-0.5 text-xs landscape:max-lg:text-[11px] text-[#6B655B] line-clamp-2 landscape:max-lg:line-clamp-1 leading-relaxed">
                    {snippet}
                  </p>

                  <div className="mt-2.5 landscape:max-lg:mt-1 flex items-center justify-between text-[11px] landscape:max-lg:text-[10px] text-[#8E877C]">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-[#A86B35]" />
                        <span>{entry.messages.length} {t('turnsCount')}</span>
                      </span>
                      {entry.tags?.slice(0, 2).map((t) => (
                        <span
                          key={t}
                          className="px-1.5 py-0.2 bg-[#EFEAE2] text-[#554E44] rounded text-[10px] border border-[#DDD5C8]"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>

                    <button
                      title={t('deleteReflectionTooltip')}
                      onClick={(e) => onDeleteEntry(entry.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-[#9A9287] hover:text-[#9C3826] hover:bg-[#FCF0EC] rounded transition-all cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Sync & User Footer */}
        <div className="p-3 landscape:max-lg:p-1.5 border-t border-[#E5DDD3] bg-[#EFE9E2] space-y-2.5 landscape:max-lg:space-y-1 flex-none">
          {/* Language selector in signed-in sidebar */}
          <div>
            <LanguageSelector id="sidebar-language-selector" variant="sidebar" />
          </div>

          {/* Sync status indicator */}
          <div className="flex items-center justify-between px-2.5 py-1.5 landscape:max-lg:px-2 landscape:max-lg:py-0.5 bg-[#FAF8F5] border border-[#E5DDD3] rounded-xl landscape:max-lg:rounded-lg text-[11px] landscape:max-lg:text-[10px] text-[#554E44]">
            <div className="flex items-center gap-1.5">
              {syncStatus === 'saving' ? (
                <div className="w-2 h-2 rounded-full bg-[#B86B35] animate-ping" />
              ) : syncStatus === 'error' ? (
                <div className="w-2 h-2 rounded-full bg-[#B8472B]" />
              ) : (
                <CheckCircle className="w-3.5 h-3.5 text-[#4D5A3F]" />
              )}
              <span className="font-medium">
                {syncStatus === 'saving'
                  ? t('savingToFirestore')
                  : syncStatus === 'error'
                  ? t('syncError')
                  : t('firestoreSynchronized')}
              </span>
            </div>
            <span className="font-mono text-[10px] landscape:max-lg:text-[9px] text-[#8E877C]">
              {entries.length} {entries.length === 1 ? t('docsCountSingle') : t('docsCountPlural')}
            </span>
          </div>

          {/* User profile */}
          <div className="flex items-center justify-between gap-2 pt-0.5 landscape:max-lg:pt-0">
            <div className="flex items-center gap-2 min-w-0">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  className="w-8 h-8 landscape:max-lg:w-6 landscape:max-lg:h-6 rounded-full border border-[#D5CCC0] object-cover shrink-0"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-8 h-8 landscape:max-lg:w-6 landscape:max-lg:h-6 rounded-full bg-[#404835] text-[#FAF8F5] flex items-center justify-center text-xs landscape:max-lg:text-[10px] font-semibold shrink-0">
                  {user.displayName?.charAt(0) || user.email?.charAt(0) || 'U'}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs landscape:max-lg:text-[11px] font-semibold text-[#2B2926] truncate leading-tight">
                  {user.displayName}
                </p>
                <p className="text-[11px] landscape:max-lg:text-[9px] text-[#7A746B] truncate leading-tight" title={user.email || ''}>
                  {user.email}
                </p>
              </div>
            </div>

            <button
              id="sidebar-signout-btn"
              onClick={onSignOut}
              title={t('signOut')}
              className="p-1.5 landscape:max-lg:p-1 text-[#7A746B] hover:text-[#2B2926] hover:bg-[#E2DAD0] rounded-xl landscape:max-lg:rounded-lg transition-colors cursor-pointer shrink-0"
            >
              <LogOut className="w-4 h-4 landscape:max-lg:w-3.5 landscape:max-lg:h-3.5" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
