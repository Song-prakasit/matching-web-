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
