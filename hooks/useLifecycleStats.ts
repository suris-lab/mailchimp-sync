"use client";

import useSWR from "swr";
import type { LifecycleStats } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useLifecycleStats() {
  return useSWR<LifecycleStats | null>("/api/lifecycle-stats", fetcher, {
    refreshInterval: 30_000,
    revalidateOnFocus: false,
  });
}
