"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useBackupStatus() {
  const { data } = useSWR<{ last_backup_at: string | null }>(
    "/api/backup-status",
    fetcher,
    { refreshInterval: 300_000, revalidateOnFocus: false } // refresh every 5 min
  );
  return data?.last_backup_at ?? null;
}
