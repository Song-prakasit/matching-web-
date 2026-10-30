import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { AuditPanel, UsersPanel } from './AdminPanels.jsx';
import Logo from './Logo.jsx';
import { AlertIcon, XIcon } from './Icons.jsx';

const LOGO_SIZE = 256;

const inputCls =
  'w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-base outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-600/15';

// Shrinks the picked image to fit in 256x256 so the saved file stays small. PNG keeps transparency.
function resizeToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, LOGO_SIZE / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('เปิดไฟล์รูปไม่ได้ กรุณาเลือกไฟล์ PNG, JPG หรือ WebP'));
    };
    img.src = url;
  });
}

export default function SettingsDialog({ branding, onSaved, onClose }) {
  const [form, setForm] = useState(branding);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState('login');
  const fileInput = useRef(null);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function pickLogo(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    try {
      setForm((f) => ({ ...f, logo: '' }));
      const logo = await resizeToDataUrl(file);
      setForm((f) => ({ ...f, logo }));
    } catch (err) {
      setError(err.message);
    }
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      onSaved(await api('/branding', { method: 'PUT', body: form }));
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4" onClick={onClose}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onClick={(e) => e.stopPropagation()}
        onSubmit={save}
        className="flex max-h-[90dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
      >
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
          <h2 id="settings-title" className="flex-1 text-lg font-semibold">
            ตั้งค่าระบบ
          </h2>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100" aria-label="ปิด">
            <XIcon />
          </button>
        </div>

        <div className="flex gap-1 border-b border-slate-100 px-5 py-2 text-sm font-medium" role="tablist">
          {[
            ['login', 'หน้า login'],
            ['users', 'ผู้ใช้งาน'],
            ['audit', 'ประวัติการใช้งาน'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`rounded-lg px-3 py-1.5 ${tab === key ? 'bg-teal-50 text-teal-800' : 'text-slate-500 hover:bg-slate-100'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'users' && (
          <div className="overflow-y-auto">
            <UsersPanel />
          </div>
        )}
        {tab === 'audit' && (
          <div className="overflow-y-auto">
            <AuditPanel />
          </div>
        )}

        <div className={`space-y-5 overflow-y-auto px-5 py-5 ${tab === 'login' ? '' : 'hidden'}`}>
          <div>
            <span className="mb-1.5 block text-sm font-medium text-slate-600">โลโก้</span>
            <div className="flex items-center gap-4">
              <div className="grid size-24 place-items-center rounded-2xl bg-slate-50 ring-1 ring-slate-200">
                <Logo src={form.logo} className="size-20" iconClass="size-9" alt="ตัวอย่างโลโก้" />
              </div>
              <div className="flex flex-col items-start gap-2">
                <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" onChange={pickLogo} hidden />
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
                >
                  เลือกไฟล์รูป
                </button>
                {form.logo && (
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, logo: '' }))}
                    className="text-sm text-slate-500 underline hover:text-slate-700"
                  >
                    ใช้โลโก้เริ่มต้น
                  </button>
                )}
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-400">PNG, JPG หรือ WebP (แนะนำภาพจัตุรัส พื้นหลังโปร่งใส) ระบบจะย่อให้อัตโนมัติ</p>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-600">ชื่อโรงพยาบาล</span>
            <input className={inputCls} value={form.hospitalName} onChange={set('hospitalName')} maxLength={80} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-600">หัวข้อหน้า login</span>
            <input className={inputCls} value={form.title} onChange={set('title')} maxLength={80} />
          </label>

          {error && (
            <p className="flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-700" role="alert">
              <AlertIcon className="mt-0.5 size-4 shrink-0" />
              {error}
            </p>
          )}
        </div>

        <div className={`flex justify-end gap-2 border-t border-slate-100 px-5 py-4 ${tab === 'login' ? '' : 'hidden'}`}>
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
            ยกเลิก
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
          >
            {busy ? 'กำลังบันทึก…' : 'บันทึก'}
          </button>
        </div>
      </form>
    </div>
  );
}
