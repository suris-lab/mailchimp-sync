// Redis client with in-memory fallback for local dev.
// Supports both Upstash integration env var names:
//   UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN  (Upstash Vercel integration)
//   KV_REST_API_URL / KV_REST_API_TOKEN                (legacy Vercel KV names)

const memStore: Map<string, unknown> = new Map();
const memLists: Map<string, string[]> = new Map();

function getRedis() {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ??
    process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ??
    process.env.KV_REST_API_TOKEN;

  if (!url || !token || !url.startsWith("https://")) return null;

  try {
    const { Redis } = require("@upstash/redis");
    return new Redis({ url, token }) as import("@upstash/redis").Redis;
  } catch {
    return null;
  }
}

export async function kvGet<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  if (redis) return redis.get<T>(key);
  return (memStore.get(key) as T) ?? null;
}

export async function kvSet<T>(key: string, value: T, exSeconds?: number): Promise<void> {
  const redis = getRedis();
  if (redis) {
    if (exSeconds) {
      await redis.set(key, value, { ex: exSeconds });
    } else {
      await redis.set(key, value);
    }
    return;
  }
  memStore.set(key, value);
}

export async function kvDel(key: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    await redis.del(key);
    return;
  }
  memStore.delete(key);
}

export async function kvLpush(key: string, value: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    await redis.lpush(key, value);
    return;
  }
  const list = memLists.get(key) ?? [];
  list.unshift(value);
  memLists.set(key, list);
}

export async function kvLrange(key: string, start: number, stop: number): Promise<string[]> {
  const redis = getRedis();
  if (redis) return (await redis.lrange<string>(key, start, stop)) ?? [];
  const list = memLists.get(key) ?? [];
  return stop === -1 ? list.slice(start) : list.slice(start, stop + 1);
}
