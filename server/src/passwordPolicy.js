import crypto from 'node:crypto';

export const PASSWORD_POLICY_MESSAGE =
  'รหัสผ่านต้องยาวอย่างน้อย 12 ตัวอักษร ประกอบด้วยตัวพิมพ์เล็ก ตัวพิมพ์ใหญ่ และอักขระพิเศษ';

export function meetsPasswordPolicy(password) {
  return (
    typeof password === 'string' &&
    password.length >= 12 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

// Random password that satisfies the policy, for admin resets.
export function generatePassword() {
  const pick = (chars) => chars[crypto.randomInt(chars.length)];
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const special = '!@#$%&*?';
  const chars = [pick(lower), pick(upper), pick(special), pick(digits)];
  const all = lower + upper + digits + special;
  while (chars.length < 14) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
