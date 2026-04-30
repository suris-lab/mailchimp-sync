"use client";

import useSWR from "swr";
import type { CampaignStats } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useCampaigns(start: string, end: string) {
  return useSWR<CampaignStats>(
    `/api/campaigns?start=${start}&end=${end}`,
    fetcher,
    { refreshInterval: 300_000 }, // campaigns don't change mid-session
  );
}
