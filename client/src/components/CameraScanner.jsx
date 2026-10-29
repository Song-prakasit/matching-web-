import { useEffect, useId, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { XIcon } from './Icons.jsx';

// Full-screen camera QR reader for tablets/phones. Browsers only allow the camera on
// https:// or localhost, so on plain http it explains that instead of failing silently.
export default function CameraScanner({ title, onResult, onClose }) {
  const regionId = 'qr-' + useId().replace(/:/g, '');
  const [error, setError] = useState(
    window.isSecureContext ? '' : 'เบราว์เซอร์อนุญาตให้ใช้กล้องเฉพาะเว็บที่เปิดผ่าน https:// เท่านั้น กรุณาให้ผู้ดูแลเปิด HTTPS หรือใช้เครื่องสแกนแทน',
  );
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    if (!window.isSecureContext) return;
    const reader = new Html5Qrcode(regionId, { verbose: false });
    let done = false;
    const started = reader
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: (w, h) => ({ width: Math.min(w, h) * 0.7, height: Math.min(w, h) * 0.7 }) },
        (text) => {
          if (done) return;
          done = true;
          navigator.vibrate?.(80);
          onResultRef.current(text);
        },
        () => {},
      )
      .catch(() => setError('เปิดกล้องไม่ได้ กรุณาอนุญาตการใช้กล้องในเบราว์เซอร์'));

    return () => {
      started.then(() => (reader.isScanning ? reader.stop() : null)).catch(() => {}).finally(() => reader.clear());
    };
  }, [regionId]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90" role="dialog" aria-modal="true" aria-label={title}>
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <h2 className="text-lg font-semibold">{title}</h2>
        <button onClick={onClose} className="rounded-full p-2 hover:bg-white/10" aria-label="ปิด">
          <XIcon className="size-6" />
        </button>
      </div>
      <div className="flex flex-1 items-center justify-center p-4">
        {error ? (
          <p className="max-w-sm rounded-xl bg-white p-5 text-center text-slate-700">{error}</p>
        ) : (
          <div id={regionId} className="w-full max-w-md overflow-hidden rounded-2xl" />
        )}
      </div>
      {!error && <p className="pb-8 text-center text-sm text-white/70">หันกล้องไปที่ QR Code</p>}
    </div>
  );
}
