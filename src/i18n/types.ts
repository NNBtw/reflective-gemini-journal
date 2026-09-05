export type SupportedLocale = 'en' | 'zh-TW';

export interface TranslationDictionary {
  // Common / Navigation
  appName: string;
  appTagline: string;
  modelBadge: string;
  language: string;
  languageNameEn: string;
  languageNameZh: string;

  // Landing Page
  signIn: string;
  connecting: string;
  authenticating: string;
  signInWithGoogle: string;
  authErrorDefault: string;
  heroBadge: string;
  heroHeadline: string;
  heroSubheadline: string;
  highlight1Title: string;
  highlight1Desc: string;
  highlight1Badge: string;
  highlight2Title: string;
  highlight2Desc: string;
  highlight2Badge: string;
  highlight3Title: string;
  highlight3Desc: string;
  highlight3Badge: string;
  footerText: string;
  noPasswordsStored: string;
  strictIsolation: string;

  // App & Auth Loading
  verifyingAuth: string;
  emptySpaceTitle: string;
  emptySpaceDesc: string;
  startFirstReflection: string;
  deleteConfirmTitle: string;
  deleteConfirmDesc: string;
  cancel: string;
  delete: string;
  firestoreConnectionError: string;
  failedToCreateEntry: string;
  failedToSaveEntry: string;
  failedToDeleteEntry: string;

  // Sidebar
  isolatedPathActive: string;
  newReflection: string;
  searchPlaceholder: string;
  allFilter: string;
  noReflectionsFound: string;
  noReflectionsSub: string;
  noReflectionsStart: string;
  untitledReflection: string;
  emptyEntrySnippet: string;
  turnsCount: string;
  deleteReflectionTooltip: string;
  savingToFirestore: string;
  syncError: string;
  firestoreSynchronized: string;
  docsCountSingle: string;
  docsCountPlural: string;
  signOut: string;

  // Journal Editor Toolbar & Header
  titlePlaceholder: string;
  wordsCount: string;
  setMood: string;
  createSummary: string;
  updateSummary: string;
  summarizing: string;
  summaryTooltipEmpty: string;
  summaryTooltipCreating: string;
  summaryTooltipUpdate: string;
  summaryTooltipCreate: string;
  exportMarkdown: string;
  exportTooltip: string;
  deleteReflectionHeaderTooltip: string;
  addTag: string;
  tagInputPlaceholder: string;
  pinLocation: string;
  editLocation: string;
  pinnedLocation: string;
  locationDialogTitle: string;
  locationDialogDesc: string;
  closeLocationDialog: string;
  locationMapLabel: string;
  mapLoading: string;
  mapConfigMissing: string;
  mapUnavailable: string;
  mapUnavailableHint: string;
  mapClickHint: string;
  latitude: string;
  longitude: string;
  locationLabel: string;
  locationLabelPlaceholder: string;
  locationPrivacyNotice: string;
  invalidCoordinates: string;
  locationSaveError: string;
  removeLocation: string;
  openInGoogleMaps: string;
  saveLocation: string;
  savingLocation: string;

  // Moods
  moodCalm: string;
  moodInspired: string;
  moodReflective: string;
  moodGrateful: string;
  moodAnxious: string;
  moodTired: string;

  // Reflection Modes
  modeReflectLabel: string;
  modeReflectDesc: string;
  modeSummarizeLabel: string;
  modeSummarizeDesc: string;
  modeBrainstormLabel: string;
  modeBrainstormDesc: string;
  modeActionItemsLabel: string;
  modeActionItemsDesc: string;
  modeMindfulnessLabel: string;
  modeMindfulnessDesc: string;

  // Prompt Suggestions
  promptSuggestion1: string;
  promptSuggestion2: string;
  promptSuggestion3: string;
  promptSuggestion4: string;
  promptSuggestion5: string;
  startWithPrompt: string;

  // Empty Dialogue State
  exploringHeadline: string;
  exploringSubheadline: string;

  // Dialogue & Turns
  yourReflection: string;
  geminiCompanion: string;
  copyContentTooltip: string;
  youBadge: string;
  reflectingStatus: string;

  // Export Markdown
  exportDate: string;
  exportMood: string;
  exportTags: string;
  exportLocation: string;
  exportSummaryHeading: string;
  exportTakeawaysHeading: string;
  exportUserHeading: string;
  exportAiHeading: string;
  exportFallbackModel: string;
  exportNotAvailable: string;

  // Reflection Insights Card
  reflectionInsightsTitle: string;
  reflectionInsightsSub: string;
  regenerateSummaryTooltip: string;
  updating: string;
  summarySectionTitle: string;
  keyTakeawaysTitle: string;

  // Input Station
  aiLensLabel: string;
  reflectionInputPlaceholder: string;
  inputModeLabel: string;
  sendReflection: string;
  collapseComposer: string;
  expandComposer: string;
  composerRegionLabel: string;

  // Error & Status Banners
  retry: string;
  retrySave: string;
  dismissBtn: string;
  dismissSummaryError: string;
  dismissSummarySuccess: string;
  dismissChatError: string;
  dismissCrisisAlert: string;
  summaryUpdatedNotice: string;
  crisisBannerTitle: string;

  // Standard Chat & Summary Errors
  errAuthRequired: string;
  errRateLimitedChat: string;
  errRateLimitedSummary: string;
  errConversationTooLargeChat: string;
  errConversationTooLargeSummary: string;
  errInvalidShape: string;
  errEmptyContent: string;
  errGenericChat: string;
  errGenericSummary: string;
}
