import React, { useState } from 'react';
import { HeartHandshake, X } from 'lucide-react';
import { SafetyRegion, UserProfile } from '../types';
import { saveSafetyPreferences } from '../lib/firebase';
import { useLanguage } from '../i18n/LanguageContext';

export function SafetySettings({ user, value, onChange, onClose }: {
  user: UserProfile;
  value: SafetyRegion;
  onChange: (region: SafetyRegion) => void;
  onClose: () => void;
}) {
  const { locale } = useLanguage();
  const zh = locale === 'zh-TW';
  const [region, setRegion] = useState(value);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const save = async () => {
    setStatus('saving');
    try {
      await saveSafetyPreferences(user.uid, region);
      onChange(region);
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2B2926]/50 p-4" role="presentation">
    <section className="w-full max-w-lg rounded-2xl bg-[#FAF8F5] p-6 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="safety-settings-title">
      <div className="flex justify-between gap-4"><div><h2 id="safety-settings-title" className="flex items-center gap-2 font-serif text-xl font-bold"><HeartHandshake className="h-5 w-5" />{zh ? '安全資源地區' : 'Safety-resource region'}</h2><p className="mt-2 text-sm leading-relaxed text-[#6B655B]">{zh ? '請選擇您目前所在的國家／地區。系統不使用 GPS、日記位置或 Gemini 推測所在地；此設定只用於顯示 deterministic crisis resources。' : 'Choose where you are currently located. The app does not use GPS, pinned journal locations, or Gemini to infer this. The setting is used only for deterministic crisis resources.'}</p></div><button onClick={onClose} aria-label={zh ? '關閉安全設定' : 'Close safety settings'}><X className="h-5 w-5" /></button></div>
      <select value={region} onChange={(event) => setRegion(event.target.value as SafetyRegion)} className="mt-5 w-full rounded-xl border bg-white px-3 py-3">
        <option value="IN">India — 112／Tele-MANAS 14416</option>
        <option value="TW">Taiwan — 110／119／1925</option>
        <option value="EU">European Union — 112</option>
        <option value="GLOBAL">Global／Other — Find A Helpline</option>
      </select>
      <p className="mt-4 rounded-xl bg-[#F6E9E5] p-4 text-sm text-[#7B2E20]">{zh ? '本 App 不會自動撥號或通知第三方。若有立即危險，請主動聯絡當地緊急服務。' : 'This app never auto-dials or contacts a third party. If there is immediate danger, contact local emergency services directly.'}</p>
      <div className="mt-5 flex justify-end"><button onClick={save} disabled={status === 'saving'} className="rounded-xl bg-[#404835] px-4 py-2 text-white disabled:opacity-50">{status === 'saving' ? (zh ? '儲存中…' : 'Saving…') : (zh ? '儲存地區' : 'Save region')}</button></div>
      {status === 'saved' && <p role="status" className="mt-3 text-sm text-[#3F6844]">{zh ? '安全資源地區已儲存。' : 'Safety-resource region saved.'}</p>}
      {status === 'error' && <p role="alert" className="mt-3 text-sm text-[#A83823]">{zh ? '無法儲存，請稍後再試。' : 'Unable to save. Please try again.'}</p>}
    </section>
  </div>;
}
