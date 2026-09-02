import { set, get } from 'idb-keyval';

// Key structure for the cache
const CACHE_KEY = (userId: string) => `vaultix_cache_${userId}`;

export interface VaultCacheData {
  wrapped_keys: any;
  folders: any[];
  credentials: any[];
  lastSync: string;
}

/**
 * Saves the fully ENCRYPTED vault data to IndexedDB.
 * We never store plaintext data here.
 */
export async function saveEncryptedVaultCache(userId: string, data: Omit<VaultCacheData, 'lastSync'>) {
  const cacheData: VaultCacheData = {
    ...data,
    lastSync: new Date().toISOString()
  };
  await set(CACHE_KEY(userId), cacheData);
}

/**
 * Loads the encrypted vault data from IndexedDB.
 */
export async function loadEncryptedVaultCache(userId: string): Promise<VaultCacheData | undefined> {
  return await get(CACHE_KEY(userId));
}
