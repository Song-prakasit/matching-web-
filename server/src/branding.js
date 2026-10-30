import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const file =
  process.env.BRANDING_FILE ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data/branding.json');

const defaults = { hospitalName: 'Medcare City Hospital', title: 'IPD Pharmacy Login', logo: '' };
const MAX_LOGO_CHARS = 700_000; // data URL length, roughly 500 KB of image
const LOGO_PATTERN = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

let current = { ...defaults };
try {
  current = { ...defaults, ...JSON.parse(fs.readFileSync(file, 'utf8')) };
} catch {
  /* no saved branding yet */
}

export const getBranding = () => current;

// Returns an error message, or null when the branding was saved.
export function saveBranding(input) {
  const hospitalName = typeof input?.hospitalName === 'string' ? input.hospitalName.trim().slice(0, 80) : '';
  const title = typeof input?.title === 'string' ? input.title.trim().slice(0, 80) : '';
  const logo = typeof input?.logo === 'string' ? input.logo : '';
  if (!title) return 'กรุณาป้อนชื่อหัวข้อหน้า login';
  if (logo && (logo.length > MAX_LOGO_CHARS || !LOGO_PATTERN.test(logo))) {
    return 'ไฟล์โลโก้ต้องเป็น PNG, JPG หรือ WebP และมีขนาดไม่เกิน 500 KB';
  }
  current = { hospitalName, title, logo };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(current, null, 2));
  return null;
}
