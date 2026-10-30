import { useEffect, useState } from 'react';
import { api } from '../api.js';

const Stat = ({ label, value, tone }) => (
  <div className={`rounded-xl px-4 py-3 ${tone}`}>
    <p className="text-xs font-medium opacity-80">{label}</p>
    <p className="text-2xl font-bold tabular-nums">{value}</p>
  </div>
);

// Totals for the chosen day. `refreshKey` changes after each scan or cancel so the numbers stay current.
export default function SummaryCard({ date, refreshKey, onShowPending }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api(`/summary?date=${date}`)
      .then((d) => !cancelled && (setData(d), setError('')))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [date, refreshKey]);

  if (error) return <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>;
  if (!data) return null;

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="จ่ายยาทั้งหมด" value={data.total} tone="bg-slate-50 text-slate-800" />
        <Stat label="จัดยาแล้ว" value={data.matched} tone="bg-teal-50 text-teal-800" />
        <button type="button" onClick={onShowPending} className="text-left" aria-label="ดูรายการที่ยังไม่ได้สแกน">
          <Stat label="ยังไม่ได้สแกน" value={data.pending} tone={data.pending ? 'bg-amber-50 text-amber-800' : 'bg-slate-50 text-slate-500'} />
        </button>
      </div>

      {data.total > 0 && (
        <>
          <button type="button" onClick={() => setOpen((v) => !v)} className="mt-3 text-sm font-medium text-teal-700 hover:underline" aria-expanded={open}>
            {open ? 'ซ่อนรายละเอียด' : 'ดูแยกตามหอผู้ป่วยและผู้จัดยา'}
          </button>
          {open && (
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <table className="w-full text-sm">
                <thead className="text-left text-xs font-semibold text-slate-500">
                  <tr>
                    <th className="py-1">หอผู้ป่วย</th>
                    <th className="py-1 text-right">จัดแล้ว</th>
                    <th className="py-1 text-right">ค้าง</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.byWard.map((w) => (
                    <tr key={w.ward}>
                      <td className="py-1.5">{w.ward}</td>
                      <td className="py-1.5 text-right tabular-nums">{w.matched}</td>
                      <td className={`py-1.5 text-right tabular-nums ${w.pending ? 'font-semibold text-amber-700' : ''}`}>{w.pending}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <table className="w-full text-sm">
                <thead className="text-left text-xs font-semibold text-slate-500">
                  <tr>
                    <th className="py-1">ผู้จัดยา</th>
                    <th className="py-1 text-right">จำนวนใบ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.byUser.map((u) => (
                    <tr key={u.name}>
                      <td className="py-1.5">{u.name}</td>
                      <td className="py-1.5 text-right tabular-nums">{u.count}</td>
                    </tr>
                  ))}
                  {data.byUser.length === 0 && (
                    <tr>
                      <td className="py-3 text-slate-400" colSpan={2}>
                        ยังไม่มีการจัดยา
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
