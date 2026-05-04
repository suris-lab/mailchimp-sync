import useSWR from "swr";
import type { StudioDraft } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useStudioDrafts() {
  const { data, isLoading, mutate } = useSWR<{ drafts: StudioDraft[]; trash: StudioDraft[] }>(
    "/api/studio/drafts",
    fetcher,
    { revalidateOnFocus: true }
  );

  return {
    drafts: data?.drafts ?? [],
    trash:  data?.trash  ?? [],
    isLoading,
    mutate,
  };
}
