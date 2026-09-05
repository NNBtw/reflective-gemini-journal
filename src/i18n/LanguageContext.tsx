import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { SupportedLocale, TranslationDictionary } from './types';
import { enTranslations } from './locales/en';
import { zhTWTranslations } from './locales/zh-TW';

export const LOCALE_STORAGE_KEY = 'reflectai.uiLocale.v1';

const dictionaries: Record<SupportedLocale, TranslationDictionary> = {
  en: enTranslations,
  'zh-TW': zhTWTranslations,
};

export function getInitialLocale(): SupportedLocale {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
      if (saved === 'en' || saved === 'zh-TW') {
        return saved;
      }
    }
  } catch {
    // Handle unavailable or blocked localStorage (e.g. SecurityError, private browsing)
  }

  try {
    if (typeof navigator !== 'undefined' && typeof navigator.language === 'string') {
      if (navigator.language.toLowerCase().startsWith('zh')) {
        return 'zh-TW';
      }
    }
  } catch {
    // Fallback if navigator is inaccessible
  }

  return 'en';
}

interface LanguageContextValue {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  t: (key: keyof TranslationDictionary) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<SupportedLocale>(getInitialLocale);

  const setLocale = useCallback((newLocale: SupportedLocale) => {
    setLocaleState(newLocale);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(LOCALE_STORAGE_KEY, newLocale);
      }
    } catch {
      // Gracefully handle unavailable or blocked localStorage
    }
  }, []);

  // Synchronize document.documentElement.lang whenever locale changes
  useEffect(() => {
    try {
      if (typeof document !== 'undefined' && document.documentElement) {
        document.documentElement.lang = locale;
      }
    } catch {
      // document.documentElement guard
    }
  }, [locale]);

  const t = useCallback(
    (key: keyof TranslationDictionary): string => {
      const currentDict = dictionaries[locale];
      const val = currentDict?.[key];
      if (typeof val === 'string' && val.length > 0) {
        return val;
      }
      // Missing translation keys fall back safely to English
      return enTranslations[key] || (key as string);
    },
    [locale]
  );

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
