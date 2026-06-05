import { createHmac, randomBytes } from 'crypto';

/**
 * Base32 Alphabet standard encoder/decoder (Google Authenticator compatible)
 */
function base32Decode(base32: string): Buffer {
  const cleaned = base32.toUpperCase().replace(/=+$/, '');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';

  for (let i = 0; i < cleaned.length; i++) {
    const val = alphabet.indexOf(cleaned[i]);
    if (val === -1) {
      throw new Error('Invalid Base32 character detected');
    }
    bits += val.toString(2).padStart(5, '0');
  }

  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }

  return Buffer.from(bytes);
}

/**
 * 1. Naya random Base32 Secret Key generate karein
 */
export function generate2FASecret(length = 16): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let secret = '';
  const bytes = randomBytes(length);
  for (let i = 0; i < length; i++) {
    secret += alphabet[bytes[i] % 32];
  }
  return secret;
}

/**
 * 2. Authenticator app ke scanner ke liye link standard generate karein
 */
export function getOTPAuthUrl(username: string, secret: string, issuer = 'CartRenew'): string {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(username)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;
}

/**
 * 3. User ke input code (6-digit OTP) ko current cryptographic interval window ke sath check karein
 */
export function verify2FAToken(token: string, secret: string, window = 1): boolean {
  // Har 30 second me TOTP validation update hota hai
  const counter = Math.floor(Date.now() / 30000);

  // Buffer window (pichla 30s aur agla 30s) checks taaki network latency se user block na ho
  for (let i = -window; i <= window; i++) {
    if (generateTOTP(secret, counter + i) === token) {
      return true;
    }
  }
  return false;
}

/**
 * Standard TOTP SHA1 HMAC Hash algorithm generator
 */
function generateTOTP(secret: string, counter: number): string {
  const key = base32Decode(secret);

  // Counter ko 8-byte hexadecimal buffer me map karein
  const buf = Buffer.alloc(8);
  let temp = counter;
  for (let i = 7; i >= 0; i--) {
    buf[i] = temp & 0xff;
    temp = temp >> 8;
  }

  const hmac = createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;

  // Binary value masking aur computation
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  // 6-digit dynamic number convert karein
  const otp = binary % 1000000;
  return otp.toString().padStart(6, '0');
}