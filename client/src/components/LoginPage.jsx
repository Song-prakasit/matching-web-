import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import AdminLoginDialog from './AdminLoginDialog.jsx';
import { AlertIcon, CameraIcon, SettingsIcon } from './Icons.jsx';
import FontSizeControl from './FontSizeControl.jsx';
import Logo from './Logo.jsx';

const CameraScanner = lazy(() => import('./CameraScanner.jsx'));

const inputCls =
  'w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-600/15';

export default function LoginPage({ dbMode, branding, onLogin }) {
  const [mode, setMode] = useState('password');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [camera, setCamera] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const firstInput = useRef(null);

  useEffect(() => {
    firstInput.current?.focus();
    setError('');
  }, [mode]);

  async function submit(body) {
    setBusy(true);
    setError('');
    try {
      onLogin(await api('/auth/login', { method: 'POST', body }), remember);
    } catch (e) {
      setError(e.message);
      if (mode === 'qr') setQrCode('');
      firstInput.current?.select();
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e) {
    e.preventDefault();
    if (mode === 'password') {
      if (!username.trim()) return setError('กรุณาป้อนชื่อผู้ใช้งาน');
      if (!password) return setError('กรุณาป้อนรหัสผ่าน');
      submit({ username, password });
    } else {
      if (!qrCode.trim()) return setError('กรุณาสแกน QR บัตรผู้ใช้งาน');
      submit({ qrCode });
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-sm">
        <form onSubmit={onSubmit} className="relative rounded-3xl bg-white p-6 shadow-xl shadow-slate-300/60 ring-1 ring-slate-200">
          <button
            type="button"
            onClick={() => setAdminOpen(true)}
            className="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="ตั้งค่าระบบ"
            title="ตั้งค่าระบบ"
          >
            <SettingsIcon className="size-5" />
          </button>
          <div className="mb-5 flex flex-col items-center text-center">
            <Logo src={branding.logo} className="mb-3 size-20 ring-4 ring-teal-100" alt="" />
            {branding.hospitalName && (
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{branding.hospitalName}</p>
            )}
            <h1 className="mt-1 text-2xl font-bold text-slate-800">{branding.title}</h1>
            <p className="mt-1 text-sm text-slate-500">เลือกเข้าใช้งานด้วยรหัสผ่าน หรือสแกนบาร์โค้ดได้เลย</p>
          </div>

          <div className="mb-5 grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-sm font-medium" role="tablist">
            {[
              ['password', 'Login'],
              ['qr', 'Scan Barcode'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={mode === key}
                onClick={() => setMode(key)}
                className={`rounded-lg px-3 py-2 transition ${mode === key ? 'bg-white text-slate-800 shadow' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === 'password' ? (
            <div className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-600">Username</span>
                <input
                  ref={firstInput}
                  className={inputCls}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  autoCapitalize="none"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-600">Password</span>
                <div className="relative">
                  <input
                    className={`${inputCls} pr-20`}
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-200"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="size-4 accent-teal-700"
                />
                Remember this session
              </label>
            </div>
          ) : (
            <div>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-600">Scan barcode</span>
                <input
                  ref={firstInput}
                  className={inputCls}
                  type="password"
                  value={qrCode}
                  onChange={(e) => setQrCode(e.target.value)}
                  placeholder="ยิงเครื่องสแกนที่บัตร"
                  autoComplete="off"
                />
              </label>
              <button
                type="button"
                onClick={() => setCamera(true)}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 font-medium text-teal-700 transition hover:bg-teal-100"
              >
                <CameraIcon /> Scan with camera
              </button>
            </div>
          )}

          {error && (
            <p className="mt-4 flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-700" role="alert">
              <AlertIcon className="mt-0.5 size-4 shrink-0" />
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-5 w-full rounded-xl bg-teal-700 px-4 py-3 font-semibold text-white shadow-lg shadow-teal-700/30 transition hover:bg-teal-800 disabled:opacity-60"
          >
            {busy ? 'Checking…' : 'Log in'}
          </button>
        </form>

        <FontSizeControl className="mt-4 justify-center text-slate-600" />

        {dbMode === 'mock' && (
          <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-center text-sm text-amber-800 ring-1 ring-amber-200">
            โหมดทดสอบ (ข้อมูลจำลอง) · ผู้ใช้ <b>demo</b> รหัส <b>Demo@Matching12</b> · QR <b>DEMO-QR-001</b>
          </p>
        )}
      </div>

      {adminOpen && (
        <AdminLoginDialog
          onClose={() => setAdminOpen(false)}
          onSuccess={(res) => onLogin(res, remember, { openSettings: true })}
        />
      )}

      {camera && (
        <Suspense fallback={null}>
          <CameraScanner
            title="สแกนบัตรผู้ใช้งาน"
            onClose={() => setCamera(false)}
            onResult={(text) => {
              setCamera(false);
              setQrCode(text);
              submit({ qrCode: text });
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
