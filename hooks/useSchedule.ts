"use client";

import useSWR from "swr";
import type { SyncSchedule } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useSchedule() {
  const { data, error, isLoading, mutate } = useSWR<SyncSchedule>(
    "/api/schedule",
    fetcher,
    { revalidateOnFocus: false }
  );
  return { data, error, isLoading, mutate };
}
