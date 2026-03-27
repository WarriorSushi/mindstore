/**
 * Simple encryption for API keys stored in the database.
 * 
 * Uses AES-256-GCM with a key derived from the DATABASE_URL.
 * This isn't perfect security (the encryption key is derivable from env),
 * but it prevents casual database dump exposure.
 * 
 * If ENCRYPTION_KEY env var is set, uses that instead (recommended for production).
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const PREFIX = 'enc:v1:'; // Version prefix for encrypted values

function getEncryptionKey(): Buffer {
  const keySource = process.env.ENCRYPTION_KEY || process.env.DATABASE_URL || 'mindstore-default-key';
  return createHash('sha256').update(keySource).digest();
}

/**
 * Encrypt a plaintext value.
 * Returns a string like "enc:v1:base64(iv+ciphertext+tag)"
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  
  const tag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, encrypted, tag]);
  
  return PREFIX + combined.toString('base64');
}

/**
 * Decrypt an encrypted value.
 * If the value doesn't have the encryption prefix, returns it as-is (backward compat).
 */
export function decrypt(ciphertext: string): string {
  // Backward compatibility: if not encrypted, return as-is
  if (!ciphertext.startsWith(PREFIX)) {
    return ciphertext;
  }
  
  const key = getEncryptionKey();
  const combined = Buffer.from(ciphertext.slice(PREFIX.length), 'base64');
  
  const iv = combined.subarray(0, IV_LENGTH);
  const tag = combined.subarray(combined.length - TAG_LENGTH);
  const encrypted = combined.subarray(IV_LENGTH, combined.length - TAG_LENGTH);
  
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  
  return decipher.update(encrypted) + decipher.final('utf8');
}

/**
 * Check if a value is encrypted.
 */
export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX);
}

/**
 * Encrypt a value only if it's not already encrypted.
 */
export function ensureEncrypted(value: string): string {
  if (isEncrypted(value)) return value;
  return encrypt(value);
}
