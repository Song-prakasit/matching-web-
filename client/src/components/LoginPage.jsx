import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { AlertIcon, CameraIcon, PillIcon } from './Icons.jsx';

const CameraScanner = lazy(() => import('./CameraScanner.jsx'));

const inputCls =
  'w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-600/15';

export default function LoginPage({ dbMode, onLogin }) {
  const [mode, setMode] = useState('password');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [camera, setCamera] = useState(false);
  const firstInput = useRef(null);

  useEffect(() => {
    firstInput.current?.focus();
    setError('');
  }, [mode]);

  async function submit(body) {
    setBusy(true);
    setError('');
    try {
      onLogin(await api('/auth/login', { method: 'POST', body }));
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
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-teal-700 via-teal-800 to-slate-900 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-white">
          <div className="mb-3 grid size-16 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
            <PillIcon className="size-8" />
          </div>
          <h1 className="text-2xl font-semibold">ระบบบันทึกจัดยา</h1>
          <p className="text-sm text-teal-100/80">Matching · ยืนยันการจัดยาตามใบสั่ง</p>
        </div>

        <form onSubmit={onSubmit} className="rounded-3xl bg-white p-6 shadow-2xl shadow-black/30">
          <div className="mb-5 grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-sm font-medium" role="tablist">
            {[
              ['password', 'ชื่อผู้ใช้ / รหัสผ่าน'],
              ['qr', 'สแกนบัตร QR'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={mode === key}
                onClick={() => setMode(key)}
                className={`rounded-lg px-3 py-2 transition ${mode === key ? 'bg-white text-teal-700 shadow' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === 'password' ? (
            <div className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-600">ชื่อผู้ใช้งาน</span>
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
                <span className="mb-1.5 block text-sm font-medium text-slate-600">รหัสผ่าน</span>
                <input
                  className={inputCls}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </label>
            </div>
          ) : (
            <div>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-600">สแกน QR บัตรผู้ใช้งาน</span>
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
                <CameraIcon /> ใช้กล้องสแกน
              </button>
            </div>
          )}

          {error && (
            <p className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700" role="alert">
              <AlertIcon className="mt-0.5 size-4 shrink-0" />
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-5 w-full rounded-xl bg-teal-700 px-4 py-3 font-semibold text-white shadow-lg shadow-teal-700/30 transition hover:bg-teal-800 disabled:opacity-60"
          >
            {busy ? 'กำลังตรวจสอบ…' : 'เข้าสู่ระบบ'}
          </button>
        </form>

        {dbMode === 'mock' && (
          <p className="mt-4 rounded-xl bg-amber-400/15 px-4 py-3 text-center text-sm text-amber-100 ring-1 ring-amber-300/30">
            โหมดทดสอบ (ข้อมูลจำลอง) · ผู้ใช้ <b>demo</b> รหัส <b>1234</b> · QR <b>DEMO-QR-001</b>
          </p>
        )}
      </div>

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
