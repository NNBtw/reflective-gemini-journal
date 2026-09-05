import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const DEFAULT_DATABASE_ID = 'ai-studio-d82d6296-0049-4433-955f-91f203831d05';

function getAdminApp() {
  const existing = getApps()[0];
  if (existing) return existing;
  return initializeApp({
    credential: applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || 'jimmy-gemini-journal',
  });
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}

export function getAdminFirestore() {
  return getFirestore(
    getAdminApp(),
    process.env.FIRESTORE_DATABASE_ID || DEFAULT_DATABASE_ID,
  );
}
