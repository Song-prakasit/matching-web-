import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'matching-test-'));
process.env.BRANDING_FILE = path.join(tmp, 'branding.json');
process.env.AUDIT_FILE = path.join(tmp, 'audit.log');
process.env.LOCKOUT_FILE = path.join(tmp, 'lockouts.json');
process.env.DB_MODE = 'mock';

const { meetsPasswordPolicy } = await import('../src/passwordPolicy.js');
const { saveBranding, getBranding } = await import('../src/branding.js');
const { audit, readAudit } = await import('../src/audit.js');
const { lockedMinutes, recordLoginFailure, clearLoginFailures } = await import('../src/auth.js');

test('password policy needs 12 chars, lower, upper and a special character', () => {
  assert.equal(meetsPasswordPolicy('Abcdefgh1!xy'), true);
  assert.equal(meetsPasswordPolicy('Abcdefg!xyz'), false); // 11 chars
  assert.equal(meetsPasswordPolicy('abcdefgh1!xyz'), false); // no upper
  assert.equal(meetsPasswordPolicy('ABCDEFGH1!XYZ'), false); // no lower
  assert.equal(meetsPasswordPolicy('Abcdefgh1234'), false); // no special
  assert.equal(meetsPasswordPolicy(undefined), false);
});

test('branding rejects non-image logos and empty titles, and saves valid ones', () => {
  assert.match(saveBranding({ title: 'x', logo: 'data:image/svg+xml;base64,AAAA' }), /PNG/);
  assert.match(saveBranding({ title: ' ', logo: '' }), /หัวข้อ/);
  assert.equal(saveBranding({ hospitalName: 'H', title: 'T', logo: 'data:image/png;base64,iVBORw0KGgo=' }), null);
  assert.equal(getBranding().title, 'T');
  assert.equal(JSON.parse(fs.readFileSync(process.env.BRANDING_FILE, 'utf8')).hospitalName, 'H');
});

test('username locks after 5 failures and unlocks after 15 minutes or a success', () => {
  const t0 = 1_000_000;
  for (let i = 0; i < 4; i++) recordLoginFailure('Alice', t0);
  assert.equal(lockedMinutes('alice', t0), 0);
  recordLoginFailure('ALICE', t0);
  assert.equal(lockedMinutes('alice', t0), 15);
  assert.equal(lockedMinutes('alice', t0 + 15 * 60000 + 1), 0);
  clearLoginFailures('alice');
  assert.equal(lockedMinutes('alice', t0), 0);
});

test('audit log keeps entries newest first', () => {
  audit('login', { userId: 'U1', ip: '1.1.1.1' });
  audit('match', { userId: 'U1', rxNumber: 'RX1' });
  const [latest, previous] = readAudit();
  assert.equal(latest.action, 'match');
  assert.equal(latest.rxNumber, 'RX1');
  assert.equal(previous.action, 'login');
});

test('generated passwords always meet the policy', async () => {
  const { generatePassword } = await import('../src/passwordPolicy.js');
  for (let i = 0; i < 200; i++) assert.equal(meetsPasswordPolicy(generatePassword()), true);
});

test('lockouts are saved to disk so a restart does not clear them', () => {
  recordLoginFailure('bob');
  const saved = JSON.parse(fs.readFileSync(process.env.LOCKOUT_FILE, 'utf8'));
  assert.equal(saved.bob.count, 1);
  clearLoginFailures('bob');
  assert.equal(JSON.parse(fs.readFileSync(process.env.LOCKOUT_FILE, 'utf8')).bob, undefined);
});

test('daily summary counts by ward and by pharmacist', async () => {
  const { summarize } = await import('../src/summary.js');
  const s = summarize(
    [
      { wardName: 'A', matchedBy: 'ก' },
      { wardName: 'A', matchedBy: 'ก' },
      { wardName: 'B', matchedBy: 'ข' },
    ],
    [{ wardName: 'B' }, { wardName: null }],
  );
  assert.deepEqual([s.total, s.matched, s.pending], [5, 3, 2]);
  assert.deepEqual(s.byWard[0], { ward: 'A', matched: 2, pending: 0 });
  assert.deepEqual(s.byWard.find((w) => w.ward === 'B'), { ward: 'B', matched: 1, pending: 1 });
  assert.equal(s.byWard.find((w) => w.ward === 'ไม่ระบุหอผู้ป่วย').pending, 1);
  assert.deepEqual(s.byUser[0], { name: 'ก', count: 2 });
});
