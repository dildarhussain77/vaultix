/**
 * Web Crypto API Utility for Vaultix
 * Implements Zero-Knowledge envelope encryption.
 */

// --- Constants ---
const PBKDF2_ITERATIONS_MP = 300000;
const PBKDF2_ITERATIONS_RP = 100000;
const AES_GCM_TAG_LENGTH = 128;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;

// --- Helper: Convert between strings/base64 and Uint8Array ---
export const encodeText = (text: string): Uint8Array => new TextEncoder().encode(text);
export const decodeText = (buffer: ArrayBuffer): string => new TextDecoder().decode(buffer);

export const bufferToBase64 = (buffer: ArrayBuffer | Uint8Array): string => {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

export const base64ToBuffer = (base64: string): Uint8Array => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

// --- Key Generation ---

/** Generates a fresh AES-GCM 256-bit Data Key */
export async function generateDataKey(): Promise<CryptoKey> {
  return await window.crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true, // Extractable so we can wrap it
    ['encrypt', 'decrypt']
  );
}

/** Generates a random Salt */
export function generateSalt(): Uint8Array {
  return window.crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
}

/** Generates a random Initialization Vector (IV) */
export function generateIV(): Uint8Array {
  return window.crypto.getRandomValues(new Uint8Array(IV_LENGTH));
}

// --- Key Derivation ---

async function getRawKeyMaterial(passwordOrPhrase: string): Promise<CryptoKey> {
  return await window.crypto.subtle.importKey(
    'raw',
    encodeText(passwordOrPhrase) as BufferSource,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
}

/** Derives an AES-KW (Key Wrap) key from a password using PBKDF2 */
export async function deriveKeyFromPassword(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await getRawKeyMaterial(password);
  return await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as any,
      iterations: PBKDF2_ITERATIONS_MP,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-KW', length: 256 },
    false,
    ['wrapKey', 'unwrapKey']
  );
}

/** Derives an AES-KW key from a recovery phrase */
export async function deriveKeyFromPhrase(phrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await getRawKeyMaterial(phrase);
  return await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as any,
      iterations: PBKDF2_ITERATIONS_RP,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-KW', length: 256 },
    false,
    ['wrapKey', 'unwrapKey']
  );
}

// --- Key Wrapping (Envelope Encryption) ---

/** Wraps (encrypts) the Data Key using a derived Key Encryption Key (KEK) */
export async function wrapDataKey(dataKey: CryptoKey, kek: CryptoKey): Promise<{ wrappedKeyBase64: string }> {
  // Note: AES-KW does not use an IV parameter directly in the Web Crypto API, 
  // it uses a default deterministic IV as per RFC 3394.
  const wrappedKey = await window.crypto.subtle.wrapKey(
    'raw',
    dataKey,
    kek,
    { name: 'AES-KW' }
  );
  return { wrappedKeyBase64: bufferToBase64(wrappedKey) };
}

/** Unwraps (decrypts) the Data Key using a derived Key Encryption Key (KEK) */
export async function unwrapDataKey(wrappedKeyBase64: string, kek: CryptoKey): Promise<CryptoKey> {
  const wrappedKey = base64ToBuffer(wrappedKeyBase64);
  return await window.crypto.subtle.unwrapKey(
    'raw',
    wrappedKey as BufferSource,
    kek,
    { name: 'AES-KW' },
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

// --- Data Encryption ---

/** Encrypts a JSON payload using the Data Key */
export async function encryptData(data: any, dataKey: CryptoKey): Promise<{ cipherTextBase64: string, ivBase64: string }> {
  const iv = generateIV();
  const encodedData = encodeText(JSON.stringify(data));
  
  const cipherText = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as BufferSource,
      tagLength: AES_GCM_TAG_LENGTH,
    },
    dataKey,
    encodedData as BufferSource
  );

  return {
    cipherTextBase64: bufferToBase64(cipherText),
    ivBase64: bufferToBase64(iv)
  };
}

/** Decrypts a JSON payload using the Data Key */
export async function decryptData(cipherTextBase64: string, ivBase64: string, dataKey: CryptoKey): Promise<any> {
  const cipherText = base64ToBuffer(cipherTextBase64);
  const iv = base64ToBuffer(ivBase64);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv as BufferSource,
      tagLength: AES_GCM_TAG_LENGTH,
    },
    dataKey,
    cipherText as BufferSource
  );

  const decryptedText = decodeText(decryptedBuffer);
  return JSON.parse(decryptedText);
}

/** Generates a 12-word recovery phrase (basic version) */
export function generateRecoveryPhrase(): string {
  // In a real app, use a standard BIP39 wordlist. For this, we'll use a subset or random words.
  // We'll just generate strong random bytes and encode them for simplicity in this MVP, 
  // but let's provide a mock wordlist for actual "words".
  const wordlist = [
    "apple", "abandon", "ability", "absurd", "abuse", "access", "accident", "account",
    "accuse", "achieve", "acid", "acoustic", "acquire", "action", "active", "actual",
    "adapt", "add", "addict", "address", "adjust", "admit", "adult", "advance",
    "advice", "aerobic", "affair", "afford", "afraid", "again", "age", "agent",
    "agree", "ahead", "aim", "air", "airport", "aisle", "alarm", "album",
    "alcohol", "alert", "alien", "all", "alley", "allow", "almost", "alone",
    "alpha", "already", "also", "alter", "always", "amateur", "amazing", "among",
    "amount", "amused", "analyst", "anchor", "ancient", "anger", "angle", "angry",
    "animal", "ankle", "announce", "annual", "another", "answer", "antenna", "antique",
    "anxiety", "any", "apart", "apology", "appear", "apple", "approve", "april",
    "arch", "arctic", "area", "arena", "argue", "arm", "armed", "armor",
    "army", "around", "arrange", "arrest", "arrive", "arrow", "art", "artefact",
    "artist", "artwork", "ask", "aspect", "assault", "asset", "assist", "assume",
    "asthma", "athlete", "atom", "attack", "attend", "attitude", "attract", "auction",
    "audit", "august", "aunt", "author", "auto", "autumn", "average", "avocado",
    "avoid", "awake", "aware", "away", "awesome", "awful", "awkward", "axis",
    "baby", "bachelor", "bacon", "badge", "bag", "balance", "balcony", "ball"
  ];
  const phrase = [];
  const randomValues = new Uint32Array(12);
  window.crypto.getRandomValues(randomValues);
  
  for (let i = 0; i < 12; i++) {
    phrase.push(wordlist[randomValues[i] % wordlist.length]);
  }
  
  return phrase.join(' ');
}
