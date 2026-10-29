import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { HandIcon, RobotIcon, XIcon } from './Icons.jsx';

function LocationBadge({ location }) {
  const robot = location === 'Robot';
  const Icon = robot ? RobotIcon : HandIcon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${robot ? 'bg-sky-50 text-sky-700' : 'bg-violet-50 text-violet-700'}`}
    >
      <Icon className="size-3.5" />
      {location}
    </span>
  );
}

export default function OrderDetailDialog({ order, typeName, onClose }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/orders/${encodeURIComponent(order.rxNumber)}/items`)
      .then((d) => setItems(d.items))
      .catch((e) => setError(e.message));
  }, [order.rxNumber]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-title"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
      >
        <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-teal-700">ใบสั่งยา {order.rxNumber}</p>
            <h2 id="detail-title" className="truncate text-lg font-semibold">
              {order.patientName}
            </h2>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100" aria-label="ปิด">
            <XIcon />
          </button>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 bg-slate-50 px-5 py-3 text-sm sm:grid-cols-4">
          {[
            ['HN', order.hn],
            ['AN', order.an],
            ['หอผู้ป่วย', order.wardName],
            ['ประเภท', typeName],
            ['วันเวลาที่สั่ง', order.orderedAt],
            ['ผู้จัดยา', order.matchedBy],
            ['เวลาจัดยา', order.matchedAt],
          ].map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="text-xs text-slate-400">{k}</dt>
              <dd className="truncate font-medium">{v || '-'}</dd>
            </div>
          ))}
        </dl>

        <div className="overflow-y-auto">
          {error && <p className="px-5 py-4 text-sm text-red-700">{error}</p>}
          {!items && !error && <p className="px-5 py-10 text-center text-slate-400">กำลังโหลด…</p>}
          {items?.length === 0 && <p className="px-5 py-10 text-center text-slate-400">ไม่พบรายการยา</p>}
          {items?.length > 0 && (
            <ul className="divide-y divide-slate-100">
              {items.map((it, i) => (
                <li key={`${it.itemCode}-${i}`} className="flex gap-3 px-5 py-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-teal-50 text-xs font-semibold text-teal-700">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-medium">{it.drugName}</span>
                      <span className="text-xs text-slate-400">{it.itemCode}</span>
                    </div>
                    {it.usage && <p className="text-sm text-slate-500">{it.usage}</p>}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-lg font-semibold tabular-nums">{it.qty}</span>
                    <LocationBadge location={it.location} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
