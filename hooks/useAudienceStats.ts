"use client";

import useSWR from "swr";
import type { AudienceStats } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useAudienceStats() {
  return useSWR<AudienceStats | null>("/api/audience-stats", fetcher, {
    revalidateOnFocus: false,
  });
}
