import { NextResponse } from "next/server";
import { kvGet, kvSet } from "@/lib/kv";
import type { MailchimpAutomation, MailchimpAutomationsResponse } from "@/lib/types";

const KV_KEY = "mc:automations";
const CACHE_TTL = 300; // 5 minutes — status can change

async function getMailchimp() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mc = ((await import("@mailchimp/mailchimp_marketing")).default) as any;
  mc.setConfig({
    apiKey: process.env.MAILCHIMP_API_KEY!,
    server: process.env.MAILCHIMP_SERVER_PREFIX!,
  });
  return mc;
}

export async function GET(request: Request) {
  try {
    const bust = new URL(request.url).searchParams.has("bust");

    if (!bust) {
      const cached = await kvGet<MailchimpAutomationsResponse>(KV_KEY);
      if (cached) return NextResponse.json(cached);
    }

    const mc = await getMailchimp();

    // Classic automations (email series, welcome flows, etc.)
    const res = await mc.automations.list({ count: 50 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: any[] = res?.automations ?? [];

    const automations: MailchimpAutomation[] = raw.map((a) => ({
      id: a.id,
      title: a.settings?.title ?? a.id,
      status: a.status ?? "save",
      emails_sent: a.emails_sent ?? 0,
      start_time: a.start_time ?? null,
      workflow_type: a.trigger_settings?.workflow_type ?? "emailSeries",
    }));

    // Sort: sending first, then paused, then drafts; secondary sort by emails_sent desc
    const ORDER: Record<string, number> = { sending: 0, paused: 1, save: 2 };
    automations.sort((a, b) => {
      const od = (ORDER[a.status] ?? 3) - (ORDER[b.status] ?? 3);
      return od !== 0 ? od : b.emails_sent - a.emails_sent;
    });

    const payload: MailchimpAutomationsResponse = {
      automations,
      total_items: res?.total_items ?? automations.length,
      computed_at: new Date().toISOString(),
    };

    await kvSet(KV_KEY, payload, CACHE_TTL);
    return NextResponse.json(payload);
  } catch (err) {
    console.error("[mailchimp-automations]", err);
    return NextResponse.json(
      { error: "Failed to fetch automations" },
      { status: 500 },
    );
  }
}
