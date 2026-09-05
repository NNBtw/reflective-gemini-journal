import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  Firestore
} from 'firebase/firestore';
import firebaseConfigJson from '../../firebase-applet-config.json';
import { AccessRole, JournalEntry, NotificationPreferences, SafetyPreferences, UserProfile } from '../types';

const firebaseConfig = {
  apiKey: firebaseConfigJson.apiKey,
  authDomain: firebaseConfigJson.authDomain,
  projectId: firebaseConfigJson.projectId,
  storageBucket: firebaseConfigJson.storageBucket,
  messagingSenderId: firebaseConfigJson.messagingSenderId,
  appId: firebaseConfigJson.appId,
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// App Check activates after a reCAPTCHA Enterprise site key is configured.
// Enforcement is enabled separately in Firebase Console after metrics are reviewed.
const appCheckSiteKey = firebaseConfigJson.recaptchaSiteKey;
const appCheckState = globalThis as typeof globalThis & { __reflectAiAppCheckInitialized?: boolean };
if (typeof window !== 'undefined' && appCheckSiteKey && !appCheckState.__reflectAiAppCheckInitialized) {
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
  appCheckState.__reflectAiAppCheckInitialized = true;
}

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Initialize Firestore with specific databaseId if provided
export const db: Firestore = (firebaseConfigJson.firestoreDatabaseId && firebaseConfigJson.firestoreDatabaseId !== '(default)')
  ? getFirestore(app, firebaseConfigJson.firestoreDatabaseId)
  : getFirestore(app);

/**
 * Strict Undefined-Stripping payload sanitizer for Firestore integrity
 */
export function sanitizePayload<T>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj, (_key, value) => (value === undefined ? null : value))
  );
}

export async function signInWithGoogle(): Promise<UserProfile> {
  const result = await signInWithPopup(auth, googleProvider);
  const user = result.user;
  const tokenResult = await user.getIdTokenResult();
  const role: AccessRole = tokenResult.claims.role === 'owner' || tokenResult.claims.role === 'admin'
    ? tokenResult.claims.role
    : 'user';
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName || user.email?.split('@')[0] || 'User',
    photoURL: user.photoURL,
    role,
  };
}

export async function logOut(): Promise<void> {
  await signOut(auth);
}

export function subscribeToAuth(callback: (user: UserProfile | null) => void) {
  return onAuthStateChanged(auth, (user: User | null) => {
    if (user) {
      void user.getIdTokenResult().then((tokenResult) => {
        const role: AccessRole = tokenResult.claims.role === 'owner' || tokenResult.claims.role === 'admin'
          ? tokenResult.claims.role
          : 'user';
        callback({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || user.email?.split('@')[0] || 'User',
          photoURL: user.photoURL,
          role,
        });
      }).catch(() => callback(null));
    } else {
      callback(null);
    }
  });
}

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  enabled: false,
  email: false,
  slack: false,
  discord: false,
  eventTypes: ['summary_ready', 'manual_test'],
  consentVersion: '2026-09-04',
  updatedAt: 0,
};

export async function getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  const snapshot = await getDoc(doc(db, 'users', userId, 'preferences', 'notifications'));
  if (!snapshot.exists()) return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  return snapshot.data() as NotificationPreferences;
}

export async function saveNotificationPreferences(userId: string, preferences: NotificationPreferences): Promise<void> {
  await setDoc(doc(db, 'users', userId, 'preferences', 'notifications'), sanitizePayload({
    ...preferences,
    consentVersion: '2026-09-04',
    updatedAt: Date.now(),
  }));
}

export async function getSafetyPreferences(userId: string): Promise<SafetyPreferences> {
  const snapshot = await getDoc(doc(db, 'users', userId, 'preferences', 'safety'));
  if (!snapshot.exists()) return { countryCode: 'GLOBAL', updatedAt: 0 };
  return snapshot.data() as SafetyPreferences;
}

export async function saveSafetyPreferences(userId: string, countryCode: SafetyPreferences['countryCode']): Promise<void> {
  await setDoc(doc(db, 'users', userId, 'preferences', 'safety'), {
    countryCode,
    updatedAt: Date.now(),
  });
}

/**
 * Isolated User Path: /users/{userId}/entries/{entryId}
 */
export function getUserEntriesCollection(userId: string) {
  return collection(db, 'users', userId, 'entries');
}

export function getUserEntryDoc(userId: string, entryId: string) {
  return doc(db, 'users', userId, 'entries', entryId);
}

export function subscribeToUserEntries(
  userId: string,
  callback: (entries: JournalEntry[]) => void,
  onError?: (error: Error) => void
) {
  const q = query(getUserEntriesCollection(userId), orderBy('updatedAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const entries: JournalEntry[] = [];
      snapshot.forEach((d) => {
        entries.push(d.data() as JournalEntry);
      });
      callback(entries);
    },
    (err) => {
      console.error('Firestore subscription error:', err);
      if (onError) onError(err);
    }
  );
}

export async function saveUserEntry(entry: JournalEntry): Promise<void> {
  if (!entry.userId || !entry.id) {
    throw new Error('Invalid entry: missing userId or id');
  }
  const cleanData = sanitizePayload(entry);
  const docRef = getUserEntryDoc(entry.userId, entry.id);
  await setDoc(docRef, cleanData, { merge: true });
}

export async function deleteUserEntry(userId: string, entryId: string): Promise<void> {
  const docRef = getUserEntryDoc(userId, entryId);
  await deleteDoc(docRef);
}
