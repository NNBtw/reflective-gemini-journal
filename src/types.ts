export type AccessRole = 'user' | 'admin' | 'owner';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: AccessRole;
}

export type NotificationEventType = 'summary_ready' | 'weekly_reminder' | 'manual_test';

export interface NotificationPreferences {
  enabled: boolean;
  email: boolean;
  slack: boolean;
  discord: boolean;
  eventTypes: NotificationEventType[];
  consentVersion: '2026-09-04';
  updatedAt: number;
}

export type SafetyRegion = 'IN' | 'TW' | 'EU' | 'GLOBAL';

export interface SafetyPreferences {
  countryCode: SafetyRegion;
  updatedAt: number;
}

export type ReflectionMode = 'reflect' | 'summarize' | 'brainstorm' | 'action_items' | 'mindfulness';

export interface JournalMessage {
  id: string;
  role: 'user' | 'gemini';
  content: string;
  timestamp: number;
  mode?: ReflectionMode;
  modelUsed?: string;
}

export interface PinnedLocation {
  latitude: number;
  longitude: number;
  label?: string;
}

export interface JournalEntry {
  id: string;
  userId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  tags: string[];
  mood?: 'calm' | 'inspired' | 'anxious' | 'grateful' | 'energetic' | 'reflective' | 'tired';
  messages: JournalMessage[];
  latestSummary?: string;
  keyTakeaways?: string[];
  location?: PinnedLocation | null;
  wordCount: number;
}

export interface AIResponsePayload {
  reply: string;
  modelUsed: string;
  summary?: string;
  keyTakeaways?: string[];
}
