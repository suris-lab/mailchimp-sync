"use client";

import useSWR from "swr";
import type { MemberTrendStats } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useMemberTrend() {
  return useSWR<MemberTrendStats | null>("/api/member-trend", fetcher, {
    // Sheet edits invalidate the server cache after sync. Refresh this client
    // view as well so an already-open dashboard reflects the new member count
    // without requiring the operator to reload the page manually.
    revalidateOnFocus: true,
    refreshInterval: 60_000,
    refreshWhenHidden: false,
  });
}
