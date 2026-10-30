import { useEffect, useState } from 'react';
import { api } from '../api.js';

const ACTIONS = {
  login: 'เข้าสู่ระบบ',
  login_failed: 'เข้าสู่ระบบไม่สำเร็จ',
  login_locked: 'ถูกล็อกบัญชี',
  password_changed: 'เปลี่ยนรหัสผ่าน',
  password_reset: 'รีเซ็ตรหัสผ่านให้ผู้ใช้',
  account_unlocked: 'ปลดล็อกบัญชี',
  match: 'สแกนจัดยา',
  match_already: 'สแกนซ้ำ',
  match_cancelled: 'ยกเลิกการสแกน',
  branding_changed: 'แก้ตั้งค่าหน้า login',
};

const btn = 'rounded-lg px-3 py-1.5 text-sm font-medium';

export function UsersPanel() {
  const [users, setUsers] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    api('/users')
      .then((d) => setUsers(d.users))
      .catch((e) => setError(e.message));
  }, []);

  async function act(user, action) {
    if (action === 'reset-password' && !confirm(`รีเซ็ตรหัสผ่านของ ${user.name} ?\nรหัสเดิมจะใช้ไม่ได้ทันที`)) return;
    setError('');
    setNotice(null);
    try {
      const res = await api(`/users/${encodeURIComponent(user.userId)}/${action}`, { method: 'POST' });
      setNotice(
        res.temporaryPassword
          ? { text: `รหัสผ่านชั่วคราวของ ${user.name}`, secret: res.temporaryPassword }
          : { text: `ปลดล็อกบัญชี ${user.name} แล้ว` },
      );
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="space-y-3 px-5 py-5">
      {notice && (
        <div className="rounded-xl bg-teal-50 px-4 py-3 text-sm text-teal-900">
          {notice.text}
          {notice.secret && (
            <>
              <code className="ml-2 select-all rounded bg-white px-2 py-1 font-mono text-base font-semibold">{notice.secret}</code>
              <p className="mt-1 text-xs text-teal-700">แสดงครั้งเดียว กรุณาแจ้งผู้ใช้และให้เปลี่ยนรหัสผ่านทันทีหลังเข้าสู่ระบบ</p>
            </>
          )}
        </div>
      )}
      {error && <p className="rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-700">{error}</p>}
      {!users && !error && <p className="py-8 text-center text-slate-400">กำลังโหลด…</p>}
      <ul className="divide-y divide-slate-100">
        {users?.map((u) => (
          <li key={u.userId} className="flex flex-wrap items-center gap-2 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{u.name}</p>
              <p className="text-xs text-slate-400">
                {u.username} · {u.userId}
              </p>
            </div>
            <button type="button" onClick={() => act(u, 'unlock')} className={`${btn} text-slate-600 hover:bg-slate-100`}>
              ปลดล็อก
            </button>
            <button type="button" onClick={() => act(u, 'reset-password')} className={`${btn} bg-amber-50 text-amber-800 hover:bg-amber-100`}>
              รีเซ็ตรหัสผ่าน
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AuditPanel() {
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/audit?limit=200')
      .then((d) => setEntries(d.entries))
      .catch((e) => setError(e.message));
  }, []);

  const detail = (e) => [e.username, e.rxNumber, e.targetUserId, e.reason].filter(Boolean).join(' · ');

  return (
    <div className="px-5 py-5">
      {error && <p className="rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-700">{error}</p>}
      {!entries && !error && <p className="py-8 text-center text-slate-400">กำลังโหลด…</p>}
      {entries?.length === 0 && <p className="py-8 text-center text-slate-400">ยังไม่มีประวัติ</p>}
      <ul className="divide-y divide-slate-100 text-sm">
        {entries?.map((e, i) => (
          <li key={i} className="py-2">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-medium">{ACTIONS[e.action] ?? e.action}</span>
              <span className="text-xs text-slate-400">{new Date(e.at).toLocaleString('th-TH')}</span>
            </div>
            <p className="text-xs text-slate-500">
              {[e.userId && `ผู้ใช้ ${e.userId}`, detail(e), e.ip].filter(Boolean).join(' · ')}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
