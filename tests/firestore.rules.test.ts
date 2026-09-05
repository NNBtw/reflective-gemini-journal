import { after, before, beforeEach, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

const PROJECT_ID = 'demo-reflective-rules';
const OWNER_UID = 'owner-user';
const OTHER_UID = 'other-user';
const ENTRY_ID = 'entry-1';
const ENTRY_PATH = `users/${OWNER_UID}/entries/${ENTRY_ID}`;
const NOTIFICATION_PREFERENCES_PATH = `users/${OWNER_UID}/preferences/notifications`;

let testEnv: RulesTestEnvironment;

type EntryData = {
  id: string;
  userId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  tags: string[];
  mood?: string;
  messages: Array<{
    id: string;
    role: string;
    content: string;
    timestamp: number;
    mode?: string;
    modelUsed?: string;
    [key: string]: unknown;
  }>;
  latestSummary?: string;
  keyTakeaways?: string[];
  location?: {
    latitude: number;
    longitude: number;
    label?: string;
    [key: string]: unknown;
  } | null;
  wordCount: number;
  [key: string]: unknown;
};

function validEntry(overrides: Partial<EntryData> = {}): EntryData {
  return {
    id: ENTRY_ID,
    userId: OWNER_UID,
    title: 'A bounded reflection',
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    tags: ['reflection'],
    mood: 'reflective',
    messages: [
      {
        id: 'message-1',
        role: 'user',
        content: 'I want to reflect on a difficult day.',
        timestamp: 1_700_000_000_000,
        mode: 'reflect',
      },
    ],
    latestSummary: '',
    keyTakeaways: [],
    wordCount: 9,
    ...overrides,
  };
}

function ownerDb() {
  return testEnv.authenticatedContext(OWNER_UID).firestore();
}

function otherDb() {
  return testEnv.authenticatedContext(OTHER_UID).firestore();
}

async function seedEntry(data: EntryData = validEntry()) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), ENTRY_PATH), data);
  });
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8'),
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

after(async () => {
  await testEnv.cleanup();
});

test('owner can create and read a valid entry', async () => {
  const ref = doc(ownerDb(), ENTRY_PATH);
  await assertSucceeds(setDoc(ref, validEntry()));
  await assertSucceeds(getDoc(ref));
});

test('owner can update mutable fields and delete an entry', async () => {
  await seedEntry();
  const ref = doc(ownerDb(), ENTRY_PATH);
  await assertSucceeds(updateDoc(ref, {
    title: 'Updated reflection',
    updatedAt: 1_700_000_000_001,
  }));
  await assertSucceeds(deleteDoc(ref));
});

test('unauthenticated clients cannot create or read entries', async () => {
  const ref = doc(testEnv.unauthenticatedContext().firestore(), ENTRY_PATH);
  await assertFails(setDoc(ref, validEntry()));
  await seedEntry();
  await assertFails(getDoc(ref));
});

test('another authenticated user cannot read, update, or delete an owner entry', async () => {
  await seedEntry();
  const ref = doc(otherDb(), ENTRY_PATH);
  await assertFails(getDoc(ref));
  await assertFails(updateDoc(ref, { title: 'Cross-user write' }));
  await assertFails(deleteDoc(ref));
});

test('top-level user documents remain inaccessible', async () => {
  await assertFails(setDoc(doc(ownerDb(), `users/${OWNER_UID}`), { displayName: 'Owner' }));
});

test('entry ID and user ID must match the document path', async () => {
  const ref = doc(ownerDb(), ENTRY_PATH);
  await assertFails(setDoc(ref, validEntry({ id: 'different-entry' })));
  await assertFails(setDoc(ref, validEntry({ userId: OTHER_UID })));
});

test('missing required fields and extra top-level fields are denied', async () => {
  const { title: _omittedTitle, ...missingTitle } = validEntry();
  await assertFails(setDoc(doc(ownerDb(), ENTRY_PATH), missingTitle));
  await assertFails(setDoc(doc(ownerDb(), ENTRY_PATH), validEntry({ unexpected: true })));
});

test('title accepts 120 characters and rejects 121 characters', async () => {
  await assertSucceeds(setDoc(doc(ownerDb(), ENTRY_PATH), validEntry({ title: 't'.repeat(120) })));
  await assertFails(setDoc(doc(ownerDb(), `users/${OWNER_UID}/entries/entry-2`), {
    ...validEntry({ id: 'entry-2', title: 't'.repeat(121) }),
  }));
});

test('tags enforce count, non-empty values, and 40-character limits', async () => {
  const ref = doc(ownerDb(), ENTRY_PATH);
  await assertFails(setDoc(ref, validEntry({ tags: Array.from({ length: 11 }, (_, index) => `tag-${index}`) })));
  await assertFails(setDoc(ref, validEntry({ tags: [''] })));
  await assertFails(setDoc(ref, validEntry({ tags: ['t'.repeat(41)] })));
});

test('owner can create, update, and remove a bounded pinned location', async () => {
  const ref = doc(ownerDb(), ENTRY_PATH);
  await assertSucceeds(setDoc(ref, validEntry({
    location: { latitude: 25.033963, longitude: 121.564469, label: 'Taipei 101' },
  })));
  await assertSucceeds(updateDoc(ref, {
    location: { latitude: -90, longitude: 180 },
    updatedAt: 1_700_000_000_001,
  }));
  await assertSucceeds(updateDoc(ref, {
    location: null,
    updatedAt: 1_700_000_000_002,
  }));
});

test('pinned location rejects out-of-range and invalid coordinate types', async () => {
  const ref = doc(ownerDb(), ENTRY_PATH);
  await assertFails(setDoc(ref, validEntry({ location: { latitude: 90.000001, longitude: 0 } })));
  await assertFails(setDoc(ref, validEntry({ location: { latitude: 0, longitude: -180.000001 } })));
  await assertFails(setDoc(ref, validEntry({
    location: { latitude: '25.03' as unknown as number, longitude: 121.56 },
  })));
});

test('pinned location rejects missing, extra, empty, and oversized fields', async () => {
  const ref = doc(ownerDb(), ENTRY_PATH);
  await assertFails(setDoc(ref, validEntry({
    location: { latitude: 25.03 } as EntryData['location'],
  })));
  await assertFails(setDoc(ref, validEntry({
    location: { latitude: 25.03, longitude: 121.56, altitude: 12 },
  })));
  await assertFails(setDoc(ref, validEntry({
    location: { latitude: 25.03, longitude: 121.56, label: '' },
  })));
  await assertFails(setDoc(ref, validEntry({
    location: { latitude: 25.03, longitude: 121.56, label: 'l'.repeat(121) },
  })));
});

test('messages enforce count and nested field constraints', async () => {
  const ref = doc(ownerDb(), ENTRY_PATH);
  const validMessage = validEntry().messages[0];
  await assertFails(setDoc(ref, validEntry({ messages: Array.from({ length: 21 }, (_, index) => ({
    ...validMessage,
    id: `message-${index}`,
  })) })));
  await assertFails(setDoc(ref, validEntry({ messages: [{ ...validMessage, role: 'system' }] })));
  await assertFails(setDoc(ref, validEntry({ messages: [{ ...validMessage, id: '' }] })));
  await assertFails(setDoc(ref, validEntry({ messages: [{ ...validMessage, id: 'i'.repeat(101) }] })));
  await assertFails(setDoc(ref, validEntry({ messages: [{ ...validMessage, content: 'm'.repeat(4001) }] })));
  await assertFails(setDoc(ref, validEntry({ messages: [{ ...validMessage, timestamp: 1.5 }] })));
  await assertFails(setDoc(ref, validEntry({ messages: [{ ...validMessage, mode: 'unsupported' }] })));
  await assertFails(setDoc(ref, validEntry({ messages: [{ ...validMessage, modelUsed: '' }] })));
  await assertFails(setDoc(ref, validEntry({ messages: [{ ...validMessage, modelUsed: 'm'.repeat(101) }] })));
  await assertFails(setDoc(ref, validEntry({ messages: [{ ...validMessage, unexpected: true }] })));
});

test('owner can create an empty journal entry', async () => {
  await assertSucceeds(setDoc(doc(ownerDb(), ENTRY_PATH), validEntry({ messages: [] })));
});

test('frontend-shaped first message update can append to an empty journal entry', async () => {
  const ref = doc(ownerDb(), ENTRY_PATH);
  const createdAt = 1_700_000_000_000;
  const firstMessage = {
    id: 'msg-1700000000001-abc12',
    role: 'user',
    content: 'I want to reflect on a difficult day.',
    timestamp: createdAt + 1,
    mode: 'reflect',
  };

  await assertSucceeds(setDoc(ref, validEntry({
    title: 'New Reflection',
    createdAt,
    updatedAt: createdAt,
    messages: [],
    wordCount: 0,
  })));

  await assertSucceeds(setDoc(ref, {
    ...validEntry({
      title: firstMessage.content,
      createdAt,
      updatedAt: createdAt + 2,
      messages: [firstMessage],
      wordCount: 8,
    }),
  }, { merge: true }));
});

test('initial entry creation rejects more than two messages', async () => {
  const validMessage = validEntry().messages[0];
  await assertFails(setDoc(doc(ownerDb(), ENTRY_PATH), validEntry({
    messages: Array.from({ length: 3 }, (_, index) => ({
      ...validMessage,
      id: `message-${index}`,
      timestamp: validMessage.timestamp + index,
    })),
  })));
});

test('messages can grow from one to 20 through validated single-message appends', async () => {
  const ref = doc(ownerDb(), ENTRY_PATH);
  const validMessage = validEntry().messages[0];
  let messages: EntryData['messages'] = [validMessage];
  await assertSucceeds(setDoc(ref, validEntry({ messages })));

  for (let index = 1; index < 20; index += 1) {
    messages = [...messages, {
      ...validMessage,
      id: `message-${index}`,
      timestamp: validMessage.timestamp + index,
    }];
    await assertSucceeds(updateDoc(ref, {
      messages,
      updatedAt: validMessage.timestamp + index + 1,
    }));
  }
});

test('a full 20-message history can roll forward by one validated message', async () => {
  const ref = doc(ownerDb(), ENTRY_PATH);
  const validMessage = validEntry().messages[0];
  const messages = Array.from({ length: 20 }, (_, index) => ({
    ...validMessage,
    id: `message-${index}`,
    timestamp: validMessage.timestamp + index,
  }));
  await seedEntry(validEntry({ messages }));

  const rolledMessages = [
    ...messages.slice(1),
    {
      ...validMessage,
      id: 'message-20',
      timestamp: validMessage.timestamp + 20,
    },
  ];
  await assertSucceeds(updateDoc(ref, {
    messages: rolledMessages,
    updatedAt: validMessage.timestamp + 21,
  }));
});

test('an appended message must satisfy the complete nested schema', async () => {
  const ref = doc(ownerDb(), ENTRY_PATH);
  const validMessage = validEntry().messages[0];
  await assertSucceeds(setDoc(ref, validEntry({ messages: [validMessage] })));
  await assertFails(updateDoc(ref, {
    messages: [
      validMessage,
      {
        ...validMessage,
        id: 'message-invalid',
        role: 'system',
        timestamp: validMessage.timestamp + 1,
      },
    ],
  }));
});

test('summary fields can update while a full message history remains unchanged', async () => {
  const ref = doc(ownerDb(), ENTRY_PATH);
  const validMessage = validEntry().messages[0];
  const messages = Array.from({ length: 20 }, (_, index) => ({
    ...validMessage,
    id: `message-${index}`,
    timestamp: validMessage.timestamp + index,
  }));
  await seedEntry(validEntry({ messages }));
  await assertSucceeds(updateDoc(ref, {
    latestSummary: 'A validated summary for a full history.',
    keyTakeaways: ['One', 'Two', 'Three'],
    updatedAt: validMessage.timestamp + 21,
  }));
});

test('message history cannot be bulk-replaced, shortened, or expanded beyond 20', async () => {
  const ref = doc(ownerDb(), ENTRY_PATH);
  const validMessage = validEntry().messages[0];
  const messages = Array.from({ length: 20 }, (_, index) => ({
    ...validMessage,
    id: `message-${index}`,
    timestamp: validMessage.timestamp + index,
  }));
  await seedEntry(validEntry({ messages }));

  await assertFails(updateDoc(ref, { messages: messages.slice(0, 19) }));
  await assertFails(updateDoc(ref, {
    messages: messages.map((message, index) => index === 10
      ? { ...message, content: 'Rewritten history' }
      : message),
  }));
  await assertFails(updateDoc(ref, {
    messages: [...messages, {
      ...validMessage,
      id: 'message-20',
      timestamp: validMessage.timestamp + 20,
    }],
  }));
});

test('valid summaries require three to five bounded takeaways', async () => {
  await assertSucceeds(setDoc(doc(ownerDb(), ENTRY_PATH), validEntry({
    latestSummary: 'A concise reflection summary.',
    keyTakeaways: ['One', 'Two', 'Three'],
  })));
  await assertSucceeds(setDoc(doc(ownerDb(), `users/${OWNER_UID}/entries/entry-2`), validEntry({
    id: 'entry-2',
    latestSummary: 'Another concise reflection summary.',
    keyTakeaways: ['One', 'Two', 'Three', 'Four', 'Five'],
  })));
});

test('summary and takeaway invariant rejects inconsistent or oversized data', async () => {
  const ref = doc(ownerDb(), ENTRY_PATH);
  await assertFails(setDoc(ref, validEntry({ latestSummary: 'Summary', keyTakeaways: [] })));
  await assertFails(setDoc(ref, validEntry({ latestSummary: '', keyTakeaways: ['One', 'Two', 'Three'] })));
  await assertFails(setDoc(ref, validEntry({ latestSummary: 'Summary', keyTakeaways: ['One', 'Two'] })));
  await assertFails(setDoc(ref, validEntry({ latestSummary: 'Summary', keyTakeaways: ['1', '2', '3', '4', '5', '6'] })));
  await assertFails(setDoc(ref, validEntry({ latestSummary: 'Summary', keyTakeaways: ['t'.repeat(241), 'Two', 'Three'] })));
  await assertFails(setDoc(ref, validEntry({ latestSummary: 's'.repeat(4001), keyTakeaways: ['One', 'Two', 'Three'] })));
});

test('identity and creation timestamp fields are immutable', async () => {
  await seedEntry();
  const ref = doc(ownerDb(), ENTRY_PATH);
  await assertFails(updateDoc(ref, { id: 'changed-entry' }));
  await assertFails(updateDoc(ref, { userId: OTHER_UID }));
  await assertFails(updateDoc(ref, { createdAt: 1_700_000_000_001 }));
});

test('wrong field types and invalid timestamps are denied', async () => {
  const ref = doc(ownerDb(), ENTRY_PATH);
  await assertFails(setDoc(ref, validEntry({ wordCount: -1 })));
  await assertFails(setDoc(ref, validEntry({ createdAt: 0 })));
  await assertFails(setDoc(ref, validEntry({ updatedAt: 1_699_999_999_999 })));
  await assertFails(setDoc(ref, validEntry({ mood: 'unsupported' })));
});

test('owner can opt in to bounded notification preferences and read them back', async () => {
  const ref = doc(ownerDb(), NOTIFICATION_PREFERENCES_PATH);
  const preferences = {
    enabled: true,
    email: true,
    slack: false,
    discord: false,
    eventTypes: ['summary_ready', 'manual_test'],
    consentVersion: '2026-09-04',
    updatedAt: 1_700_000_000_000,
  };
  await assertSucceeds(setDoc(ref, preferences));
  await assertSucceeds(getDoc(ref));
  await assertSucceeds(deleteDoc(ref));
});

test('other users and unauthenticated clients cannot access notification preferences', async () => {
  const ownerRef = doc(ownerDb(), NOTIFICATION_PREFERENCES_PATH);
  const otherRef = doc(otherDb(), NOTIFICATION_PREFERENCES_PATH);
  const anonymousRef = doc(testEnv.unauthenticatedContext().firestore(), NOTIFICATION_PREFERENCES_PATH);
  const preferences = { enabled: false, email: false, slack: false, discord: false, eventTypes: [], consentVersion: '2026-09-04', updatedAt: 1 };
  await assertSucceeds(setDoc(ownerRef, preferences));
  await assertFails(getDoc(otherRef));
  await assertFails(setDoc(otherRef, preferences));
  await assertFails(getDoc(anonymousRef));
});

test('notification preference schema rejects secrets, content, invalid events, and stale consent', async () => {
  const ref = doc(ownerDb(), NOTIFICATION_PREFERENCES_PATH);
  const base = { enabled: true, email: true, slack: false, discord: false, eventTypes: ['summary_ready'], consentVersion: '2026-09-04', updatedAt: 1 };
  await assertFails(setDoc(ref, { ...base, webhook: 'https://secret.example' }));
  await assertFails(setDoc(ref, { ...base, journalText: 'private' }));
  await assertFails(setDoc(ref, { ...base, eventTypes: ['crisis_detected'] }));
  await assertFails(setDoc(ref, { ...base, consentVersion: '2026-01-01' }));
});

test('client access to server-only audit and delivery collections is denied', async () => {
  await assertFails(setDoc(doc(ownerDb(), '_adminAudit/audit-1'), { status: 'forged' }));
  await assertFails(getDoc(doc(ownerDb(), '_adminAudit/audit-1')));
  await assertFails(setDoc(doc(ownerDb(), '_notificationEvents/event-1'), { status: 'forged' }));
  await assertFails(getDoc(doc(ownerDb(), '_notificationEvents/event-1')));
});

test('owner can store a bounded safety-resource region without contact or location data', async () => {
  const ref = doc(ownerDb(), `users/${OWNER_UID}/preferences/safety`);
  await assertSucceeds(setDoc(ref, { countryCode: 'IN', updatedAt: 1_700_000_000_000 }));
  await assertSucceeds(getDoc(ref));
  await assertSucceeds(setDoc(ref, { countryCode: 'TW', updatedAt: 1_700_000_000_001 }));
  await assertFails(setDoc(ref, { countryCode: 'US', updatedAt: 1_700_000_000_002 }));
  await assertFails(setDoc(ref, { countryCode: 'IN', updatedAt: 1_700_000_000_003, phone: '+91-secret' }));
  await assertFails(setDoc(ref, { countryCode: 'IN', updatedAt: 1_700_000_000_004, latitude: 0, longitude: 0 }));
});

test('other users cannot read or overwrite safety-resource preferences', async () => {
  const path = `users/${OWNER_UID}/preferences/safety`;
  await assertSucceeds(setDoc(doc(ownerDb(), path), { countryCode: 'GLOBAL', updatedAt: 1 }));
  await assertFails(getDoc(doc(otherDb(), path)));
  await assertFails(setDoc(doc(otherDb(), path), { countryCode: 'IN', updatedAt: 2 }));
});
