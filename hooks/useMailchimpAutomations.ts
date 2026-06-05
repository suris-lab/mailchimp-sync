"use client";

import useSWR from "swr";
import type { MailchimpAutomationsResponse } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useMailchimpAutomations() {
  const { data, error, isLoading, mutate } = useSWR<MailchimpAutomationsResponse>(
    "/api/mailchimp-automations",
    fetcher,
    { refreshInterval: 300_000, revalidateOnFocus: false, revalidateOnMount: true },
  );

  async function refresh() {
    await mutate(
      fetch("/api/mailchimp-automations?bust=1").then((r) => r.json()),
      { revalidate: false },
    );
  }

  return { data, error, isLoading, mutate, refresh };
}
