import React, { useEffect, useState } from 'react';
import { Bell, CheckCircle2, X } from 'lucide-react';
import { NotificationPreferences, UserProfile } from '../types';
import { getNotificationPreferences, saveNotificationPreferences } from '../lib/firebase';
import { dispatchNotification } from '../lib/api';
import { useLanguage } from '../i18n/LanguageContext';

const DEFAULTS: NotificationPreferences = {
  enabled: false,
  email: false,
  slack: false,
  discord: false,
  eventTypes: ['summary_ready', 'manual_test'],
  consentVersion: '2026-09-04',
  updatedAt: 0,
};

export function NotificationSettings({ user, onClose }: { user: UserProfile; onClose: () => void }) {
  const { locale } = useLanguage();
  const zh = locale === 'zh-TW';
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULTS);
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<'loading' | 'idle' | 'saving' | 'saved' | 'error'>('loading');

  useEffect(() => {
    void getNotificationPreferences(user.uid)
      .then((value) => {
        setPreferences(value);
        setConsent(value.enabled);
        setStatus('idle');
      })
      .catch(() => setStatus('error'));
  }, [user.uid]);

  const updateChannel = (channel: 'email' | 'slack' | 'discord') => {
    setPreferences((current) => ({ ...current, [channel]: !current[channel] }));
  };

  const save = async () => {
    setStatus('saving');
    try {
      const next = { ...preferences, enabled: consent, updatedAt: Date.now() };
      await saveNotificationPreferences(user.uid, next);
      setPreferences(next);
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  };

  const sendTest = async () => {
    setStatus('saving');
    try {
      await dispatchNotification('manual_test', `manual-test:${user.uid}:${Date.now()}`);
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2B2926]/50 p-4" role="presentation">
      <section className="w-full max-w-lg rounded-2xl border border-[#D8D1C7] bg-[#FAF8F5] p-6 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="notification-settings-title">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="notification-settings-title" className="font-serif text-xl font-bold text-[#2B2926]">
              {zh ? '外部通知設定' : 'External notification settings'}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#6B655B]">
              {zh
                ? '通知採預設關閉。外部平台只會收到事件名稱與登入連結，不會收到日記、摘要、位置、危機原文或憑證。'
                : 'Notifications are off by default. External services receive only an event label and sign-in link—never journal text, summaries, location, crisis text, or credentials.'}
            </p>
          </div>
          <button onClick={onClose} aria-label={zh ? '關閉通知設定' : 'Close notification settings'} className="rounded-lg p-2 hover:bg-[#EFEAE2]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {(['email', 'slack', 'discord'] as const).map((channel) => (
            <label key={channel} className="flex items-center justify-between rounded-xl border border-[#DDD6CC] bg-white px-4 py-3">
              <span className="font-medium capitalize text-[#2B2926]">{channel === 'email' ? 'Gmail' : channel}</span>
              <input type="checkbox" checked={preferences[channel]} onChange={() => updateChannel(channel)} className="h-4 w-4" />
            </label>
          ))}
        </div>

        <label className="mt-5 flex items-start gap-3 rounded-xl bg-[#EBF0E5] p-4 text-sm text-[#404835]">
          <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-0.5 h-4 w-4" />
          <span>
            {zh
              ? '我選擇啟用上述通知，並了解訊息送出後會由外部平台依其政策保存。取消勾選並儲存即可停止後續通知。'
              : 'I choose to enable these notifications and understand that external services retain delivered messages under their own policies. Uncheck and save to stop future notifications.'}
          </span>
        </label>

        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <button onClick={sendTest} disabled={!preferences.enabled || status === 'saving'} className="rounded-xl border border-[#AFA79C] px-4 py-2 text-sm disabled:opacity-50">
            {zh ? '傳送最小資料測試通知' : 'Send minimal test notification'}
          </button>
          <button onClick={save} disabled={status === 'loading' || status === 'saving'} className="rounded-xl bg-[#404835] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {status === 'saving' ? (zh ? '儲存中…' : 'Saving…') : (zh ? '儲存設定' : 'Save settings')}
          </button>
        </div>
        {status === 'saved' && <p role="status" className="mt-3 flex items-center gap-2 text-sm text-[#3F6844]"><CheckCircle2 className="h-4 w-4" />{zh ? '設定已儲存。' : 'Settings saved.'}</p>}
        {status === 'error' && <p role="alert" className="mt-3 text-sm text-[#A83823]">{zh ? '操作失敗，請稍後再試。' : 'The operation failed. Please try again.'}</p>}
      </section>
    </div>
  );
}
