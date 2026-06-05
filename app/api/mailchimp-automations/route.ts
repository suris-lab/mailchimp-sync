import { NextResponse } from "next/server";
import { kvGet, kvSet } from "@/lib/kv";
import type { MailchimpAutomation, MailchimpAutomationsResponse, AutomationStatus } from "@/lib/types";

const KV_KEY = "mc:automations";
const CACHE_TTL = 300; // 5 minutes

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
    const apiKey = process.env.MAILCHIMP_API_KEY!;
    const server = process.env.MAILCHIMP_SERVER_PREFIX!;
    const authHeader = `Basic ${Buffer.from(`anystring:${apiKey}`).toString("base64")}`;

    // Classic automations (legacy editor)
    const classicRes = await mc.automations.list({ count: 50 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const classicRaw: any[] = classicRes?.automations ?? [];

    const classicAutomations: MailchimpAutomation[] = classicRaw.map((a) => ({
      id: a.id,
      title: a.settings?.title ?? a.id,
      status: (a.status ?? "save") as AutomationStatus,
      emails_sent: a.emails_sent ?? 0,
      start_time: a.start_time ?? null,
      workflow_type: a.trigger_settings?.workflow_type ?? "emailSeries",
    }));

    // Customer Journeys (newer automation builder) — best-effort
    let journeyAutomations: MailchimpAutomation[] = [];
    try {
      const jRes = await fetch(
        `https://${server}.api.mailchimp.com/3.0/customer-journeys/journeys?count=50`,
        { headers: { Authorization: authHeader } },
      );
      if (jRes.ok) {
        const jData = await jRes.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const journeyRaw: any[] = jData?.journeys ?? [];
        journeyAutomations = journeyRaw.map((j) => {
          let status: AutomationStatus = "save";
          if (j.status === "published" || j.status === "sending") status = "sending";
          else if (j.status === "paused") status = "paused";
          return {
            id: `cj_${j.id}`,
            title: j.name ?? j.id,
            status,
            emails_sent: j.emails_sent ?? 0,
            start_time: j.created_at ?? null,
            workflow_type: "customerJourney",
          };
        });
      }
    } catch { /* endpoint may not exist for all accounts */ }

    const automations = [...classicAutomations, ...journeyAutomations];

    // Sort: sending first, then paused, then drafts; secondary sort by emails_sent desc
    const ORDER: Record<string, number> = { sending: 0, paused: 1, save: 2 };
    automations.sort((a, b) => {
      const od = (ORDER[a.status] ?? 3) - (ORDER[b.status] ?? 3);
      return od !== 0 ? od : b.emails_sent - a.emails_sent;
    });

    const payload: MailchimpAutomationsResponse = {
      automations,
      total_items: automations.length,
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
