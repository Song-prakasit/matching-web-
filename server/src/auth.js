import jwt from 'jsonwebtoken';
import { config } from './config.js';

export function issueToken(user) {
  return jwt.sign({ sub: user.userId, name: user.name }, config.jwtSecret, { expiresIn: `${config.sessionHours}h` });
}

export function requireAuth(req, res, next) {
  const header = req.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.user = { userId: payload.sub, name: payload.name };
    next();
  } catch {
    res.status(401).json({ error: 'กรุณาเข้าสู่ระบบใหม่' });
  }
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
