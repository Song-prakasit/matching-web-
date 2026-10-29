import { Router } from 'express';
import { repo } from './db/index.js';
import { issueToken, loginRateLimit, requireAuth } from './auth.js';
import { matchedRowsToXlsx } from './excel.js';
import { ORDER_TYPES } from './orderTypes.js';
import { config } from './config.js';

export const api = Router();

api.get('/health', (req, res) => res.json({ ok: true, dbMode: config.dbMode }));

const clean = (v, max = 100) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
// Prescription QR codes look like "RXNUMBER|...|..."; the prescription number is the first part.
const rxFromScan = (v) => clean(v, 500).split('|')[0].trim();

api.post('/auth/login', loginRateLimit, async (req, res) => {
  const username = clean(req.body?.username);
  const password = clean(req.body?.password, 200);
  const qrCode = clean(req.body?.qrCode, 200);

  let user = null;
  if (qrCode) user = await repo.loginWithQr(qrCode);
  else if (username && password) user = await repo.loginWithPassword(username, password);
  else return res.status(400).json({ error: 'กรุณาป้อนชื่อผู้ใช้งานและรหัสผ่าน' });

  if (!user) return res.status(401).json({ error: 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง' });
  res.json({ token: issueToken(user), user });
});

api.use(requireAuth);

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
  if (found.matched) return res.json({ status: 'already', rxNumber, message: 'สแกนจัดยาไปแล้ว' });

  const ok = await repo.markMatched(rxNumber, req.user.userId);
  if (!ok) return res.json({ status: 'already', rxNumber, message: 'สแกนจัดยาไปแล้ว' });
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

api.get('/matched/export', async (req, res) => {
  const filters = filtersFrom(req.query);
  if (!filters) return res.status(400).json({ error: 'วันที่ไม่ถูกต้อง' });
  const rows = await repo.searchMatched(filters);
  const buf = await matchedRowsToXlsx(rows);
  const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
  res
    .type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    .attachment(`${stamp}_บันทึกการจัดยา.xlsx`)
    .send(Buffer.from(buf));
});

api.get('/orders/:rx/items', async (req, res) => {
  res.json({ items: await repo.getOrderItems(clean(req.params.rx, 50)) });
});
