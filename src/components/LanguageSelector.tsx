import React from 'react';
import { Globe, ChevronDown } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { SupportedLocale } from '../i18n/types';

interface LanguageSelectorProps {
  id?: string;
  variant?: 'landing' | 'sidebar' | 'editor';
  className?: string;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  id = 'language-selector',
  variant = 'landing',
  className = '',
}) => {
  const { locale, setLocale, t } = useLanguage();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextLocale = e.target.value as SupportedLocale;
    if (nextLocale === 'en' || nextLocale === 'zh-TW') {
      setLocale(nextLocale);
    }
  };

  const isLanding = variant === 'landing';
  const isSidebar = variant === 'sidebar';

  return (
    <div
      className={`relative inline-flex items-center ${
        isSidebar ? 'w-full' : ''
      } ${className}`}
    >
      <label htmlFor={id} className="sr-only">
        {t('language')}
      </label>

      <div
        className={`w-full flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-colors cursor-pointer focus-within:outline-hidden focus-within:ring-2 focus-within:ring-[#404835] focus-within:ring-offset-2 focus-within:border-[#404835] ${
          isLanding
            ? 'bg-[#ECE6DC] hover:bg-[#DFD7CC] border-[#DDD5C9] text-[#33312E] shadow-2xs focus-within:ring-offset-[#FAF8F5]'
            : isSidebar
            ? 'bg-[#FAF8F5] hover:bg-[#FAF6F0] border-[#E5DDD3] text-[#443E36] focus-within:ring-offset-[#EFE9E2]'
            : 'bg-[#ECE5DC] hover:bg-[#DFD7CC] border-[#DDD5C8] text-[#443E36] focus-within:ring-offset-[#FAF8F5]'
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0 pointer-events-none">
          <Globe
            className={`w-3.5 h-3.5 shrink-0 ${
              isLanding ? 'text-[#4D5A3F]' : 'text-[#6B655B]'
            }`}
            aria-hidden="true"
          />
          <span className="text-[11px] font-medium text-[#7A746B] hidden sm:inline">
            {t('language')}:
          </span>
          <span className="font-semibold text-[#2B2926] truncate">
            {locale === 'zh-TW' ? t('languageNameZh') : t('languageNameEn')}
          </span>
        </div>

        <ChevronDown
          className="w-3 h-3 text-[#9A9287] shrink-0 pointer-events-none ml-1"
          aria-hidden="true"
        />

        {/* Fully keyboard-accessible native select overlay with complete ARIA support */}
        <select
          id={id}
          value={locale}
          onChange={handleChange}
          aria-label={t('language')}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer text-xs focus:outline-hidden rounded-xl"
        >
          <option value="en">{t('languageNameEn')} (English)</option>
          <option value="zh-TW">{t('languageNameZh')} (Traditional Chinese)</option>
        </select>
      </div>
    </div>
  );
};
