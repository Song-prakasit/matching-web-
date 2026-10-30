import { Router } from 'express';
import { repo } from './db/index.js';
import {
  clearLoginFailures,
  issueToken,
  lockedMinutes,
  loginRateLimit,
  publicUser,
  recordLoginFailure,
  requireAdmin,
  requireAuth,
  unlockUsername,
} from './auth.js';
import { audit, readAudit } from './audit.js';
import { matchedRowsToXlsx } from './excel.js';
import { ORDER_TYPES } from './orderTypes.js';
import { config } from './config.js';
import { getBranding, saveBranding } from './branding.js';
import { summarize } from './summary.js';
import { PASSWORD_POLICY_MESSAGE, generatePassword, meetsPasswordPolicy } from './passwordPolicy.js';

export const api = Router();

api.get('/health', (req, res) => res.json({ ok: true, dbMode: config.dbMode }));

const clean = (v, max = 100) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
// Prescription QR codes look like "RXNUMBER|...|..."; the prescription number is the first part.
const rxFromScan = (v) => clean(v, 500).split('|')[0].trim();

// Public: the login page needs the logo before anyone is signed in.
api.get('/branding', (req, res) => res.json(getBranding()));

api.post('/auth/login', loginRateLimit, async (req, res) => {
  const username = clean(req.body?.username);
  const password = clean(req.body?.password, 200);
  const qrCode = clean(req.body?.qrCode, 200);

  let user = null;
  let mustChangePassword = false;
  if (qrCode) user = await repo.loginWithQr(qrCode);
  else if (username && password) {
    const locked = lockedMinutes(username);
    if (locked) {
      audit('login_locked', { ip: req.ip, username });
      return res.status(429).json({ error: `บัญชีนี้ถูกล็อกชั่วคราว เพราะป้อนรหัสผ่านผิดหลายครั้ง กรุณารอ ${locked} นาที` });
    }
    user = await repo.loginWithPassword(username, password);
    // Accounts from the old system may predate the policy: let them in only to set a compliant password.
    mustChangePassword = !!user && !meetsPasswordPolicy(password);
    if (user) clearLoginFailures(username);
    else recordLoginFailure(username);
  } else return res.status(400).json({ error: 'กรุณาป้อนชื่อผู้ใช้งานและรหัสผ่าน' });

  const method = qrCode ? 'qr' : 'password';
  if (!user) {
    audit('login_failed', { ip: req.ip, method, username: username || undefined });
    return res.status(401).json({ error: 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง' });
  }
  audit('login', { ip: req.ip, userId: user.userId, method, mustChangePassword });
  res.json({ token: issueToken(user, { mustChangePassword }), user: publicUser(user, mustChangePassword) });
});

api.use(requireAuth);

api.post('/auth/password', loginRateLimit, async (req, res) => {
  const currentPassword = clean(req.body?.currentPassword, 200);
  const newPassword = clean(req.body?.newPassword, 200);
  if (!currentPassword) return res.status(400).json({ error: 'กรุณาป้อนรหัสผ่านปัจจุบัน' });
  if (!meetsPasswordPolicy(newPassword)) return res.status(400).json({ error: PASSWORD_POLICY_MESSAGE });
  if (newPassword === currentPassword) return res.status(400).json({ error: 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม' });
  if (!(await repo.changePassword(req.user.userId, currentPassword, newPassword))) {
    return res.status(400).json({ error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' });
  }
  audit('password_changed', { ip: req.ip, userId: req.user.userId });
  res.json({ token: issueToken(req.user), user: publicUser(req.user) });
});

// A session that still owes a password change can do nothing else.
api.use((req, res, next) => {
  if (req.user.mustChangePassword && req.path !== '/auth/me') {
    return res.status(403).json({ error: 'กรุณาเปลี่ยนรหัสผ่านก่อนใช้งาน', mustChangePassword: true });
  }
  next();
});

api.put('/branding', requireAdmin, (req, res) => {
  const error = saveBranding(req.body);
  if (error) return res.status(400).json({ error });
  audit('branding_changed', { ip: req.ip, userId: req.user.userId });
  res.json(getBranding());
});

api.get('/audit', requireAdmin, (req, res) => res.json({ entries: readAudit(Math.min(Number(req.query.limit) || 200, 1000)) }));

api.get('/auth/me', (req, res) => res.json({ user: req.user }));

api.get('/meta', async (req, res) => {
  const wards = await repo.getWards();
  res.json({ wards, orderTypes: Object.entries(ORDER_TYPES).map(([code, name]) => ({ code, name })) });
});

api.post('/match', async (req, res) => {
  const rxNumber = rxFromScan(req.body?.code);
  if (!rxNumber) return res.status(400).json({ status: 'invalid', message: 'กรุณาสแกนใบสั่งยา' });

  const found = await repo.findScannable(rxNumber);
  if (!found) return res.json({ status: 'not_found', rxNumber, message: 'ไม่พบข้อมูลใบสั่งยา หรือยังไม่ได้จ่ายยา' });
  if (found.matched) {
    audit('match_already', { ip: req.ip, userId: req.user.userId, rxNumber });
    return res.json({ status: 'already', rxNumber, message: 'สแกนจัดยาไปแล้ว' });
  }

  const ok = await repo.markMatched(rxNumber, req.user.userId);
  if (!ok) return res.json({ status: 'already', rxNumber, message: 'สแกนจัดยาไปแล้ว' });
  audit('match', { ip: req.ip, userId: req.user.userId, rxNumber });
  res.json({ status: 'matched', rxNumber, message: 'บันทึกข้อมูลสำเร็จ' });
});

function filtersFrom(query) {
  const date = clean(query.date, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return {
    date,
    ward: clean(query.ward, 20),
    orderType: ORDER_TYPES[clean(query.orderType, 2)] ? clean(query.orderType, 2) : '',
    hn: clean(query.hn, 30),
    an: clean(query.an, 30),
    rx: rxFromScan(query.rx),
  };
}

api.get('/matched', async (req, res) => {
  const filters = filtersFrom(req.query);
  if (!filters) return res.status(400).json({ error: 'วันที่ไม่ถูกต้อง' });
  res.json({ rows: await repo.searchMatched(filters) });
});

api.get('/pending', async (req, res) => {
  const filters = filtersFrom(req.query);
  if (!filters) return res.status(400).json({ error: 'วันที่ไม่ถูกต้อง' });
  res.json({ rows: await repo.searchPending(filters) });
});

// Totals for one day, ignoring the ward/type/HN filters so the numbers always cover everything dispensed.
api.get('/summary', async (req, res) => {
  const filters = filtersFrom({ date: req.query.date });
  if (!filters) return res.status(400).json({ error: 'วันที่ไม่ถูกต้อง' });
  const [matched, pending] = await Promise.all([repo.searchMatched(filters), repo.searchPending(filters)]);
  res.json(summarize(matched, pending));
});

async function sendExcel(req, res, pending) {
  const filters = filtersFrom(req.query);
  if (!filters) return res.status(400).json({ error: 'วันที่ไม่ถูกต้อง' });
  const rows = await (pending ? repo.searchPending(filters) : repo.searchMatched(filters));
  const buf = await matchedRowsToXlsx(rows, { pending });
  const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
  res
    .type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    .attachment(`${stamp}_${pending ? 'ยังไม่ได้สแกน' : 'บันทึกการจัดยา'}.xlsx`)
    .send(Buffer.from(buf));
}

api.get('/matched/export', (req, res) => sendExcel(req, res, false));
api.get('/pending/export', (req, res) => sendExcel(req, res, true));

api.post('/matched/:rx/cancel', requireAdmin, async (req, res) => {
  const rxNumber = clean(req.params.rx, 50);
  const reason = clean(req.body?.reason, 200);
  if (reason.length < 3) return res.status(400).json({ error: 'กรุณาระบุเหตุผลที่ยกเลิก' });
  if (!(await repo.unmatch(rxNumber))) return res.status(404).json({ error: 'ไม่พบรายการที่สแกนจัดยาแล้ว' });
  audit('match_cancelled', { ip: req.ip, userId: req.user.userId, rxNumber, reason });
  res.json({ ok: true });
});

api.get('/users', requireAdmin, async (req, res) => res.json({ users: await repo.listUsers() }));

api.post('/users/:id/reset-password', requireAdmin, async (req, res) => {
  const userId = clean(req.params.id, 50);
  const temporaryPassword = generatePassword();
  if (!(await repo.resetPassword(userId, temporaryPassword))) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });
  audit('password_reset', { ip: req.ip, userId: req.user.userId, targetUserId: userId });
  res.json({ temporaryPassword });
});

api.post('/users/:id/unlock', requireAdmin, async (req, res) => {
  const target = (await repo.listUsers()).find((u) => u.userId === clean(req.params.id, 50));
  if (!target) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });
  unlockUsername(target.username);
  audit('account_unlocked', { ip: req.ip, userId: req.user.userId, targetUserId: target.userId });
  res.json({ ok: true });
});

api.get('/orders/:rx/items', async (req, res) => {
  res.json({ items: await repo.getOrderItems(clean(req.params.rx, 50)) });
});
