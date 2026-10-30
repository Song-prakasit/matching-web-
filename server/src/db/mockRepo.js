// In-memory sample data (DB_MODE=mock) for developing and testing without access to 10.0.0.77.
// Same interface as mssqlRepo.js. Everything resets when the server restarts.
import { config } from '../config.js';
import { passwordToken } from '../legacyCrypto.js';

const pad = (n) => String(n).padStart(2, '0');
const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const display = (d) => (d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}` : null);
const at = (daysAgo, hh, mm) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hh, mm, 0, 0);
  return d;
};
// A time `minutes` before now, moved back `daysAgo` days, but never before that day's midnight.
const minutesAgo = (daysAgo, minutes) => {
  const d = new Date(Date.now() - minutes * 60000);
  d.setDate(d.getDate() - daysAgo);
  const midnight = at(daysAgo, 0, 0);
  return d < midnight ? new Date(midnight.getTime() + minutes * 1000) : d;
};

const users = [
  { userId: 'U001', username: 'demo', password: 'Demo@Matching12', qr: 'DEMO-QR-001', name: 'ภญ.ทดสอบ ระบบจัดยา' },
  // Pre-policy password, to try the forced password change.
  { userId: 'U003', username: 'legacy', password: '1234', qr: 'DEMO-QR-003', name: 'ผู้ใช้รหัสผ่านเดิม' },
  { userId: 'U002', username: 'pharm2', password: 'Demo@Matching12', qr: 'DEMO-QR-002', name: 'ภก.สมชาย ใจดี' },
];
const userTokens = new Map();

const wards = [
  { code: 'W01', name: 'อายุรกรรมชาย' },
  { code: 'W02', name: 'อายุรกรรมหญิง' },
  { code: 'W03', name: 'ศัลยกรรม' },
  { code: 'W04', name: 'กุมารเวชกรรม' },
  { code: 'ICU', name: 'หอผู้ป่วยวิกฤต (ICU)' },
];

const patients = [
  { hn: '6700123', an: '68001001', name: 'นายสมศักดิ์ รักษ์ดี', ward: 'W01' },
  { hn: '6700456', an: '68001002', name: 'นางสาวมาลี ศรีสุข', ward: 'W02' },
  { hn: '6500789', an: '68001003', name: 'นายประเสริฐ มั่นคง', ward: 'W03' },
  { hn: '6801111', an: '68001004', name: 'ด.ช.ภูมิ ใจกล้า', ward: 'W04' },
  { hn: '6602222', an: '68001005', name: 'นางบุญมี ทองคำ', ward: 'ICU' },
  { hn: '6403333', an: '68001006', name: 'นายวิชัย สายบุญ', ward: 'W01' },
];

const drugs = [
  ['PARA500', 'Paracetamol 500 mg tab', 'ครั้งละ 1 เม็ด ทุก 6 ชม. เวลาปวด'],
  ['AMOX500', 'Amoxicillin 500 mg cap', 'ครั้งละ 1 แคปซูล วันละ 3 ครั้ง หลังอาหาร'],
  ['OMP20', 'Omeprazole 20 mg cap', 'ครั้งละ 1 แคปซูล ก่อนอาหารเช้า'],
  ['MET500', 'Metformin 500 mg tab', 'ครั้งละ 1 เม็ด วันละ 2 ครั้ง หลังอาหาร'],
  ['AML5', 'Amlodipine 5 mg tab', 'ครั้งละ 1 เม็ด วันละ 1 ครั้ง หลังอาหารเช้า'],
  ['CEF1G', 'Ceftriaxone 1 g inj', 'ฉีดเข้าหลอดเลือดดำ วันละ 1 ครั้ง'],
];

// [rx, patient index, orderType, dispensed days ago, matched?]
const seed = [
  ['RX68100001', 0, '1', 0, false],
  ['RX68100002', 1, '1', 0, false],
  ['RX68100003', 2, '2', 0, false],
  ['RX68100004', 3, '5', 0, false],
  ['RX68100005', 4, '1', 0, true],
  ['RX68100006', 5, '1', 0, true],
  ['RX68100007', 0, '2', 0, true],
  ['RX68100008', 1, '5', 1, false],
  ['RX68100009', 2, '1', 1, true],
  ['RX68100010', 3, '1', 3, false],
];

const orders = seed.map(([rxNumber, pi, orderType, daysAgo, matched], i) => {
  const p = patients[pi];
  const dispensedAt = minutesAgo(daysAgo, 30 + i * 12);
  return {
    rxNumber,
    orderType,
    hn: p.hn,
    an: p.an,
    patientName: p.name,
    ward: p.ward,
    createdAt: new Date(dispensedAt.getTime() - 90 * 60000),
    orderedAt: new Date(dispensedAt.getTime() - 60 * 60000),
    dispensedAt,
    matchingStatus: matched ? 1 : null,
    matchedBy: matched ? 'U002' : null,
    matchedAt: matched ? new Date(dispensedAt.getTime() + 5 * 60000) : null,
    items: drugs
      .filter((_, d) => (d + i) % 3 !== 0)
      .slice(0, 2 + (i % 3))
      .map(([itemCode, drugName, usage], d) => ({
        itemCode,
        drugName,
        qty: (d + 1) * 10,
        usage,
        location: (d + i) % 2 === 0 ? 'Robot' : 'จัดมือ',
      })),
  };
});

const publicUser = (u) => ({ userId: u.userId, name: u.name });
const tokenOf = (u) => userTokens.get(u.userId) ?? passwordToken(u.password);

export async function loginWithPassword(username, password) {
  const u = users.find((x) => x.username === username);
  if (!u) return null;
  // Exercises the same legacy encryption the real database comparison uses.
  return passwordToken(password).equals(tokenOf(u)) ? publicUser(u) : null;
}

export async function changePassword(userId, currentPassword, newPassword) {
  const u = users.find((x) => x.userId === userId);
  if (!u || !passwordToken(currentPassword).equals(tokenOf(u))) return false;
  userTokens.set(u.userId, passwordToken(newPassword));
  return true;
}

export async function loginWithQr(code) {
  const u = users.find((x) => x.qr === code);
  return u ? publicUser(u) : null;
}

export async function getWards() {
  return wards;
}

export async function findScannable(rxNumber) {
  const cutoff = at(config.scanLookbackDays, 0, 0);
  const o = orders.find((x) => x.rxNumber === rxNumber && x.dispensedAt >= cutoff);
  return o ? { rxNumber: o.rxNumber, matched: !!o.matchingStatus } : null;
}

export async function markMatched(rxNumber, userId) {
  const o = orders.find((x) => x.rxNumber === rxNumber && !x.matchingStatus);
  if (!o) return false;
  Object.assign(o, { matchingStatus: 1, matchedBy: userId, matchedAt: new Date() });
  return true;
}

export async function unmatch(rxNumber) {
  const o = orders.find((x) => x.rxNumber === rxNumber && x.matchingStatus);
  if (!o) return false;
  Object.assign(o, { matchingStatus: null, matchedBy: null, matchedAt: null });
  return true;
}

export async function listUsers() {
  return users.map(({ userId, username, name }) => ({ userId, username, name }));
}

export async function resetPassword(userId, newPassword) {
  const u = users.find((x) => x.userId === userId);
  if (!u) return false;
  userTokens.set(u.userId, passwordToken(newPassword));
  return true;
}

function searchOrders({ date, ward, orderType, hn, an, rx }, matched) {
  return orders
    .filter(
      (o) =>
        !!o.matchingStatus === matched &&
        isoDate(o.dispensedAt) === date &&
        (!ward || o.ward === ward) &&
        (!orderType || o.orderType === orderType) &&
        (!hn || o.hn === hn) &&
        (!an || o.an === an) &&
        (!rx || o.rxNumber === rx),
    )
    .sort((a, b) => (matched ? b.matchedAt - a.matchedAt : a.dispensedAt - b.dispensedAt))
    .map((o) => ({
      createdAt: display(o.createdAt),
      rxNumber: o.rxNumber,
      orderedAt: display(o.orderedAt),
      orderType: o.orderType,
      hn: o.hn,
      an: o.an,
      patientName: o.patientName,
      wardName: wards.find((w) => w.code === o.ward)?.name ?? null,
      matchedBy: users.find((u) => u.userId === o.matchedBy)?.name ?? null,
      matchedAt: o.matchedAt ? display(o.matchedAt) : null,
      dispensedAt: display(o.dispensedAt),
    }));
}

export const searchMatched = async (filters) => searchOrders(filters, true);
export const searchPending = async (filters) => searchOrders(filters, false);

export async function getOrderItems(rxNumber) {
  return orders.find((o) => o.rxNumber === rxNumber)?.items ?? [];
}
