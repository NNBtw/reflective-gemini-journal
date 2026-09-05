import { TranslationDictionary } from '../types';

export const enTranslations: TranslationDictionary = {
  // Common / Navigation
  appName: 'ReflectAI',
  appTagline: 'A mindful space for your thoughts, powered by Gemini.',
  modelBadge: 'Gemini 3.6 Flash',
  language: 'Language',
  languageNameEn: 'English',
  languageNameZh: '繁體中文',

  // Landing Page
  signIn: 'Sign In',
  connecting: 'Connecting...',
  authenticating: 'Authenticating...',
  signInWithGoogle: 'Sign In with Google',
  authErrorDefault: 'Authentication was cancelled or failed. Please try again.',
  heroBadge: 'Private • User-Isolated Cloud Firestore • Google Sign-In',
  heroHeadline: 'A mindful space for your thoughts, powered by Gemini.',
  heroSubheadline:
    'Write deep reflections, unpack decisions, and gain instant clarity. Your private journal companion provides structured summaries, brainstorming insights, and actionable next steps.',
  highlight1Title: 'Multi-Turn AI Reflections',
  highlight1Desc:
    'Engage in meaningful dialogue with Gemini. Switch between reflective questioning, deep summaries, and brainstorming pathways.',
  highlight1Badge: 'Gemini 3.6 Flash Fallback Ladder',
  highlight2Title: 'User-Isolated Firestore',
  highlight2Desc:
    'Your entries live strictly in your isolated subcollection. Enforced by owner-bound Firestore security rules.',
  highlight2Badge: 'Owner-Bound UID Rules',
  highlight3Title: 'Continuous History & Insights',
  highlight3Desc:
    'Review past sessions, search themes, filter by mood or tag, and export your reflections whenever you need clarity.',
  highlight3Badge: 'Real-time Cloud Sync',
  footerText: 'ReflectAI • Built with Google Gemini 3.6 Flash and Cloud Firestore',
  noPasswordsStored: 'No passwords stored',
  strictIsolation: 'Strict RBAC Isolation',

  // App & Auth Loading
  verifyingAuth: 'Verifying secure authentication...',
  emptySpaceTitle: 'Welcome to your Reflection Space',
  emptySpaceDesc: 'You have no journal reflections yet. Start a new entry to reflect with Gemini.',
  startFirstReflection: 'Start First Reflection',
  deleteConfirmTitle: 'Delete this reflection?',
  deleteConfirmDesc:
    'This action permanently removes the reflection document from your isolated Cloud Firestore collection.',
  cancel: 'Cancel',
  delete: 'Delete',
  firestoreConnectionError: 'Firestore connection error. Please check your network.',
  failedToCreateEntry: 'Failed to create entry in Firestore: ',
  failedToSaveEntry: 'Failed to save to Firestore. Your changes are in local cache.',
  failedToDeleteEntry: 'Failed to delete entry: ',

  // Sidebar
  isolatedPathActive: 'Isolated Path Active',
  newReflection: 'New Reflection',
  searchPlaceholder: 'Search past reflections...',
  allFilter: 'All',
  noReflectionsFound: 'No reflections found',
  noReflectionsSub: 'Try changing your search or filter',
  noReflectionsStart: 'Click "New Reflection" to start',
  untitledReflection: 'Untitled Reflection',
  emptyEntrySnippet: 'Empty entry...',
  turnsCount: 'turns',
  deleteReflectionTooltip: 'Delete reflection',
  savingToFirestore: 'Saving to Firestore...',
  syncError: 'Sync error',
  firestoreSynchronized: 'Firestore Synchronized',
  docsCountSingle: 'doc',
  docsCountPlural: 'docs',
  signOut: 'Sign Out',

  // Journal Editor Toolbar & Header
  titlePlaceholder: 'Title your reflection...',
  wordsCount: 'words',
  setMood: 'Set Mood',
  createSummary: 'Create Summary',
  updateSummary: 'Update Summary',
  summarizing: 'Summarizing...',
  summaryTooltipEmpty: 'Add a reflection first to create a summary',
  summaryTooltipCreating: 'Creating summary...',
  summaryTooltipUpdate: 'Update Reflection Summary',
  summaryTooltipCreate: 'Create Reflection Summary',
  exportMarkdown: 'Export',
  exportTooltip: 'Export as Markdown',
  deleteReflectionHeaderTooltip: 'Delete this reflection',
  addTag: '+ Add Tag',
  tagInputPlaceholder: 'Tag name + Enter',
  pinLocation: 'Pin Location',
  editLocation: 'Edit Location',
  pinnedLocation: 'Pinned location',
  locationDialogTitle: 'Pin a location',
  locationDialogDesc: 'Choose one point for this journal entry. Nothing is saved until you confirm.',
  closeLocationDialog: 'Close location picker',
  locationMapLabel: 'Google Map location picker',
  mapLoading: 'Loading Google Maps...',
  mapConfigMissing: 'Google Maps is not configured yet.',
  mapUnavailable: 'Google Maps could not be loaded.',
  mapUnavailableHint: 'Core journaling remains available. A restricted Maps key and map ID are required for the picker.',
  mapClickHint: 'Click the map or enter valid coordinates, then save the location.',
  latitude: 'Latitude',
  longitude: 'Longitude',
  locationLabel: 'Location label (optional)',
  locationLabelPlaceholder: 'For example: Riverside park',
  locationPrivacyNotice: 'Exact coordinates are sensitive. They are stored only with this private journal entry, are included if you export it, and are not sent to Gemini.',
  invalidCoordinates: 'Enter a latitude from -90 to 90 and a longitude from -180 to 180.',
  locationSaveError: 'Unable to save the location. Your existing journal content was not changed.',
  removeLocation: 'Remove',
  openInGoogleMaps: 'Open in Maps',
  saveLocation: 'Save Location',
  savingLocation: 'Saving...',

  // Moods
  moodCalm: 'Calm',
  moodInspired: 'Inspired',
  moodReflective: 'Reflective',
  moodGrateful: 'Grateful',
  moodAnxious: 'Anxious',
  moodTired: 'Tired',

  // Reflection Modes
  modeReflectLabel: 'Reflect & Mirror',
  modeReflectDesc: 'Deep questions and perspective',
  modeSummarizeLabel: 'Executive Summary',
  modeSummarizeDesc: 'Key themes and takeaways',
  modeBrainstormLabel: 'Brainstorm Paths',
  modeBrainstormDesc: 'Creative solutions & ideas',
  modeActionItemsLabel: 'Action Steps',
  modeActionItemsDesc: 'Tangible next steps to take',
  modeMindfulnessLabel: 'Mindful Grounding',
  modeMindfulnessDesc: 'Calming reframes & awareness',

  // Prompt Suggestions
  promptSuggestion1: 'What is the single biggest thing occupying my mind right now?',
  promptSuggestion2: 'A challenge I faced today and what it revealed about my priorities...',
  promptSuggestion3: 'Three small wins or things I am genuinely grateful for today:',
  promptSuggestion4: "A decision I'm hesitating on and the hidden fears behind it...",
  promptSuggestion5: 'How my energy felt throughout the day and what drained or energized me:',
  startWithPrompt: 'Start with this prompt →',

  // Empty Dialogue State
  exploringHeadline: 'What are you exploring today?',
  exploringSubheadline:
    'Write freely about your day, a goal, a creative hurdle, or an emotional state. Gemini will respond with empathetic insight, structured summaries, or brainstorming angles.',

  // Dialogue & Turns
  yourReflection: 'Your Reflection',
  geminiCompanion: 'Gemini AI Companion',
  copyContentTooltip: 'Copy content',
  youBadge: 'You',
  reflectingStatus: 'Reflecting with Gemini 3.6 Flash...',

  // Export Markdown
  exportDate: 'Date',
  exportMood: 'Mood',
  exportTags: 'Tags',
  exportLocation: 'Pinned Location',
  exportSummaryHeading: 'Reflection Summary',
  exportTakeawaysHeading: 'Key Takeaways',
  exportUserHeading: 'Reflection',
  exportAiHeading: 'Gemini AI',
  exportFallbackModel: 'Companion',
  exportNotAvailable: 'N/A',

  // Reflection Insights Card
  reflectionInsightsTitle: 'Reflection Insights',
  reflectionInsightsSub: 'Concise summary & key takeaways from this journal',
  regenerateSummaryTooltip: 'Regenerate Reflection Summary',
  updating: 'Updating...',
  summarySectionTitle: 'Summary',
  keyTakeawaysTitle: 'Key Takeaways',

  // Input Station
  aiLensLabel: 'AI Lens:',
  reflectionInputPlaceholder:
    'Write your reflection, thoughts, or questions here... (Press Ctrl+Enter or Cmd+Enter to send)',
  inputModeLabel: 'Mode:',
  sendReflection: 'Send Reflection',
  collapseComposer: 'Collapse Composer',
  expandComposer: 'Expand Composer',
  composerRegionLabel: 'Reflection composer',

  // Error & Status Banners
  retry: 'Retry',
  retrySave: 'Retry Save',
  dismissBtn: 'Dismiss',
  dismissSummaryError: 'Dismiss summary error',
  dismissSummarySuccess: 'Dismiss summary success notification',
  dismissChatError: 'Dismiss chat error',
  dismissCrisisAlert: 'Dismiss crisis alert',
  summaryUpdatedNotice: 'Reflection summary updated and saved to your private journal.',
  crisisBannerTitle: 'Crisis Support & Immediate Care',

  // Standard Chat & Summary Errors
  errAuthRequired: 'Your session expired. Please sign in again.',
  errRateLimitedChat: 'Hourly chat limit reached or AI service is busy. Please try again later.',
  errRateLimitedSummary: 'Hourly summary limit reached or AI service is busy. Please try again later.',
  errConversationTooLargeChat: 'This reflection is too long to process in one request.',
  errConversationTooLargeSummary: 'This reflection is too long to summarize in one request.',
  errInvalidShape: 'Unable to generate reflection summary. Please try again.',
  errEmptyContent: 'Please write a reflection before generating a summary.',
  errGenericChat: 'Unable to complete AI reflection. Please try again.',
  errGenericSummary: 'Unable to generate reflection summary. Please try again.',
};
