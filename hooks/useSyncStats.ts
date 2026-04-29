"use client";

import useSWR from "swr";
import type { SyncStats } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useSyncStats() {
  const { data, error, isLoading, mutate } = useSWR<SyncStats>(
    "/api/sync-stats",
    fetcher,
    { refreshInterval: 30_000, revalidateOnFocus: false }
  );
  return { data, error, isLoading, mutate };
}
