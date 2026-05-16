/**
 * Three-layer cache for WOFF2 font bytes.
 *
 * Layer 1: in-memory `Map<string, ArrayBuffer>` (session-scoped, fastest).
 * Layer 2: IndexedDB (persists across reloads).
 * Layer 3: caller-provided fetcher (network).
 *
 * Keys are `${family}:${weight}` strings. IDB stores ArrayBuffer values
 * natively — we deliberately avoid localStorage (base64 inflates, quota too low).
 *
 * See `docs/superpowers/research/2026-05-16-google-fonts.md` § 3 for rationale.
 */
import type { FontWeight } from 'fitfull';

const DB_NAME = 'fitfull-fonts';
const STORE = 'bytes';
const DB_VERSION = 1;

const memCache = new Map<string, ArrayBuffer>();

function cacheKey(family: string, weight: FontWeight): string {
    return `${family}:${weight}`;
}

function hasIndexedDB(): boolean {
    return typeof indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE)) {
                db.createObjectStore(STORE);
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function idbGet(key: string): Promise<ArrayBuffer | undefined> {
    if (!hasIndexedDB()) return undefined;
    try {
        const db = await openDb();
        return await new Promise<ArrayBuffer | undefined>((resolve, reject) => {
            const tx = db.transaction(STORE, 'readonly');
            const req = tx.objectStore(STORE).get(key);
            req.onsuccess = () => resolve(req.result as ArrayBuffer | undefined);
            req.onerror = () => reject(req.error);
        });
    } catch {
        return undefined;
    }
}

async function idbPut(key: string, value: ArrayBuffer): Promise<void> {
    if (!hasIndexedDB()) return;
    try {
        const db = await openDb();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).put(value, key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch {
        /* Fall back to memory-only — private browsing, SSR, quota exceeded etc. */
    }
}

async function idbHas(key: string): Promise<boolean> {
    if (!hasIndexedDB()) return false;
    try {
        const db = await openDb();
        return await new Promise<boolean>((resolve, reject) => {
            const tx = db.transaction(STORE, 'readonly');
            // getKey returns the key if present, undefined if not — cheaper than fetching the bytes.
            const req = tx.objectStore(STORE).getKey(key);
            req.onsuccess = () => resolve(req.result !== undefined);
            req.onerror = () => reject(req.error);
        });
    } catch {
        return false;
    }
}

async function idbClear(): Promise<void> {
    if (!hasIndexedDB()) return;
    try {
        const db = await openDb();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).clear();
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch {
        /* ignore */
    }
}

/**
 * Get font bytes for `${family}:${weight}`. Checks memory, then IDB, then
 * falls back to the caller-provided fetcher. Populates both upper layers on
 * a fetcher hit.
 */
export async function getFontBytes(
    family: string,
    weight: FontWeight,
    fetcher: () => Promise<ArrayBuffer>,
): Promise<ArrayBuffer> {
    const key = cacheKey(family, weight);

    const mem = memCache.get(key);
    if (mem) return mem;

    const disk = await idbGet(key);
    if (disk) {
        memCache.set(key, disk);
        return disk;
    }

    const bytes = await fetcher();
    memCache.set(key, bytes);
    await idbPut(key, bytes);
    return bytes;
}

/** Whether the bytes for `${family}:${weight}` are present in memory or IDB. */
export async function hasInCache(family: string, weight: FontWeight): Promise<boolean> {
    const key = cacheKey(family, weight);
    if (memCache.has(key)) return true;
    return idbHas(key);
}

/** Wipe both layers. Useful in dev / for a "clear cache" button. */
export async function clearCache(): Promise<void> {
    memCache.clear();
    await idbClear();
}
