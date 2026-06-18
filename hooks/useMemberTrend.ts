"use client";

import useSWR from "swr";
import type { MemberTrendStats } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useMemberTrend() {
  return useSWR<MemberTrendStats | null>("/api/member-trend", fetcher, {
    revalidateOnFocus: false,
  });
}
