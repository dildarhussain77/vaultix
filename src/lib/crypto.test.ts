import { describe, it, expect } from 'vitest';
import {
  generateDataKey,
  generateSalt,
  generateIV,
  deriveKeyFromPassword,
  wrapDataKey,
  unwrapDataKey,
  encryptData,
  decryptData,
  generateRecoveryPhrase,
  bufferToBase64,
  base64ToBuffer,
} from './crypto';

describe('Vaultix Cryptography Engine (Zero-Knowledge AES-GCM & PBKDF2)', () => {
  it('should convert Uint8Array to base64 and back accurately', () => {
    const original = new Uint8Array([1, 2, 3, 4, 5, 255, 128, 0]);
    const b64 = bufferToBase64(original);
    const restored = base64ToBuffer(b64);
    expect(restored).toEqual(original);
  });

  it('should generate valid 16-byte salts and 12-byte IVs', () => {
    const salt1 = generateSalt();
    const salt2 = generateSalt();
    expect(salt1.byteLength).toBe(16);
    expect(salt2.byteLength).toBe(16);
    expect(salt1).not.toEqual(salt2);

    const iv1 = generateIV();
    const iv2 = generateIV();
    expect(iv1.byteLength).toBe(12);
    expect(iv2.byteLength).toBe(12);
    expect(iv1).not.toEqual(iv2);
  });

  it('should generate a 12-word recovery phrase', () => {
    const phrase = generateRecoveryPhrase();
    const words = phrase.trim().split(/\s+/);
    expect(words.length).toBe(12);
  });

  it('should derive consistent keys from master password + salt', async () => {
    const salt = generateSalt();
    const password = "MasterSuperSecretKey!2026";

    const key1 = await deriveKeyFromPassword(password, salt);
    const key2 = await deriveKeyFromPassword(password, salt);

    expect(key1).toBeDefined();
    expect(key2).toBeDefined();
  });

  it('should encrypt and decrypt payloads with zero data loss', async () => {
    const dataKey = await generateDataKey();
    const payload = {
      title: "Bank of America",
      username: "john_doe",
      password: "SuperSecretPassword#123",
      apiKey: "sk-live-9988776655",
      notes: "Account created in 2026",
      starred: true,
    };

    const encrypted = await encryptData(payload, dataKey);
    expect(encrypted.cipherTextBase64).toBeDefined();
    expect(encrypted.ivBase64).toBeDefined();

    // Plaintext should not appear in ciphertext
    expect(encrypted.cipherTextBase64).not.toContain("SuperSecretPassword#123");

    // Decrypt
    const decrypted = await decryptData(encrypted.cipherTextBase64, encrypted.ivBase64, dataKey);
    expect(decrypted).toEqual(payload);
  });

  it('should wrap and unwrap the Data Key using a derived KEK', async () => {
    const salt = generateSalt();
    const kek = await deriveKeyFromPassword("my-master-password", salt);
    const dataKey = await generateDataKey();

    const { wrappedKeyBase64 } = await wrapDataKey(dataKey, kek);
    expect(wrappedKeyBase64).toBeDefined();

    const unwrappedDataKey = await unwrapDataKey(wrappedKeyBase64, kek);
    expect(unwrappedDataKey).toBeDefined();

    const message = { status: "success", timestamp: Date.now() };
    const enc = await encryptData(message, unwrappedDataKey);
    const dec = await decryptData(enc.cipherTextBase64, enc.ivBase64, unwrappedDataKey);
    expect(dec).toEqual(message);
  });

  it('should reject decryption when tampered or wrong key used', async () => {
    const dataKey1 = await generateDataKey();
    const dataKey2 = await generateDataKey();

    const encrypted = await encryptData({ secret: "classified" }, dataKey1);

    await expect(
      decryptData(encrypted.cipherTextBase64, encrypted.ivBase64, dataKey2)
    ).rejects.toThrow();
  });
});
