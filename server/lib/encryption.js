// Application-level encryption (AES-256-GCM) for sensitive fields at rest.
//
// Adds a layer the database operator cannot read: even with full DB access, an
// encrypted value is an opaque blob without ENCRYPTION_SECRET. Used for the
// wallet keystore (private-key material). GCM is authenticated, so any tampering
// with the ciphertext is detected on decrypt.
//
// The key is derived from ENCRYPTION_SECRET (read strictly from the environment;
// config.js requires it and rejects weak/placeholder values in production —
// there is no hardcoded fallback).
import crypto from 'node:crypto';
import { config } from '../config.js';

const ALGO    = 'aes-256-gcm';
const IV_LEN  = 12;          // 96-bit nonce (recommended for GCM)
const TAG_LEN = 16;          // 128-bit auth tag
const PREFIX  = 'enc:v1:';   // marks our payloads + versions the scheme

// Derive a stable 32-byte key from the secret (scrypt KDF, fixed app salt so the
// same key is produced for encrypt and decrypt). Computed once at module load.
const KEY = crypto.scryptSync(config.encryptionSecret, 'corecold:aes-256-gcm:v1', 32);

// Encrypt a UTF-8 string → "enc:v1:<base64(iv|tag|ciphertext)>". null/undefined
// pass through unchanged (so NULL columns stay NULL).
export function encrypt(plaintext) {
  if (plaintext === null || plaintext === undefined) return plaintext;
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, KEY, iv);
  const ct = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, ct]).toString('base64');
}

// Decrypt an "enc:v1:…" payload → original string. Values WITHOUT our prefix are
// treated as legacy plaintext and returned as-is, so pre-encryption rows keep
// working (and a migration can be done lazily).
export function decrypt(payload) {
  if (payload === null || payload === undefined) return payload;
  const s = String(payload);
  if (!s.startsWith(PREFIX)) return payload; // not our format → legacy plaintext
  const raw = Buffer.from(s.slice(PREFIX.length), 'base64');
  const iv  = raw.subarray(0, IV_LEN);
  const tag = raw.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct  = raw.subarray(IV_LEN + TAG_LEN);
  const decipher = crypto.createDecipheriv(ALGO, KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

// True if a stored value is one of our encrypted payloads.
export function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(PREFIX);
}
