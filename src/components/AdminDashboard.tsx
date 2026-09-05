import React, { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, X } from 'lucide-react';
import { UserProfile } from '../types';
import { applyRoleChange, getAdminOverview, reviewRoleChange } from '../lib/api';
import { useLanguage } from '../i18n/LanguageContext';

export function AdminDashboard({ user, onClose }: { user: UserProfile; onClose: () => void }) {
  const { locale } = useLanguage();
  const zh = locale === 'zh-TW';
  const [overview, setOverview] = useState<any>(null);
  const [targetUid, setTargetUid] = useState('');
  const [requestedRole, setRequestedRole] = useState<'user' | 'admin'>('admin');
  const [reason, setReason] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [review, setReview] = useState<any>(null);
  const [status, setStatus] = useState<'loading' | 'idle' | 'working' | 'done' | 'error'>('loading');
  const idempotencyKey = useMemo(() => `role-change:${user.uid}:${Date.now()}`, [user.uid]);

  useEffect(() => {
    void getAdminOverview().then((data) => {
      setOverview(data);
      setStatus('idle');
    }).catch(() => setStatus('error'));
  }, []);

  const input = { targetUid, requestedRole, reason, confirmation };
  const runReview = async () => {
    setStatus('working');
    try {
      setReview(await reviewRoleChange(input, idempotencyKey));
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  };
  const apply = async () => {
    setStatus('working');
    try {
      await applyRoleChange(input, idempotencyKey);
      setStatus('done');
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#2B2926]/50 p-4" role="presentation">
      <section className="mx-auto my-8 w-full max-w-3xl rounded-2xl bg-[#FAF8F5] p-6 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="admin-title">
        <div className="flex justify-between gap-4">
          <div><h2 id="admin-title" className="font-serif text-2xl font-bold">{zh ? '管理資訊主頁' : 'Administration overview'}</h2><p className="mt-1 text-sm text-[#6B655B]">{zh ? '不提供私人日記內容存取。' : 'Private journal content is not accessible here.'}</p></div>
          <button onClick={onClose} aria-label={zh ? '關閉管理主頁' : 'Close administration'}><X className="h-5 w-5" /></button>
        </div>

        {overview && <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border bg-white p-4"><p className="text-xs text-[#6B655B]">Role</p><p className="font-semibold">{overview.role}</p></div>
          <div className="rounded-xl border bg-white p-4"><p className="text-xs text-[#6B655B]">Privacy</p><p className="font-semibold">Minimal event only</p></div>
          {Object.entries(overview.services || {}).map(([key, value]) => <div key={key} className="rounded-xl border bg-white p-4"><p className="text-xs text-[#6B655B]">{key}</p><p className="font-semibold">{value ? 'Configured' : 'Not configured'}</p></div>)}
        </div>}

        {user.role === 'owner' && <div className="mt-7 border-t pt-6">
          <h3 className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-5 w-5" />{zh ? '管理員角色變更' : 'Administrator role change'}</h3>
          <p className="mt-2 text-sm text-[#6B655B]">{zh ? 'AI 僅提供 advisory review；deterministic server checks 才是授權 gate。' : 'AI is advisory only; deterministic server checks remain the authorization gate.'}</p>
          <div className="mt-4 grid gap-3">
            <input value={targetUid} onChange={(e) => { setTargetUid(e.target.value); setReview(null); }} placeholder="Target Firebase UID" className="rounded-xl border bg-white px-3 py-2" />
            <select value={requestedRole} onChange={(e) => { setRequestedRole(e.target.value as 'user' | 'admin'); setReview(null); }} className="rounded-xl border bg-white px-3 py-2"><option value="admin">Grant admin</option><option value="user">Revoke admin</option></select>
            <textarea value={reason} onChange={(e) => { setReason(e.target.value); setReview(null); }} placeholder={zh ? '稽核原因（至少 10 字元）' : 'Audit reason (at least 10 characters)'} className="rounded-xl border bg-white px-3 py-2" />
            <input value={confirmation} onChange={(e) => { setConfirmation(e.target.value); setReview(null); }} placeholder={requestedRole === 'admin' ? 'GRANT ADMIN' : 'REVOKE ADMIN'} className="rounded-xl border bg-white px-3 py-2" />
          </div>
          {review && <ul className="mt-4 space-y-1 text-sm">{review.checks.map((check: any) => <li key={check.check} className={check.passed ? 'text-[#3F6844]' : 'text-[#A83823]'}>{check.passed ? 'PASS' : 'FAIL'} — {check.check}</li>)}</ul>}
          <div className="mt-4 flex justify-end gap-3"><button onClick={runReview} disabled={status === 'working'} className="rounded-xl border px-4 py-2">{zh ? '執行安全檢查' : 'Run security review'}</button><button onClick={apply} disabled={!review?.allowedByDeterministicChecks || status === 'working'} className="rounded-xl bg-[#A83823] px-4 py-2 text-white disabled:opacity-40">{zh ? '套用角色變更' : 'Apply role change'}</button></div>
        </div>}
        {status === 'done' && <p role="status" className="mt-4 text-[#3F6844]">{zh ? '角色已更新；目標使用者需重新整理 Token。' : 'Role updated; the target user must refresh their token.'}</p>}
        {status === 'error' && <p role="alert" className="mt-4 text-[#A83823]">{zh ? '操作遭拒或暫時失敗。' : 'The operation was rejected or temporarily failed.'}</p>}
      </section>
    </div>
  );
}
