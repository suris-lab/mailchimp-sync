"use client";

import useSWR from "swr";
import type { MembershipStats } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useMembershipStats() {
  const { data, error, isLoading, mutate } = useSWR<MembershipStats | null>(
    "/api/membership-stats",
    fetcher,
    { refreshInterval: 0, revalidateOnFocus: false },
  );
  return { data, error, isLoading, mutate };
}
