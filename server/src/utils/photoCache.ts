import type { Response } from 'express';

export type CachedPhotoEntry =
  | { kind: 'buffer'; buffer: Buffer; mime: string }
  | { kind: 'redirect'; url: string };

const MAX_CACHE_ENTRIES = 300;
const photoCache = new Map<string, CachedPhotoEntry>();

export function cleanRawPhotoUrl(url?: string | null): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('https://data:')) {
    return trimmed.replace('https://data:', 'data:');
  }
  if (trimmed.startsWith('http://data:')) {
    return trimmed.replace('http://data:', 'data:');
  }
  return trimmed;
}

export function parsePhotoToCacheEntry(rawUrl?: string | null): CachedPhotoEntry | null {
  const clean = cleanRawPhotoUrl(rawUrl);
  if (!clean) return null;

  if (clean.startsWith('data:')) {
    const commaIdx = clean.indexOf(',');
    if (commaIdx === -1) return null;
    const header = clean.slice(5, commaIdx); // e.g. image/jpeg;base64
    const mime = header.split(';')[0] || 'image/jpeg';
    const isBase64 = header.includes(';base64');
    const dataPart = clean.slice(commaIdx + 1);
    const buffer = isBase64
      ? Buffer.from(dataPart, 'base64')
      : Buffer.from(decodeURIComponent(dataPart), 'utf8');
    if (buffer.length === 0) return null;
    return { kind: 'buffer', buffer, mime };
  }

  return { kind: 'redirect', url: clean };
}

export function getCachedPhoto(key: string): CachedPhotoEntry | undefined {
  const entry = photoCache.get(key);
  if (entry) {
    // Refresh LRU recency
    photoCache.delete(key);
    photoCache.set(key, entry);
  }
  return entry;
}

export function setCachedPhoto(key: string, entry: CachedPhotoEntry): void {
  if (photoCache.has(key)) {
    photoCache.delete(key);
  } else if (photoCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = photoCache.keys().next().value;
    if (oldestKey) {
      photoCache.delete(oldestKey);
    }
  }
  photoCache.set(key, entry);
}

export function invalidatePhotoCache(keyPrefix: string): void {
  for (const key of photoCache.keys()) {
    if (key.startsWith(keyPrefix)) {
      photoCache.delete(key);
    }
  }
}

export function sendPhotoEntry(res: Response, entry: CachedPhotoEntry): void {
  if (entry.kind === 'redirect') {
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.redirect(302, entry.url);
    return;
  }

  res.setHeader('Content-Type', entry.mime);
  res.setHeader('Content-Length', String(entry.buffer.length));
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.end(entry.buffer);
}
