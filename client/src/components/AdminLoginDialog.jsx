import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { AlertIcon, XIcon } from './Icons.jsx';

const inputCls =
  'w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-base outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-600/15';

// The settings page changes things for everyone, so the gear on the login page asks for an administrator account first.
export default function AdminLoginDialog({ onSuccess, onClose }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const first = useRef(null);

  useEffect(() => {
    first.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function submit(e) {
    e.preventDefault();
    if (!username.trim() || !password) return setError('กรุณาป้อนชื่อผู้ใช้งานและรหัสผ่าน');
    setBusy(true);
    setError('');
    try {
      const res = await api('/auth/login', { method: 'POST', body: { username, password } });
      if (!res.user.isAdmin) return setError('บัญชีนี้ไม่มีสิทธิ์ตั้งค่าระบบ');
      onSuccess(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-login-title"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-sm space-y-4 rounded-3xl bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <h2 id="admin-login-title" className="text-lg font-semibold">
              ตั้งค่าระบบ
            </h2>
            <p className="text-sm text-slate-500">เข้าสู่ระบบด้วยบัญชีผู้ดูแลเพื่อเปิดหน้าตั้งค่า</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100" aria-label="ปิด">
            <XIcon />
          </button>
        </div>
        <input
          ref={first}
          className={inputCls}
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          autoCapitalize="none"
        />
        <input
          className={inputCls}
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
        {error && (
          <p className="flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-700" role="alert">
            <AlertIcon className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-teal-700 px-4 py-3 font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
        >
          {busy ? 'Checking…' : 'เปิดหน้าตั้งค่า'}
        </button>
      </form>
    </div>
  );
}
