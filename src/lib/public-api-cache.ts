import { apiUrl } from '@/lib/api';

type CacheEntry = { expiresAt: number; value: unknown };

const responseCache = new Map<string, CacheEntry>();
const pendingRequests = new Map<string, Promise<unknown>>();

export async function fetchPublicJson<T>(path: string, ttlMs = 60_000): Promise<T> {
  const url = apiUrl(path);
  const cached = responseCache.get(url);
  if (cached && cached.expiresAt > Date.now()) return cached.value as T;

  const pending = pendingRequests.get(url);
  if (pending) return pending as Promise<T>;

  const request = fetch(url)
    .then(async (response) => {
      const value = await response.json() as T & { error?: string };
      if (!response.ok) throw new Error(value.error || 'Unable to load public data');
      responseCache.set(url, { value, expiresAt: Date.now() + ttlMs });
      return value;
    })
    .finally(() => pendingRequests.delete(url));

  pendingRequests.set(url, request);
  return request;
}
