"use client";

import useSWR from "swr";
import type { SurveyInsights } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useSurveyInsights() {
  const { data, error, isLoading, mutate } = useSWR<SurveyInsights | null>(
    "/api/survey-insights",
    fetcher,
    { refreshInterval: 300_000, revalidateOnFocus: false, revalidateOnMount: true },
  );

  async function refresh() {
    await mutate(
      fetch("/api/survey-insights?bust=1").then((r) => r.json()),
      { revalidate: false },
    );
  }

  return { data, error, isLoading, refresh };
}
