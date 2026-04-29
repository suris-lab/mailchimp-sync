"use client";

import useSWR from "swr";
import type { SyncLogsResponse } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useSyncLogs(start: string, end: string) {
  const { data, error, isLoading, mutate } = useSWR<SyncLogsResponse>(
    `/api/sync-logs?start=${start}&end=${end}`,
    fetcher,
    { revalidateOnFocus: false }
  );
  return { data, error, isLoading, mutate };
}
