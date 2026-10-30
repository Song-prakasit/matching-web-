import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { api, download } from '../api.js';
import { playScanSound } from '../feedback.js';
import FontSizeControl from './FontSizeControl.jsx';
import Logo from './Logo.jsx';
import OrderDetailDialog from './OrderDetailDialog.jsx';
import SettingsDialog from './SettingsDialog.jsx';
import SummaryCard from './SummaryCard.jsx';
import {
  AlertIcon,
  CameraIcon,
  CheckIcon,
  ChevronIcon,
  DownloadIcon,
  FilterIcon,
  LogoutIcon,
  ScanIcon,
  SearchIcon,
  SettingsIcon,
} from './Icons.jsx';

const CameraScanner = lazy(() => import('./CameraScanner.jsx'));

const REFRESH_PENDING_MS = 60000;

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const emptyFilters = () => ({ date: today(), ward: '', orderType: '', hn: '', an: '', rx: '' });
// Keep the scanner field focused on desktops (hardware scanner), but don't pop up the keyboard on touch screens.
const finePointer = () => window.matchMedia?.('(pointer: fine)').matches;

const fieldCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-600/15';

const scanStyles = {
  matched: { box: 'bg-emerald-50 text-emerald-800 ring-emerald-200', icon: CheckIcon },
  already: { box: 'bg-amber-50 text-amber-800 ring-amber-200', icon: AlertIcon },
  not_found: { box: 'bg-red-50 text-red-700 ring-red-200', icon: AlertIcon },
  error: { box: 'bg-red-50 text-red-700 ring-red-200', icon: AlertIcon },
};

export default function MainPage({ user, dbMode, branding, onBrandingSaved, startWithSettings, onChangePassword, onLogout }) {
  const [settingsOpen, setSettingsOpen] = useState(!!startWithSettings);
  const [meta, setMeta] = useState({ wards: [], orderTypes: [] });
  const [filters, setFilters] = useState(emptyFilters);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState('');
  const [scanCode, setScanCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [highlight, setHighlight] = useState(null);
  const [detail, setDetail] = useState(null);
  const [camera, setCamera] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [view, setView] = useState('matched'); // 'matched' | 'pending'
  const [summaryKey, setSummaryKey] = useState(0);
  const scanInput = useRef(null);

  const focusScan = () => finePointer() && scanInput.current?.focus();

  const search = useCallback(async (f) => {
    setLoading(true);
    setListError('');
    try {
      const { rows } = await api(`/${view}?${new URLSearchParams(f)}`);
      setRows(rows);
      setSummaryKey((k) => k + 1);
    } catch (e) {
      setListError(e.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [view]);

  useEffect(() => {
    api('/meta').then(setMeta).catch((e) => setListError(e.message));
    focusScan();
  }, []);

  // Date / ward / type re-run the search immediately; text fields run it on Enter or when cleared.
  useEffect(() => {
    search(filters);
  }, [filters.date, filters.ward, filters.orderType, view]); // eslint-disable-line react-hooks/exhaustive-deps

  const setFilter = (key) => (e) => {
    const value = e.target.value;
    const next = { ...filters, [key]: value };
    setFilters(next);
    if (['hn', 'an', 'rx'].includes(key) && value === '') search(next);
  };

  async function submitScan(code) {
    const value = (code ?? scanCode).trim();
    if (!value || scanning) return;
    setScanning(true);
    try {
      const res = await api('/match', { method: 'POST', body: { code: value } });
      setScanResult({ ...res, at: Date.now() });
      if (res.status === 'matched') {
        setScanCode('');
        navigator.vibrate?.(60);
        playScanSound(true);
        await search(filters);
      } else {
        navigator.vibrate?.([80, 60, 80]);
        playScanSound(false);
        scanInput.current?.select();
      }
      setHighlight({ rx: res.rxNumber, at: Date.now() });
    } catch (e) {
      setScanResult({ status: 'error', message: e.message, at: Date.now() });
      playScanSound(false);
      scanInput.current?.select();
    } finally {
      setScanning(false);
    }
  }

  // New prescriptions keep arriving, so the waiting list refreshes itself while the tab is in view.
  useEffect(() => {
    if (view !== 'pending') return undefined;
    const id = setInterval(() => {
      if (!document.hidden) search(filters);
    }, REFRESH_PENDING_MS);
    return () => clearInterval(id);
  }, [view, filters, search]);

  useEffect(() => {
    if (!highlight) return;
    document.getElementById(`row-${highlight.rx}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [highlight, rows]);

  async function exportExcel() {
    setExporting(true);
    try {
      await download(`/${view}/export?${new URLSearchParams(filters)}`);
    } catch (e) {
      setListError(e.message);
    } finally {
      setExporting(false);
    }
  }

  const typeName = (code) => meta.orderTypes.find((t) => t.code === String(code))?.name ?? '-';
  const ScanStatus = scanResult ? scanStyles[scanResult.status] ?? scanStyles.error : null;

  return (
    <div className="min-h-dvh pb-10">
      <header className="sticky top-0 z-30 bg-teal-800 text-white shadow-lg shadow-teal-950/20">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
          <Logo src={branding.logo} className="size-9 rounded-xl bg-white/15 p-0.5" iconClass="size-5" />
          <div className="min-w-40 flex-1">
            <h1 className="truncate font-semibold leading-tight">ระบบบันทึกจัดยา</h1>
            <p className="truncate text-xs text-teal-100/80">{user.name}</p>
          </div>
          {dbMode === 'mock' && (
            <span className="hidden rounded-full bg-amber-400 px-2.5 py-0.5 text-xs font-semibold text-amber-950 sm:inline">
              โหมดทดสอบ
            </span>
          )}
          <FontSizeControl className="text-teal-50" buttonClass="hover:bg-white/10" />
          {user.isAdmin && (
            <button
              onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-teal-50 transition hover:bg-white/10"
              aria-label="ตั้งค่า"
            >
              <SettingsIcon className="size-4" />
              <span className="hidden sm:inline">ตั้งค่า</span>
            </button>
          )}
          <button
            onClick={onChangePassword}
            className="rounded-lg px-3 py-2 text-sm text-teal-50 transition hover:bg-white/10"
          >
            เปลี่ยนรหัสผ่าน
          </button>
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-teal-50 transition hover:bg-white/10"
          >
            <LogoutIcon className="size-4" />
            <span className="hidden sm:inline">ออกจากระบบ</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-4 px-4 pt-4">
        {/* Scan */}
        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitScan();
            }}
            className="flex gap-2"
          >
            <label className="relative flex-1">
              <span className="sr-only">สแกน QR ใบสั่งยา</span>
              <ScanIcon className="pointer-events-none absolute left-4 top-1/2 size-6 -translate-y-1/2 text-teal-600" />
              <input
                ref={scanInput}
                value={scanCode}
                onChange={(e) => setScanCode(e.target.value)}
                placeholder="สแกน QR ใบสั่งยา"
                autoComplete="off"
                className="w-full rounded-xl border-2 border-teal-600/30 bg-teal-50/40 py-3.5 pl-13 pr-4 text-lg outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:bg-white focus:ring-4 focus:ring-teal-600/15"
              />
            </label>
            <button
              type="button"
              onClick={() => setCamera(true)}
              className="grid shrink-0 place-items-center rounded-xl bg-teal-700 px-4 text-white transition hover:bg-teal-800"
              aria-label="สแกนด้วยกล้อง"
              title="สแกนด้วยกล้อง"
            >
              <CameraIcon className="size-6" />
            </button>
          </form>

          {scanResult && (
            <div
              key={scanResult.at}
              className={`mt-3 flex items-center gap-3 rounded-xl px-4 py-3 ring-1 ${ScanStatus.box}`}
              role="status"
            >
              <ScanStatus.icon className="size-7 shrink-0" />
              <div className="min-w-0">
                <p className="text-lg font-semibold leading-snug">{scanResult.message}</p>
                {scanResult.rxNumber && <p className="text-sm opacity-80">เลขที่ใบสั่ง {scanResult.rxNumber}</p>}
              </div>
            </div>
          )}
        </section>

        {/* Filters */}
        <section className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            className="flex w-full items-center gap-2 px-4 py-3 text-left font-medium text-slate-700 lg:hidden"
            aria-expanded={filtersOpen}
          >
            <FilterIcon className="size-4" /> ค้นหา / กรองข้อมูล
            <ChevronIcon className={`ml-auto size-4 transition ${filtersOpen ? 'rotate-90' : ''}`} />
          </button>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              search(filters);
              setFiltersOpen(false);
              focusScan();
            }}
            className={`${filtersOpen ? 'grid' : 'hidden'} grid-cols-2 gap-3 border-t border-slate-100 p-4 sm:grid-cols-3 lg:grid lg:grid-cols-[repeat(6,minmax(0,1fr))_auto] lg:items-end lg:border-0`}
          >
            <Field label="วันที่จัดยา">
              <input type="date" className={fieldCls} value={filters.date} onChange={setFilter('date')} required />
            </Field>
            <Field label="หอผู้ป่วย">
              <select className={fieldCls} value={filters.ward} onChange={setFilter('ward')}>
                <option value="">ทั้งหมด</option>
                {meta.wards.map((w) => (
                  <option key={w.code} value={w.code}>
                    {w.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="ประเภท">
              <select className={fieldCls} value={filters.orderType} onChange={setFilter('orderType')}>
                <option value="">ทั้งหมด</option>
                {meta.orderTypes.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="HN">
              <input className={fieldCls} value={filters.hn} onChange={setFilter('hn')} inputMode="numeric" />
            </Field>
            <Field label="AN">
              <input className={fieldCls} value={filters.an} onChange={setFilter('an')} inputMode="numeric" />
            </Field>
            <Field label="เลขที่ใบสั่ง">
              <input className={fieldCls} value={filters.rx} onChange={setFilter('rx')} />
            </Field>
            <div className="col-span-full flex gap-2 lg:col-span-1">
              <button
                type="submit"
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-800"
              >
                <SearchIcon className="size-4" /> ค้นหา
              </button>
              <button
                type="button"
                onClick={() => {
                  const f = emptyFilters();
                  setFilters(f);
                  search(f);
                }}
                className="rounded-lg px-3 py-2 text-sm text-slate-500 transition hover:bg-slate-100"
              >
                ล้าง
              </button>
            </div>
          </form>
        </section>

        <SummaryCard date={filters.date} refreshKey={summaryKey} onShowPending={() => setView('pending')} />

        {/* Results */}
        <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
            <div className="flex rounded-xl bg-slate-100 p-1 text-sm font-medium" role="tablist">
              {[
                ['matched', 'จัดยาแล้ว'],
                ['pending', 'ยังไม่ได้สแกน'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={view === key}
                  onClick={() => setView(key)}
                  className={`rounded-lg px-3 py-1.5 transition ${view === key ? 'bg-white text-slate-800 shadow' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-sm font-medium text-teal-700">
              {loading ? '…' : `${rows.length} รายการ`}
            </span>
            <button
              onClick={exportExcel}
              disabled={!rows.length || exporting}
              className="ml-auto flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
            >
              <DownloadIcon className="size-4" />
              {exporting ? 'กำลังสร้างไฟล์…' : 'Excel'}
            </button>
          </div>

          {listError && <p className="bg-red-50 px-4 py-3 text-sm text-red-700">{listError}</p>}

          {!loading && !listError && rows.length === 0 && (
            <p className="px-4 py-14 text-center text-slate-400">{view === 'pending' ? 'ไม่มีรายการค้างสแกน' : 'ไม่พบข้อมูล'}</p>
          )}

          {rows.length > 0 && (
            <>
              {/* Desktop / landscape tablet: table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      {['เลขที่ใบสั่ง', 'HN / AN', 'ชื่อ-นามสกุล', 'หอผู้ป่วย', 'ประเภท', 'วันเวลาที่สั่ง', ...(view === 'pending' ? ['เวลาจ่ายยา'] : ['ผู้จัดยา', 'เวลาจัดยา'])].map(
                        (h) => (
                          <th key={h} className="whitespace-nowrap px-4 py-2.5">
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((r) => (
                      <tr
                        key={r.rxNumber}
                        id={`row-${r.rxNumber}`}
                        onClick={() => setDetail(r)}
                        className={`cursor-pointer transition hover:bg-teal-50/60 ${highlight?.rx === r.rxNumber ? 'row-flash' : ''}`}
                      >
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-teal-800">{r.rxNumber}</td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <div>{r.hn}</div>
                          <div className="text-xs text-slate-400">{r.an}</div>
                        </td>
                        <td className="px-4 py-3">{r.patientName}</td>
                        <td className="px-4 py-3">{r.wardName}</td>
                        <td className="whitespace-nowrap px-4 py-3">{typeName(r.orderType)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-500">{r.orderedAt}</td>
                        {view === 'pending' ? (
                          <td className="whitespace-nowrap px-4 py-3 text-slate-500">{r.dispensedAt}</td>
                        ) : (
                          <>
                            <td className="px-4 py-3">{r.matchedBy}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-500">{r.matchedAt}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Phone / portrait tablet: cards */}
              <ul className="divide-y divide-slate-100 md:hidden">
                {rows.map((r) => (
                  <li key={r.rxNumber} id={`row-${r.rxNumber}`}>
                    <button
                      onClick={() => setDetail(r)}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left active:bg-teal-50 ${highlight?.rx === r.rxNumber ? 'row-flash' : ''}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-semibold text-teal-800">{r.rxNumber}</span>
                          <span className="shrink-0 text-xs text-slate-400">{view === 'pending' ? r.dispensedAt : r.matchedAt}</span>
                        </div>
                        <p className="truncate">{r.patientName}</p>
                        <p className="truncate text-xs text-slate-500">
                          HN {r.hn} · AN {r.an} · {r.wardName}
                        </p>
                        <p className="truncate text-xs text-slate-400">
                          {typeName(r.orderType)}{view === 'matched' && ` · ${r.matchedBy}`}
                        </p>
                      </div>
                      <ChevronIcon className="size-4 shrink-0 text-slate-300" />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </main>

      {settingsOpen && user.isAdmin && (
        <SettingsDialog
          branding={branding}
          onSaved={onBrandingSaved}
          onClose={() => {
            setSettingsOpen(false);
            focusScan();
          }}
        />
      )}

      {detail && (
        <OrderDetailDialog
          order={detail}
          typeName={typeName(detail.orderType)}
          isAdmin={user.isAdmin && view === 'matched'}
          onCancelled={() => {
            setDetail(null);
            setScanResult(null);
            search(filters);
            focusScan();
          }}
          onClose={() => {
            setDetail(null);
            focusScan();
          }}
        />
      )}

      {camera && (
        <Suspense fallback={null}>
          <CameraScanner
            title="สแกน QR ใบสั่งยา"
            onClose={() => setCamera(false)}
            onResult={(text) => {
              setCamera(false);
              setScanCode(text);
              submitScan(text);
            }}
          />
        </Suspense>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}
