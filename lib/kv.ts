// Vercel KV client with in-memory fallback for local dev (mirrors marketing-dashboard/lib/assets.ts pattern)

const memStore: Map<string, unknown> = new Map();
const memLists: Map<string, string[]> = new Map();

async function getKv() {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  // @vercel/kv requires an Upstash REST URL (https://). redis:// protocol URLs
  // are not supported and will throw — fall back to in-memory in that case.
  if (!url || !token || !url.startsWith("https://")) return null;
  try {
    const { kv } = await import("@vercel/kv");
    return kv;
  } catch {
    return null;
  }
}

export async function kvGet<T>(key: string): Promise<T | null> {
  const kv = await getKv();
  if (kv) return kv.get<T>(key);
  return (memStore.get(key) as T) ?? null;
}

export async function kvSet<T>(key: string, value: T, exSeconds?: number): Promise<void> {
  const kv = await getKv();
  if (kv) {
    if (exSeconds) {
      await kv.set(key, value, { ex: exSeconds });
    } else {
      await kv.set(key, value);
    }
    return;
  }
  memStore.set(key, value);
}

export async function kvDel(key: string): Promise<void> {
  const kv = await getKv();
  if (kv) {
    await kv.del(key);
    return;
  }
  memStore.delete(key);
}

export async function kvLpush(key: string, value: string): Promise<void> {
  const kv = await getKv();
  if (kv) {
    await kv.lpush(key, value);
    return;
  }
  const list = memLists.get(key) ?? [];
  list.unshift(value);
  memLists.set(key, list);
}

export async function kvLrange(key: string, start: number, stop: number): Promise<string[]> {
  const kv = await getKv();
  if (kv) return (await kv.lrange<string>(key, start, stop)) ?? [];
  const list = memLists.get(key) ?? [];
  return stop === -1 ? list.slice(start) : list.slice(start, stop + 1);
}
