// Port of DBManager/Services/StdRijndael.cs (EncryptString_bak / DecryptString),
// so passwords and system.ini values stay compatible with the existing database.
import crypto from 'node:crypto';

const sha1 = (buf) => crypto.createHash('sha1').update(buf).digest();

// .NET Encoding.ASCII: every non-ASCII UTF-16 code unit becomes '?'.
function dotnetAscii(str) {
  const bytes = Buffer.alloc(str.length);
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    bytes[i] = c < 128 ? c : 0x3f;
  }
  return bytes;
}

// .NET PasswordDeriveBytes (SHA1, 100 iterations), including Microsoft's
// non-standard extension for output longer than one hash block.
function passwordDeriveBytes(password, salt, length, iterations = 100) {
  let base = sha1(Buffer.concat([password, salt]));
  for (let i = 1; i < iterations - 1; i++) base = sha1(base);

  const blocks = [];
  for (let prefix = 0, total = 0; total < length; prefix++, total += 20) {
    const p = prefix === 0 ? Buffer.alloc(0) : Buffer.from(String(prefix), 'ascii');
    blocks.push(sha1(Buffer.concat([p, base])));
  }
  return Buffer.concat(blocks).subarray(0, length);
}

let cached;
function keyMaterial() {
  if (cached) return cached;
  const { LEGACY_SALT, LEGACY_IV, LEGACY_PASSPHRASE } = process.env;
  if (!LEGACY_SALT || !LEGACY_IV || !LEGACY_PASSPHRASE) {
    throw new Error('LEGACY_SALT, LEGACY_IV and LEGACY_PASSPHRASE must be set in .env');
  }
  cached = {
    key: passwordDeriveBytes(Buffer.from(LEGACY_PASSPHRASE, 'utf8'), dotnetAscii(LEGACY_SALT), 32),
    // RijndaelManaged on .NET Framework only uses the first block-size bytes of the IV.
    iv: dotnetAscii(LEGACY_IV).subarray(0, 16),
  };
  return cached;
}

export function encryptLegacy(plainText) {
  const { key, iv } = keyMaterial();
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  return Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]).toString('base64');
}

export function decryptLegacy(cipherText) {
  const { key, iv } = keyMaterial();
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  return Buffer.concat([decipher.update(Buffer.from(cipherText, 'base64')), decipher.final()]).toString('utf8');
}

// ms_users.vc_Password holds the ASCII bytes of the base64 ciphertext (see Pharma_Login.cs).
export function passwordToken(plainPassword) {
  return Buffer.from(encryptLegacy(plainPassword), 'ascii');
}
