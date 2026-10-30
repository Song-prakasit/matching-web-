import { useState } from 'react';
import { api } from '../api.js';
import { PASSWORD_POLICY_MESSAGE, meetsPasswordPolicy } from '../passwordPolicy.js';
import { AlertIcon } from './Icons.jsx';
import Logo from './Logo.jsx';

const inputCls =
  'w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-600/15';

// forced=true: the account's password is below the policy, so there is no way out except changing it (or logging out).
export default function ChangePasswordPage({ forced, branding, onDone, onCancel, onLogout }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    if (!current) return setError('กรุณาป้อนรหัสผ่านปัจจุบัน');
    if (!meetsPasswordPolicy(next)) return setError(PASSWORD_POLICY_MESSAGE);
    if (next !== confirm) return setError('ยืนยันรหัสผ่านใหม่ไม่ตรงกัน');
    setBusy(true);
    setError('');
    try {
      onDone(await api('/auth/password', { method: 'POST', body: { currentPassword: current, newPassword: next } }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const field = (label, value, set, auto) => (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-600">{label}</span>
      <input className={inputCls} type="password" value={value} onChange={(e) => set(e.target.value)} autoComplete={auto} />
    </label>
  );

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-100 px-4 py-10">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-3xl bg-white p-6 shadow-xl shadow-slate-300/60 ring-1 ring-slate-200">
        <div className="flex flex-col items-center text-center">
          <Logo src={branding.logo} className="mb-3 size-16" iconClass="size-8" />
          <h1 className="text-xl font-bold text-slate-800">เปลี่ยนรหัสผ่าน</h1>
          <p className="mt-1 text-sm text-slate-500">
            {forced ? 'รหัสผ่านเดิมไม่เป็นไปตามเกณฑ์ใหม่ กรุณาตั้งรหัสผ่านใหม่ก่อนใช้งาน' : PASSWORD_POLICY_MESSAGE}
          </p>
        </div>

        {field('รหัสผ่านปัจจุบัน', current, setCurrent, 'current-password')}
        {field('รหัสผ่านใหม่', next, setNext, 'new-password')}
        {field('ยืนยันรหัสผ่านใหม่', confirm, setConfirm, 'new-password')}
        {forced && <p className="text-xs text-slate-500">{PASSWORD_POLICY_MESSAGE}</p>}

        {error && (
          <p className="flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-700" role="alert">
            <AlertIcon className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-teal-700 px-4 py-3 font-semibold text-white shadow-lg shadow-teal-700/30 transition hover:bg-teal-800 disabled:opacity-60"
        >
          {busy ? 'กำลังบันทึก…' : 'บันทึกรหัสผ่านใหม่'}
        </button>
        <button
          type="button"
          onClick={forced ? onLogout : onCancel}
          className="w-full rounded-xl px-4 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-100"
        >
          {forced ? 'ออกจากระบบ' : 'ยกเลิก'}
        </button>
      </form>
    </div>
  );
}
