import crypto from 'node:crypto';
import { decryptLegacy } from './legacyCrypto.js';

const env = process.env;

function dbCredential(plainName, encName) {
  if (env[plainName]) return env[plainName];
  // Allows pasting the encrypted Uid/Pwd straight from the old system.ini.
  if (env[encName]) return decryptLegacy(env[encName]);
  return undefined;
}

const dbMode = env.DB_MODE === 'mock' ? 'mock' : 'mssql';

if (!env.JWT_SECRET) {
  console.warn('[config] JWT_SECRET is not set: using a random secret, everyone is logged out on restart.');
}

export const config = {
  port: Number(env.PORT || 3000),
  dbMode,
  jwtSecret: env.JWT_SECRET || crypto.randomBytes(32).toString('hex'),
  // Comma-separated vc_UserId values allowed to open the settings page. Mock mode defaults to the demo user.
  adminUserIds: (env.ADMIN_USER_IDS ?? (dbMode === 'mock' ? 'U001' : '')).split(',').map((v) => v.trim()).filter(Boolean),
  sessionHours: Number(env.SESSION_HOURS || 12),
  // How many days back a dispensed prescription can still be scanned (old program: 1 = yesterday + today).
  scanLookbackDays: Number(env.SCAN_LOOKBACK_DAYS ?? 1),
  https: env.HTTPS_KEY && env.HTTPS_CERT ? { key: env.HTTPS_KEY, cert: env.HTTPS_CERT } : null,
  db:
    dbMode === 'mssql'
      ? {
          server: env.DB_SERVER,
          port: env.DB_PORT ? Number(env.DB_PORT) : undefined,
          database: env.DB_DATABASE || 'IPharmaDB',
          user: dbCredential('DB_USER', 'DB_USER_ENC'),
          password: dbCredential('DB_PASSWORD', 'DB_PASSWORD_ENC'),
          options: { encrypt: env.DB_ENCRYPT === 'true', trustServerCertificate: true },
          pool: { max: 10, idleTimeoutMillis: 30000 },
          connectionTimeout: 10000,
          requestTimeout: 30000,
        }
      : null,
};
