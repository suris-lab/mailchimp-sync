"use client";

import useSWR from "swr";
import type { GrowthStats } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useGrowthStats() {
  return useSWR<GrowthStats>("/api/growth-stats", fetcher, { refreshInterval: 30_000 });
}
