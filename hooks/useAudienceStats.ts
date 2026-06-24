"use client";

import useSWR from "swr";
import type { AudienceStatsResponse } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useAudienceStats() {
  return useSWR<AudienceStatsResponse>("/api/audience-stats", fetcher, {
    revalidateOnFocus: false,
  });
}
