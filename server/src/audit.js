import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const file =
  process.env.AUDIT_FILE ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data/audit.log');

// One JSON object per line. Never throws: a full disk must not stop a pharmacist from scanning.
export function audit(action, { userId = null, ip = null, ...detail } = {}) {
  const line = JSON.stringify({ at: new Date().toISOString(), action, userId, ip, ...detail });
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, `${line}\n`);
  } catch (err) {
    console.error('[audit] write failed:', err.message);
  }
}

export function readAudit(limit = 200) {
  try {
    return fs
      .readFileSync(file, 'utf8')
      .split('\n')
      .filter(Boolean)
      .slice(-limit)
      .reverse()
      .map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}
