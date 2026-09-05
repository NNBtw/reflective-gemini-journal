import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  FileText,
  Lightbulb,
  ListCheck,
  Compass,
  Copy,
  Check,
  Download,
  Tag as TagIcon,
  Smile,
  RefreshCw,
  AlertTriangle,
  Menu,
  ChevronDown,
  ChevronUp,
  Trash2,
  MapPin
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { JournalEntry, JournalMessage, ReflectionMode, SafetyRegion } from '../types';
import { auth } from '../lib/firebase';
import { useLanguage } from '../i18n/LanguageContext';
import { TranslationDictionary } from '../i18n/types';
import { LocationPicker } from './LocationPicker';
import { buildGoogleMapsUrl } from '../lib/location';
import { dispatchNotification } from '../lib/api';

interface JournalEditorProps {
  entry: JournalEntry;
  onUpdateEntry: (updated: JournalEntry) => Promise<boolean>;
  onDeleteEntry: (id: string) => void;
  onOpenSidebar: () => void;
  isSaving: boolean;
  saveError: string | null;
  onRetrySave: () => void;
  supportCountry: SafetyRegion;
}

const MAX_STORED_MESSAGES = 20;
const MAX_MESSAGE_CHARS = 4000;
const MAX_SUMMARY_TRANSCRIPT_CHARS = 16000;

type SummaryErrorCode =
  | 'AUTH_REQUIRED'
  | 'RATE_LIMITED'
  | 'CONVERSATION_TOO_LARGE'
  | 'INVALID_SHAPE'
  | 'EMPTY_CONTENT'
  | 'GENERIC_RETRY';

class SummaryActionError extends Error {
  constructor(public code: SummaryErrorCode) {
    super(code);
    this.name = 'SummaryActionError';
  }
}

type ChatErrorCode =
  | 'AUTH_REQUIRED'
  | 'RATE_LIMITED'
  | 'CONVERSATION_TOO_LARGE'
  | 'GENERIC_RETRY';

class ChatActionError extends Error {
  constructor(public code: ChatErrorCode) {
    super(code);
    this.name = 'ChatActionError';
  }
}

const getSummaryErrorMessage = (
  code: SummaryErrorCode,
  t: (k: keyof TranslationDictionary) => string
): string => {
  switch (code) {
    case 'AUTH_REQUIRED':
      return t('errAuthRequired');
    case 'RATE_LIMITED':
      return t('errRateLimitedSummary');
    case 'CONVERSATION_TOO_LARGE':
      return t('errConversationTooLargeSummary');
    case 'INVALID_SHAPE':
      return t('errInvalidShape');
    case 'EMPTY_CONTENT':
      return t('errEmptyContent');
    case 'GENERIC_RETRY':
    default:
      return t('errGenericSummary');
  }
};

const getChatErrorMessage = (
  code: ChatErrorCode,
  t: (k: keyof TranslationDictionary) => string
): string => {
  switch (code) {
    case 'AUTH_REQUIRED':
      return t('errAuthRequired');
    case 'RATE_LIMITED':
      return t('errRateLimitedChat');
    case 'CONVERSATION_TOO_LARGE':
      return t('errConversationTooLargeChat');
    case 'GENERIC_RETRY':
    default:
      return t('errGenericChat');
  }
};

/**
 * Builds the request transcript from newest to oldest within the 16,000-character total limit,
 * then returns included segments in chronological order.
 *
 * Invariants:
 * - The newest non-empty user message is unconditionally included and never displaced by older messages.
 * - Preserves whole message boundaries (no mid-message cutoffs).
 * - Respects per-message limit (4,000 chars) and stored-message limit (up to 20 messages).
 * - Avoids any final prefix slice that could remove the newest content.
 * - Leaves crisis detection authoritatively to the backend.
 */
function buildBoundedTranscript(messages: JournalMessage[]): string {
  const candidateMessages = messages
    .filter((m) => m.content && m.content.trim().length > 0)
    .slice(-MAX_STORED_MESSAGES);

  if (candidateMessages.length === 0) {
    return '';
  }

  const formattedSegments = candidateMessages.map((m) => {
    const roleLabel = m.role === 'user' ? 'Reflection' : 'Companion';
    const text = m.content.trim().slice(0, MAX_MESSAGE_CHARS);
    return `${roleLabel}: ${text}`;
  });

  let newestUserIndex = -1;
  for (let i = candidateMessages.length - 1; i >= 0; i--) {
    if (candidateMessages[i].role === 'user') {
      newestUserIndex = i;
      break;
    }
  }

  const includedIndices = new Set<number>();
  let currentLength = 0;

  // Invariant: Newest non-empty user message is unconditionally prioritized and included
  if (newestUserIndex !== -1) {
    includedIndices.add(newestUserIndex);
    currentLength = formattedSegments[newestUserIndex].length;
  }

  // Backfill remaining transcript capacity from newest to oldest
  for (let i = candidateMessages.length - 1; i >= 0; i--) {
    if (includedIndices.has(i)) {
      continue;
    }

    const segment = formattedSegments[i];
    const separatorCost = includedIndices.size > 0 ? 2 : 0; // '\n\n'

    if (currentLength + separatorCost + segment.length <= MAX_SUMMARY_TRANSCRIPT_CHARS) {
      includedIndices.add(i);
      currentLength += separatorCost + segment.length;
    }
    // Preserves whole message boundaries: if a whole message doesn't fit within budget, it is omitted
  }

  // Return included segments in chronological order without prefix truncation
  return Array.from(includedIndices)
    .sort((a, b) => a - b)
    .map((idx) => formattedSegments[idx])
    .join('\n\n');
}

export const JournalEditor: React.FC<JournalEditorProps> = ({
  entry,
  onUpdateEntry,
  onDeleteEntry,
  onOpenSidebar,
  isSaving,
  saveError,
  onRetrySave,
  supportCountry,
}) => {
  const { t, locale } = useLanguage();
  const [inputText, setInputText] = useState('');
  const [activeMode, setActiveMode] = useState<ReflectionMode>('reflect');
  const [isComposerExpanded, setIsComposerExpanded] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryErrorCode, setSummaryErrorCode] = useState<SummaryErrorCode | null>(null);
  const [summarySuccess, setSummarySuccess] = useState(false);
  const [crisisAlert, setCrisisAlert] = useState<string | null>(null);
  const [chatErrorCode, setChatErrorCode] = useState<ChatErrorCode | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const [showMoodPicker, setShowMoodPicker] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isSummarizingRef = useRef(false);

  const modes: { id: ReflectionMode; label: string; icon: React.ReactNode; desc: string }[] = [
    { id: 'reflect', label: t('modeReflectLabel'), icon: <Compass className="w-4 h-4 text-[#5B7553]" />, desc: t('modeReflectDesc') },
    { id: 'summarize', label: t('modeSummarizeLabel'), icon: <FileText className="w-4 h-4 text-[#466968]" />, desc: t('modeSummarizeDesc') },
    { id: 'brainstorm', label: t('modeBrainstormLabel'), icon: <Lightbulb className="w-4 h-4 text-[#B86B35]" />, desc: t('modeBrainstormDesc') },
    { id: 'action_items', label: t('modeActionItemsLabel'), icon: <ListCheck className="w-4 h-4 text-[#4D6A42]" />, desc: t('modeActionItemsDesc') },
    { id: 'mindfulness', label: t('modeMindfulnessLabel'), icon: <Sparkles className="w-4 h-4 text-[#9C5D47]" />, desc: t('modeMindfulnessDesc') },
  ];

  const promptSuggestions = [
    t('promptSuggestion1'),
    t('promptSuggestion2'),
    t('promptSuggestion3'),
    t('promptSuggestion4'),
    t('promptSuggestion5'),
  ];

  const moods: { id: JournalEntry['mood']; label: string; emoji: string }[] = [
    { id: 'calm', label: t('moodCalm'), emoji: '🌿' },
    { id: 'inspired', label: t('moodInspired'), emoji: '✨' },
    { id: 'reflective', label: t('moodReflective'), emoji: '🌙' },
    { id: 'grateful', label: t('moodGrateful'), emoji: '🙏' },
    { id: 'anxious', label: t('moodAnxious'), emoji: '🌪️' },
    { id: 'tired', label: t('moodTired'), emoji: '☕' },
  ];

  const summaryError = summaryErrorCode ? getSummaryErrorMessage(summaryErrorCode, t) : null;
  const chatError = chatErrorCode ? getChatErrorMessage(chatErrorCode, t) : null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entry.messages, isGenerating]);

  useEffect(() => {
    setSummaryErrorCode(null);
    setSummarySuccess(false);
    setCrisisAlert(null);
    setChatErrorCode(null);
  }, [entry.id]);

  const hasMeaningfulContent = entry.messages.some(
    (m) => m.content && m.content.trim().length > 0
  );

  const handleTitleChange = (newTitle: string) => {
    onUpdateEntry({
      ...entry,
      title: newTitle.slice(0, 120),
      updatedAt: Date.now(),
    });
  };

  const handleAddTag = (tag: string) => {
    const cleaned = tag.trim().toLowerCase().replace(/^[#]/, '').slice(0, 40);
    if (cleaned && entry.tags.length < 10 && !entry.tags.includes(cleaned)) {
      onUpdateEntry({
        ...entry,
        tags: [...entry.tags, cleaned],
        updatedAt: Date.now(),
      });
    }
    setTagInput('');
    setShowTagInput(false);
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onUpdateEntry({
      ...entry,
      tags: entry.tags.filter((t) => t !== tagToRemove),
      updatedAt: Date.now(),
    });
  };

  const handleSetMood = (mood: JournalEntry['mood']) => {
    onUpdateEntry({
      ...entry,
      mood,
      updatedAt: Date.now(),
    });
    setShowMoodPicker(false);
  };

  const handleSaveLocation = async (location: NonNullable<JournalEntry['location']>) => {
    await onUpdateEntry({
      ...entry,
      location,
      updatedAt: Date.now(),
    });
    setShowLocationPicker(false);
  };

  const handleRemoveLocation = async () => {
    await onUpdateEntry({
      ...entry,
      location: null,
      updatedAt: Date.now(),
    });
    setShowLocationPicker(false);
  };

  const executeChatGeneration = async (
    messagesToSend: JournalMessage[],
    targetEntry: JournalEntry
  ) => {
    setIsGenerating(true);
    setChatErrorCode(null);

    try {
      let idToken: string | undefined;
      try {
        idToken = await auth.currentUser?.getIdToken();
      } catch {
        throw new ChatActionError('AUTH_REQUIRED');
      }

      if (!idToken) {
        throw new ChatActionError('AUTH_REQUIRED');
      }

      let response: Response;
      try {
        response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            messages: messagesToSend,
            mode: activeMode,
            title: targetEntry.title,
            tags: targetEntry.tags,
            mood: targetEntry.mood || 'reflective',
            supportCountry,
          }),
        });
      } catch {
        throw new ChatActionError('GENERIC_RETRY');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const code = typeof errorData?.code === 'string' ? errorData.code : '';
        if (response.status === 401 || code === 'AUTH_REQUIRED' || code === 'INVALID_TOKEN') {
          throw new ChatActionError('AUTH_REQUIRED');
        }
        if (response.status === 429 || code === 'RATE_LIMITED' || code === 'AI_RATE_LIMITED') {
          throw new ChatActionError('RATE_LIMITED');
        }
        if (response.status === 413 || code === 'CONVERSATION_TOO_LARGE' || code === 'PAYLOAD_TOO_LARGE') {
          throw new ChatActionError('CONVERSATION_TOO_LARGE');
        }
        throw new ChatActionError('GENERIC_RETRY');
      }

      let data: any;
      try {
        data = await response.json();
      } catch {
        throw new ChatActionError('GENERIC_RETRY');
      }

      if (!data || typeof data.reply !== 'string' || !data.reply.trim()) {
        throw new ChatActionError('GENERIC_RETRY');
      }

      const geminiMessage: JournalMessage = {
        id: 'msg-gemini-' + Date.now(),
        role: 'gemini',
        content: data.reply.trim(),
        timestamp: Date.now(),
        mode: activeMode,
        modelUsed: typeof data.modelUsed === 'string' && data.modelUsed.trim()
          ? data.modelUsed.trim()
          : 'gemini-3.6-flash',
      };

      const finalMessages = [...messagesToSend, geminiMessage].slice(-MAX_STORED_MESSAGES);
      const saved = await onUpdateEntry({
        ...targetEntry,
        messages: finalMessages,
        updatedAt: Date.now(),
      });
      if (!saved) throw new ChatActionError('GENERIC_RETRY');
      setChatErrorCode(null);
    } catch (err: unknown) {
      console.error('[Chat] Request failed');
      if (err instanceof ChatActionError) {
        setChatErrorCode(err.code);
      } else {
        setChatErrorCode('GENERIC_RETRY');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = (customPrompt || inputText).trim();
    if (!textToSend || isGenerating) return;

    const userMessage: JournalMessage = {
      id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      role: 'user',
      content: textToSend,
      timestamp: Date.now(),
      mode: activeMode,
    };

    const newMessages = [...entry.messages, userMessage].slice(-MAX_STORED_MESSAGES);
    const totalWords = newMessages.reduce(
      (acc, m) => acc + (m.content ? m.content.split(/\s+/).length : 0),
      0
    );

    // Update local state first and save
    const updatedEntry: JournalEntry = {
      ...entry,
      messages: newMessages,
      wordCount: totalWords,
      updatedAt: Date.now(),
      title: entry.title === 'New Reflection' && newMessages.length === 1
        ? textToSend.slice(0, 40) + (textToSend.length > 40 ? '...' : '')
        : entry.title,
    };

    const saved = await onUpdateEntry(updatedEntry);
    if (!saved) return;
    setInputText('');
    await executeChatGeneration(newMessages, updatedEntry);
  };

  const handleRetryChat = async () => {
    if (isGenerating || entry.messages.length === 0) return;
    await executeChatGeneration(entry.messages, entry);
  };

  const handleCreateSummary = async () => {
    if (isSummarizingRef.current || !hasMeaningfulContent) return;

    isSummarizingRef.current = true;
    setIsSummarizing(true);
    setSummaryErrorCode(null);
    setSummarySuccess(false);

    try {
      let idToken: string | undefined;
      try {
        idToken = await auth.currentUser?.getIdToken();
      } catch {
        throw new SummaryActionError('AUTH_REQUIRED');
      }

      if (!idToken) {
        throw new SummaryActionError('AUTH_REQUIRED');
      }

      const conversationText = buildBoundedTranscript(entry.messages);

      if (!conversationText.trim()) {
        throw new SummaryActionError('EMPTY_CONTENT');
      }

      let response: Response;
      try {
        response = await fetch('/api/summarize', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            text: conversationText,
            title: entry.title || 'Personal Reflection',
            supportCountry,
          }),
        });
      } catch {
        // Network failures use one generic retry message
        throw new SummaryActionError('GENERIC_RETRY');
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const code = typeof errData?.code === 'string' ? errData.code : '';
        if (response.status === 429 || code === 'RATE_LIMITED' || code === 'AI_RATE_LIMITED') {
          throw new SummaryActionError('RATE_LIMITED');
        }
        if (response.status === 401 || code === 'AUTH_REQUIRED' || code === 'INVALID_TOKEN') {
          throw new SummaryActionError('AUTH_REQUIRED');
        }
        if (response.status === 413 || code === 'CONVERSATION_TOO_LARGE' || code === 'PAYLOAD_TOO_LARGE') {
          throw new SummaryActionError('CONVERSATION_TOO_LARGE');
        }
        throw new SummaryActionError('GENERIC_RETRY');
      }

      let data: any;
      try {
        data = await response.json();
      } catch {
        throw new SummaryActionError('INVALID_SHAPE');
      }

      if (data?.safetyEscalated) {
        setCrisisAlert(
          typeof data.summary === 'string' && data.summary.trim()
            ? data.summary
            : 'Immediate support is available. If you are experiencing thoughts of self-harm or need urgent help, please call 110/119 or Taiwan 1925 Lifeline.'
        );
        setSummaryErrorCode(null);
        setSummarySuccess(false);
        return;
      }

      if (typeof data?.summary !== 'string' || !data.summary.trim()) {
        throw new SummaryActionError('INVALID_SHAPE');
      }

      if (!Array.isArray(data?.keyTakeaways)) {
        throw new SummaryActionError('INVALID_SHAPE');
      }

      const cleanedSummary = data.summary.trim().slice(0, 4000);
      const cleanedTakeaways = data.keyTakeaways
        .filter((item: unknown): item is string => typeof item === 'string')
        .map((item: string) => item.trim().slice(0, 240))
        .filter((item: string) => item.length > 0)
        .slice(0, 5);

      if (!cleanedSummary || cleanedTakeaways.length < 3 || cleanedTakeaways.length > 5) {
        throw new SummaryActionError('INVALID_SHAPE');
      }

      const saved = await onUpdateEntry({
        ...entry,
        latestSummary: cleanedSummary,
        keyTakeaways: cleanedTakeaways,
        updatedAt: Date.now(),
      });
      if (!saved) throw new SummaryActionError('GENERIC_RETRY');

      void dispatchNotification('summary_ready', `summary-ready:${entry.id}:${Date.now()}`)
        .catch(() => console.error('[Notification] Dispatch failed'));

      setCrisisAlert(null);
      setSummaryErrorCode(null);
      setSummarySuccess(true);
      setTimeout(() => setSummarySuccess(false), 4000);
    } catch (err: unknown) {
      console.error('[Summary] Request failed');
      if (err instanceof SummaryActionError) {
        setSummaryErrorCode(err.code);
      } else {
        setSummaryErrorCode('GENERIC_RETRY');
      }
    } finally {
      isSummarizingRef.current = false;
      setIsSummarizing(false);
    }
  };

  const handleCopyMessage = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedMessageId(id);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  const handleExportEntry = () => {
    let textContent = `# ${entry.title}\n${t('exportDate')}: ${new Date(entry.createdAt).toLocaleString(locale === 'zh-TW' ? 'zh-TW' : 'en-US')}\n${t('exportMood')}: ${entry.mood || t('exportNotAvailable')}\n${t('exportTags')}: ${entry.tags.join(', ') || t('exportNotAvailable')}\n`;

    if (entry.location) {
      const locationLabel = entry.location.label ? `${entry.location.label} — ` : '';
      textContent += `${t('exportLocation')}: ${locationLabel}${entry.location.latitude}, ${entry.location.longitude}\n${buildGoogleMapsUrl(entry.location)}\n`;
    }

    textContent += '\n';

    if (entry.latestSummary) {
      textContent += `## ${t('exportSummaryHeading')}\n\n${entry.latestSummary}\n\n`;
      if (entry.keyTakeaways && entry.keyTakeaways.length > 0) {
        textContent += `### ${t('exportTakeawaysHeading')}\n\n` + entry.keyTakeaways.map((t) => `- ${t}`).join('\n') + `\n\n`;
      }
      textContent += `---\n\n`;
    }

    textContent += entry.messages.map((m) => `### ${m.role === 'user' ? t('exportUserHeading') : `${t('exportAiHeading')} (${m.modelUsed || t('exportFallbackModel')})`} [${new Date(m.timestamp).toLocaleTimeString(locale === 'zh-TW' ? 'zh-TW' : 'en-US')}]\n\n${m.content}\n`).join('\n\n---\n\n');

    const blob = new Blob([textContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${entry.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'reflection'}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FAF8F5] overflow-hidden">
      {/* Top Bar / Header */}
      <div className="px-4 sm:px-6 py-3 sm:py-4 bg-white border-b border-[#E5DDD3] flex flex-col xl:flex-row xl:items-center justify-between gap-3 shrink-0">
        <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1 pr-24 xl:pr-0">
          <button
            onClick={onOpenSidebar}
            className="xl:hidden p-1.5 text-[#7A746B] hover:text-[#2B2926] rounded-xl hover:bg-[#EFE9E2] shrink-0 mt-0.5 sm:mt-0"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="min-w-0 flex-1">
            <input
              id="journal-title-input"
              type="text"
              value={entry.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder={t('titlePlaceholder')}
              maxLength={120}
              className="w-full font-serif font-bold text-xl sm:text-2xl text-[#2B2926] bg-transparent border-none focus:outline-hidden focus:ring-0 placeholder:text-[#C4BCB0] p-0 truncate"
            />
            <div className="flex flex-wrap items-center gap-x-2.5 sm:gap-x-3 gap-y-1 mt-1 text-xs text-[#8E877C] min-w-0">
              <span className="shrink-0">{new Date(entry.createdAt).toLocaleDateString(locale === 'zh-TW' ? 'zh-TW' : 'en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
              <span className="shrink-0">•</span>
              <span className="shrink-0">{entry.wordCount || 0} {t('wordsCount')}</span>
              <span className="shrink-0">•</span>
              {/* Firestore Isolation indicator */}
              <span className="font-mono text-[11px] text-[#554E45] bg-[#EFEAE2] px-2 py-0.5 rounded-md border border-[#DDD5C8] truncate max-w-full inline-block">
                /users/{entry.userId.slice(0, 6)}.../entries
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2 shrink-0 xl:pr-24">
          {/* Mood Selector */}
          <div className="relative">
            <button
              onClick={() => setShowMoodPicker(!showMoodPicker)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#ECE5DC] hover:bg-[#DFD7CC] border border-[#DDD5C8] text-[#443E36] rounded-xl text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Smile className="w-3.5 h-3.5 text-[#7A746B] shrink-0" />
              <span className="truncate">{moods.find((m) => m.id === entry.mood)?.emoji || '✨'} {moods.find((m) => m.id === entry.mood)?.label || t('setMood')}</span>
              <ChevronDown className="w-3 h-3 text-[#9A9287] shrink-0" />
            </button>

            {showMoodPicker && (
              <div className="absolute left-0 xl:left-auto xl:right-0 mt-1.5 w-40 bg-white border border-[#DDD5C8] rounded-xl shadow-lg p-1.5 z-20 space-y-0.5">
                {moods.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => handleSetMood(m.id)}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-[#443E36] hover:bg-[#EFEAE2] text-left transition-colors cursor-pointer"
                  >
                    <span>{m.emoji}</span>
                    <span>{m.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Explicit, consent-based location picker */}
          <button
            id="pin-location-btn"
            type="button"
            onClick={() => setShowLocationPicker(true)}
            title={entry.location ? t('editLocation') : t('pinLocation')}
            className={`flex max-w-48 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${
              entry.location
                ? 'border-[#D0DEC4] bg-[#EBF0E5] text-[#333D29] hover:bg-[#DEE8D6]'
                : 'border-[#DDD5C8] bg-[#ECE5DC] text-[#443E36] hover:bg-[#DFD7CC]'
            }`}
          >
            <MapPin className="h-3.5 w-3.5 shrink-0 text-[#5B6A4C]" />
            <span className="truncate">
              {entry.location?.label || (entry.location ? t('pinnedLocation') : t('pinLocation'))}
            </span>
          </button>

          {/* Create Reflection Summary Button */}
          <button
            id="create-summary-btn"
            onClick={handleCreateSummary}
            disabled={!hasMeaningfulContent || isSummarizing || isGenerating}
            title={
              !hasMeaningfulContent
                ? t('summaryTooltipEmpty')
                : isSummarizing
                ? t('summaryTooltipCreating')
                : entry.latestSummary
                ? t('summaryTooltipUpdate')
                : t('summaryTooltipCreate')
            }
            aria-label={t('summaryTooltipCreate')}
            className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-xl text-xs font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              entry.latestSummary
                ? 'bg-[#EBF0E5] hover:bg-[#DEE8D6] border-[#D0DEC4] text-[#333D29]'
                : 'bg-[#ECE5DC] hover:bg-[#DFD7CC] border-[#DDD5C8] text-[#443E36]'
            }`}
          >
            {isSummarizing ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#7A746B]" />
            ) : (
              <FileText className="w-3.5 h-3.5 text-[#5B6A4C]" />
            )}
            <span className="hidden sm:inline">
              {isSummarizing
                ? t('summarizing')
                : entry.latestSummary
                ? t('updateSummary')
                : t('createSummary')}
            </span>
          </button>

          {/* Export button */}
          <button
            id="export-entry-btn"
            onClick={handleExportEntry}
            title={t('exportTooltip')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#ECE5DC] hover:bg-[#DFD7CC] border border-[#DDD5C8] text-[#443E36] rounded-xl text-xs font-medium transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#7A746B]" />
            <span className="hidden sm:inline">{t('exportMarkdown')}</span>
          </button>

          {/* Delete button */}
          <button
            id="delete-entry-top-btn"
            onClick={() => onDeleteEntry(entry.id)}
            title={t('deleteReflectionHeaderTooltip')}
            className="p-1.5 text-[#9A9287] hover:text-[#9C3826] hover:bg-[#FCF0EC] rounded-xl transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tags Bar */}
      <div className="px-6 py-2 bg-[#F4EFEA] border-b border-[#E5DDD3] flex items-center gap-2 overflow-x-auto text-xs shrink-0">
        <TagIcon className="w-3.5 h-3.5 text-[#9A9287] shrink-0" />
        {entry.tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#E7E0D6] border border-[#D5CCC0] text-[#443E36] rounded-md text-[11px] font-medium"
          >
            #{tag}
            <button
              onClick={() => handleRemoveTag(tag)}
              className="text-[#8E877C] hover:text-[#2B2926] font-bold ml-0.5"
            >
              ×
            </button>
          </span>
        ))}

        {showTagInput ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAddTag(tagInput);
            }}
            className="inline-flex items-center"
          >
            <input
              type="text"
              placeholder={t('tagInputPlaceholder')}
              maxLength={40}
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              autoFocus
              className="px-2 py-0.5 bg-white border border-[#D0C7B9] rounded-md text-xs text-[#2B2926] w-28 focus:outline-hidden focus:ring-1 focus:ring-[#535C45]"
            />
          </form>
        ) : (
          <button
            onClick={() => setShowTagInput(true)}
            className="text-[11px] text-[#7A746B] hover:text-[#2B2926] font-medium px-2 py-0.5 hover:bg-[#E5DDD2] rounded-md transition-colors cursor-pointer"
          >
            {t('addTag')}
          </button>
        )}
      </div>

      {/* Summary Error Alert Banner */}
      {summaryError && (
        <div
          role="alert"
          className="px-6 py-2.5 bg-[#FCF0EC] border-b border-[#F2D0C4] text-[#8E3B24] text-xs flex items-center justify-between"
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 text-[#B8472B] shrink-0" />
            <span className="truncate">{summaryError}</span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={handleCreateSummary}
              disabled={isSummarizing || !hasMeaningfulContent}
              className="flex items-center gap-1 font-semibold underline hover:no-underline text-[#8E3B24] cursor-pointer disabled:opacity-40"
            >
              <RefreshCw className={`w-3 h-3 ${isSummarizing ? 'animate-spin' : ''}`} />
              {t('retry')}
            </button>
            <button
              onClick={() => setSummaryErrorCode(null)}
              className="text-[#B8472B] hover:text-[#5A1C0F] font-bold cursor-pointer"
              aria-label={t('dismissSummaryError')}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Summary Success Notification Banner */}
      {summarySuccess && (
        <div
          role="status"
          aria-live="polite"
          className="px-6 py-2 bg-[#EBF0E5] border-b border-[#D0DEC4] text-[#333D29] text-xs flex items-center justify-between"
        >
          <div className="flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-[#5B6A4C]" />
            <span>{t('summaryUpdatedNotice')}</span>
          </div>
          <button
            onClick={() => setSummarySuccess(false)}
            className="text-[#5B6A4C] hover:text-[#2B3521] font-bold cursor-pointer"
            aria-label={t('dismissSummarySuccess')}
          >
            ×
          </button>
        </div>
      )}

      {/* Chat Error Alert Banner */}
      {chatError && (
        <div
          role="alert"
          aria-live="assertive"
          className="px-6 py-2.5 bg-[#FCF0EC] border-b border-[#F2D0C4] text-[#8E3B24] text-xs flex items-center justify-between"
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 text-[#B8472B] shrink-0" />
            <span className="truncate">{chatError}</span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              id="retry-chat-btn"
              onClick={handleRetryChat}
              disabled={isGenerating}
              className="flex items-center gap-1 font-semibold underline hover:no-underline text-[#8E3B24] cursor-pointer disabled:opacity-40"
            >
              <RefreshCw className={`w-3 h-3 ${isGenerating ? 'animate-spin' : ''}`} />
              {t('retry')}
            </button>
            <button
              onClick={() => setChatErrorCode(null)}
              className="text-[#B8472B] hover:text-[#5A1C0F] font-bold cursor-pointer"
              aria-label={t('dismissChatError')}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Save Error Alert Banner if any */}
      {saveError && (
        <div className="px-6 py-2.5 bg-[#FCF0EC] border-b border-[#F2D0C4] text-[#8E3B24] text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#B8472B] shrink-0" />
            <span>{saveError}</span>
          </div>
          <button
            onClick={onRetrySave}
            className="flex items-center gap-1 font-semibold underline hover:no-underline text-[#8E3B24] cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            {t('retrySave')}
          </button>
        </div>
      )}

      {/* Dialogue / Reflections Scroll Area */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-8 py-6 space-y-6">
        {/* Crisis Support Banner if triggered */}
        {crisisAlert && (
          <div
            role="alert"
            aria-live="assertive"
            className="max-w-3xl mx-auto p-5 bg-[#FCF0EC] border-2 border-[#E8B5A7] rounded-2xl text-[#6B2012] shadow-2xs space-y-3"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 font-serif font-bold text-base text-[#8E2815]">
                <AlertTriangle className="w-5 h-5 text-[#A83823] shrink-0" />
                <span>{t('crisisBannerTitle')}</span>
              </div>
              <button
                onClick={() => setCrisisAlert(null)}
                className="text-xs font-medium px-2.5 py-1 bg-white/80 hover:bg-white text-[#8E2815] rounded-lg border border-[#E8B5A7] transition-colors cursor-pointer"
                aria-label={t('dismissCrisisAlert')}
              >
                {t('dismissBtn')}
              </button>
            </div>
            <div className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap text-[#5A1C0F] markdown-body">
              <ReactMarkdown>{crisisAlert}</ReactMarkdown>
            </div>
          </div>
        )}

        {/* Reflection Insights Card */}
        {entry.latestSummary && (
          <section
            id="reflection-insights-card"
            aria-label={t('reflectionInsightsTitle')}
            className="max-w-3xl mx-auto bg-white border border-[#E0D8CE] rounded-2xl p-5 sm:p-6 shadow-2xs space-y-4"
          >
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#EFE9E2]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#EBF0E5] text-[#404835] flex items-center justify-center shrink-0 shadow-2xs">
                  <Sparkles className="w-4 h-4 text-[#4D633E]" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base text-[#2B2926]">
                    {t('reflectionInsightsTitle')}
                  </h3>
                  <p className="text-[11px] text-[#8E877C]">
                    {t('reflectionInsightsSub')}
                  </p>
                </div>
              </div>

              <button
                onClick={handleCreateSummary}
                disabled={isSummarizing || isGenerating}
                title={t('regenerateSummaryTooltip')}
                aria-label={t('regenerateSummaryTooltip')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#443E36] bg-[#ECE5DC] hover:bg-[#DFD7CC] rounded-xl border border-[#DDD5C8] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus:outline-hidden focus:ring-2 focus:ring-[#404835]"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSummarizing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{isSummarizing ? t('updating') : t('updateSummary')}</span>
              </button>
            </div>

            {/* Summary section */}
            <div className="space-y-1.5">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[#7A746B]">
                {t('summarySectionTitle')}
              </h4>
              <p className="text-sm text-[#33312E] leading-relaxed whitespace-pre-wrap">
                {entry.latestSummary}
              </p>
            </div>

            {/* Key Takeaways */}
            {entry.keyTakeaways && entry.keyTakeaways.length > 0 && (
              <div className="space-y-2 pt-3 border-t border-[#F2ECE4]">
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[#7A746B]">
                  {t('keyTakeawaysTitle')}
                </h4>
                <ul className="space-y-2" role="list">
                  {entry.keyTakeaways.map((takeaway, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-[#443E36]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#5B6A4C] mt-2 shrink-0" aria-hidden="true" />
                      <span className="leading-relaxed">{takeaway}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}
        {entry.messages.length === 0 ? (
          <div className="max-w-2xl mx-auto py-8 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[#EBF0E5] text-[#404835] flex items-center justify-center mx-auto mb-4 shadow-2xs">
              <Sparkles className="w-6 h-6 text-[#404835]" />
            </div>
            <h3 className="font-serif font-bold text-2xl text-[#2B2926]">{t('exploringHeadline')}</h3>
            <p className="mt-2 text-sm text-[#6B655B] max-w-md mx-auto leading-relaxed">
              {t('exploringSubheadline')}
            </p>

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
              {promptSuggestions.slice(0, 4).map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(prompt)}
                  className="p-3.5 bg-white hover:bg-[#F7F2EB] border border-[#E5DDD3] rounded-xl text-xs text-[#443E36] transition-all hover:shadow-2xs text-left cursor-pointer flex flex-col justify-between"
                >
                  <span className="font-medium text-[#2B2926] leading-relaxed">{prompt}</span>
                  <span className="mt-2 text-[10px] text-[#4F5A41] flex items-center gap-1 font-medium">
                    <Sparkles className="w-2.5 h-2.5 text-[#5B6A4C]" /> {t('startWithPrompt')}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          entry.messages.map((message) => {
            const isUser = message.role === 'user';
            const isCopied = copiedMessageId === message.id;

            return (
              <div
                key={message.id}
                className={`flex gap-3 max-w-3xl mx-auto ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-xl bg-[#404835] text-[#DCE7D0] flex items-center justify-center shrink-0 mt-1 shadow-2xs">
                    <Sparkles className="w-4 h-4 text-[#D8E6C8]" />
                  </div>
                )}

                <div
                  className={`group relative rounded-2xl p-4 sm:p-5 shadow-2xs transition-all max-w-[85%] ${
                    isUser
                      ? 'bg-[#404835] text-[#FAF8F5] rounded-tr-xs'
                      : 'bg-white border border-[#E0D8CE] text-[#33312E] rounded-tl-xs'
                  }`}
                >
                  {/* Header info */}
                  <div className="flex items-center justify-between gap-4 mb-2 pb-1.5 border-b border-white/10 text-[11px]">
                    <span className={`font-semibold ${isUser ? 'text-[#DDE8D2]' : 'text-[#2B2926] flex items-center gap-1.5'}`}>
                      {isUser ? t('yourReflection') : t('geminiCompanion')}
                      {!isUser && message.modelUsed && (
                        <span className="px-1.5 py-0.2 bg-[#EBF0E5] text-[#404835] border border-[#D5E0CC] font-mono text-[10px] rounded font-medium">
                          {message.modelUsed}
                        </span>
                      )}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] ${isUser ? 'text-[#B8C8AA]' : 'text-[#8E877C]'}`}>
                        {new Date(message.timestamp).toLocaleTimeString(locale === 'zh-TW' ? 'zh-TW' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <button
                        title={t('copyContentTooltip')}
                        onClick={() => handleCopyMessage(message.id, message.content)}
                        className={`p-1 rounded opacity-60 hover:opacity-100 transition-opacity cursor-pointer ${
                          isUser ? 'hover:bg-[#32392A] text-[#FAF8F5]' : 'hover:bg-[#EFEAE2] text-[#6B655B]'
                        }`}
                      >
                        {isCopied ? <Check className="w-3.5 h-3.5 text-[#547348]" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className={`prose prose-sm max-w-none leading-relaxed break-words ${
                    isUser ? 'text-[#FAF8F5] prose-invert' : 'text-[#33312E]'
                  }`}>
                    {isUser ? (
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    ) : (
                      <div className="markdown-body">
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>

                {isUser && (
                  <div className="w-8 h-8 rounded-xl bg-[#E5DDD2] text-[#404835] border border-[#DDD5C8] flex items-center justify-center shrink-0 mt-1 font-serif font-bold text-xs">
                    {t('youBadge')}
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Loading indicator */}
        {isGenerating && (
          <div className="flex gap-3 max-w-3xl mx-auto justify-start">
            <div className="w-8 h-8 rounded-xl bg-[#404835] text-[#DCE7D0] flex items-center justify-center shrink-0 mt-1 animate-pulse">
              <Sparkles className="w-4 h-4 text-[#D8E6C8]" />
            </div>
            <div className="bg-white border border-[#E0D8CE] rounded-2xl rounded-tl-xs p-4 text-xs text-[#6B655B] flex items-center gap-3 shadow-2xs">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-[#8E877C] animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-[#8E877C] animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-[#8E877C] animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span>{t('reflectingStatus')}</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input / Control Station */}
      <section
        id="reflection-composer-station"
        role="region"
        aria-label={t('composerRegionLabel')}
        className="p-3 sm:p-4 md:p-6 bg-white border-t border-[#E5DDD3] shadow-xs shrink-0"
      >
        <div className="max-w-3xl mx-auto">
          {isComposerExpanded ? (
            <div id="reflection-composer-body" className="space-y-2.5 sm:space-y-3">
              {/* Header: Mode Pill Bar + Collapse Button */}
              <div className="flex items-center gap-2 w-full">
                {/* AI Lens region: constrained, scrolls horizontally */}
                <div
                  className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden touch-pan-x pb-1.5 pt-0.5"
                  style={{ touchAction: 'pan-x pan-y' }}
                >
                  <div className="inline-flex items-center gap-1.5 whitespace-nowrap min-w-max">
                    <span className="text-[11px] font-semibold text-[#7A746B] uppercase tracking-wider mr-1 shrink-0 select-none">
                      {t('aiLensLabel')}
                    </span>
                    {modes.map((mode) => {
                      const isActive = activeMode === mode.id;
                      return (
                        <button
                          key={mode.id}
                          id={`mode-btn-${mode.id}`}
                          type="button"
                          onClick={() => setActiveMode(mode.id)}
                          title={mode.desc}
                          className={`flex items-center gap-1.5 px-3 py-1 rounded-full font-medium whitespace-nowrap shrink-0 transition-all cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[#404835] focus:ring-offset-1 ${
                            isActive
                              ? 'bg-[#404835] text-[#FAF8F5] shadow-2xs'
                              : 'bg-[#ECE5DC] text-[#554E44] hover:bg-[#DFD7CC] border border-[#DDD5C8]'
                          }`}
                        >
                          {mode.icon}
                          <span>{mode.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Always-visible Collapse Action */}
                <div className="flex-none shrink-0 self-center">
                  <button
                    id="composer-collapse-btn"
                    type="button"
                    onClick={() => setIsComposerExpanded(false)}
                    aria-expanded={true}
                    aria-controls="reflection-composer-body"
                    aria-label={t('collapseComposer')}
                    title={t('collapseComposer')}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#6B655B] hover:text-[#2B2926] bg-[#FAF8F5] hover:bg-[#EFE9E2] border border-[#DDD5C8] rounded-xl transition-colors cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[#404835] focus:ring-offset-1"
                  >
                    <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                    <span className="hidden sm:inline shrink-0">{t('collapseComposer')}</span>
                  </button>
                </div>
              </div>

              {/* Text input area */}
              <div className="relative border border-[#D8CFC3] focus-within:border-[#404835] rounded-2xl bg-[#FAF8F5] p-2 sm:p-2.5 transition-colors">
                <textarea
                  id="reflection-textarea"
                  ref={textareaRef}
                  rows={2}
                  maxLength={MAX_MESSAGE_CHARS}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder={t('reflectionInputPlaceholder')}
                  className="w-full bg-transparent text-sm text-[#2B2926] placeholder:text-[#9A9287] border-none focus:outline-hidden resize-none leading-relaxed min-h-[48px] sm:min-h-[64px]"
                />

                <div className="flex items-center justify-between pt-1.5 sm:pt-2 border-t border-[#EAE3DA] mt-1">
                  <div className="text-[11px] text-[#8E877C]">
                    {inputText.length > 0 && `${inputText.split(/\s+/).filter(Boolean).length} ${t('wordsCount')} • `}
                    <span>{t('inputModeLabel')} <strong>{modes.find((m) => m.id === activeMode)?.label}</strong></span>
                  </div>

                  <button
                    id="send-reflection-btn"
                    onClick={() => handleSendMessage()}
                    disabled={!inputText.trim() || isGenerating}
                    className="flex items-center gap-2 px-3.5 sm:px-4 py-1.5 sm:py-2 bg-[#404835] hover:bg-[#32392A] text-[#FAF8F5] rounded-xl text-xs font-semibold shadow-2xs disabled:opacity-40 transition-all cursor-pointer"
                  >
                    <span>{isGenerating ? t('reflectingStatus') : t('sendReflection')}</span>
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Collapsed State Bar */
            <div
              id="reflection-composer-collapsed"
              className="flex items-center justify-between gap-3 py-0.5"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                <span className="text-[11px] font-semibold text-[#7A746B] uppercase tracking-wider shrink-0">
                  {t('aiLensLabel')}
                </span>
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#404835] text-[#FAF8F5] shadow-2xs shrink-0">
                  {modes.find((m) => m.id === activeMode)?.icon}
                  <span>{modes.find((m) => m.id === activeMode)?.label}</span>
                </div>
                {inputText.trim().length > 0 && (
                  <span className="text-xs text-[#8E877C] truncate italic">
                    ({inputText.split(/\s+/).filter(Boolean).length} {t('wordsCount')})
                  </span>
                )}
              </div>

              {/* Expand Action Button */}
              <div className="flex-none shrink-0">
                <button
                  id="composer-expand-btn"
                  type="button"
                  onClick={() => setIsComposerExpanded(true)}
                  aria-expanded={false}
                  aria-controls="reflection-composer-body"
                  aria-label={t('expandComposer')}
                  title={t('expandComposer')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#FAF8F5] bg-[#404835] hover:bg-[#32392A] rounded-xl shadow-2xs transition-colors cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[#404835] focus:ring-offset-1"
                >
                  <ChevronUp className="w-3.5 h-3.5 shrink-0" />
                  <span>{t('expandComposer')}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {showLocationPicker && (
        <LocationPicker
          value={entry.location}
          onSave={handleSaveLocation}
          onRemove={handleRemoveLocation}
          onClose={() => setShowLocationPicker(false)}
        />
      )}
    </div>
  );
};
