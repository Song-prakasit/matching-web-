import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import jwt from 'jsonwebtoken';
import { config } from './config.js';

export const isAdmin = (userId) => config.adminUserIds.includes(userId);

// mustChangePassword marks a session that logged in with a password below the current policy:
// it may only change the password until it does.
export function issueToken(user, { mustChangePassword = false } = {}) {
  return jwt.sign({ sub: user.userId, name: user.name, mc: mustChangePassword }, config.jwtSecret, {
    expiresIn: `${config.sessionHours}h`,
  });
}

export const publicUser = (user, mustChangePassword = false) => ({
  userId: user.userId,
  name: user.name,
  isAdmin: isAdmin(user.userId),
  mustChangePassword,
});

export function requireAuth(req, res, next) {
  const header = req.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.user = publicUser({ userId: payload.sub, name: payload.name }, !!payload.mc);
    next();
  } catch {
    res.status(401).json({ error: 'กรุณาเข้าสู่ระบบใหม่' });
  }
}

export function requireAdmin(req, res, next) {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'ไม่มีสิทธิ์ใช้งานส่วนนี้' });
  next();
}

// Simple per-IP limit on login attempts: 10 tries per 5 minutes.
const attempts = new Map();
export function loginRateLimit(req, res, next) {
  const now = Date.now();
  const entry = attempts.get(req.ip);
  if (!entry || entry.reset < now) {
    attempts.set(req.ip, { count: 1, reset: now + 5 * 60000 });
    return next();
  }
  if (++entry.count > 10) {
    return res.status(429).json({ error: 'พยายามเข้าสู่ระบบบ่อยเกินไป กรุณารอ 5 นาที' });
  }
  next();
}

// Per-username lockout: 5 wrong passwords in a row lock that username for 15 minutes,
// whichever machine the attempts come from (the per-IP limit above does not cover that).
const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60000;
const lockFile =
  process.env.LOCKOUT_FILE ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data/lockouts.json');
const failures = new Map();

// Kept on disk so restarting the server does not hand an attacker a fresh set of guesses.
try {
  for (const [name, f] of Object.entries(JSON.parse(fs.readFileSync(lockFile, 'utf8')))) failures.set(name, f);
} catch {
  /* no saved lockouts yet */
}

function persistFailures(now = Date.now()) {
  for (const [name, f] of failures) if (f.until && f.until <= now) failures.delete(name);
  try {
    fs.mkdirSync(path.dirname(lockFile), { recursive: true });
    fs.writeFileSync(lockFile, JSON.stringify(Object.fromEntries(failures)));
  } catch (err) {
    console.error('[auth] could not save lockouts:', err.message);
  }
}


export function lockedMinutes(username, now = Date.now()) {
  const f = failures.get(username.toLowerCase());
  return f?.until > now ? Math.ceil((f.until - now) / 60000) : 0;
}

export function recordLoginFailure(username, now = Date.now()) {
  const key = username.toLowerCase();
  const f = failures.get(key) ?? { count: 0, until: 0 };
  if (f.until && f.until <= now) {
    f.count = 0;
    f.until = 0;
  }
  if (++f.count >= MAX_FAILURES) f.until = now + LOCK_MS;
  failures.set(key, f);
  persistFailures(now);
}

export function clearLoginFailures(username) {
  if (failures.delete(username.toLowerCase())) persistFailures();
}
export const unlockUsername = clearLoginFailures;
