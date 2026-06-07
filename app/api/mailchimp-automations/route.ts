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
    const params = new URL(request.url).searchParams;
    const bust  = params.has("bust");
    const debug = params.has("debug");

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

    // Debug: return raw Mailchimp responses before any mapping
    if (debug) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let journeyDebug: any = null;
      try {
        const jRes = await fetch(
          `https://${server}.api.mailchimp.com/3.0/customer-journeys/journeys?count=50`,
          { headers: { Authorization: authHeader } },
        );
        journeyDebug = { status: jRes.status, body: await jRes.json() };
      } catch (e) {
        journeyDebug = { error: String(e) };
      }
      return NextResponse.json({
        classic: { total_items: classicRes?.total_items, count: classicRaw.length, sample: classicRaw.slice(0, 2) },
        customer_journeys: journeyDebug,
      });
    }

    const classicAutomations: MailchimpAutomation[] = classicRaw.map((a) => ({
      id: a.id,
      title: a.settings?.title ?? a.id,
      status: (a.status ?? "save") as AutomationStatus,
      emails_sent: a.emails_sent ?? 0,
      subscriber_count: a.recipients?.recipient_count ?? 0,
      open_rate: a.report_summary?.open_rate ?? null,
      click_rate: a.report_summary?.click_rate ?? null,
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
          // Mailchimp CJ API uses varying field names across accounts/versions
          const title: string =
            (typeof j.name === "string" && j.name) ||
            (typeof j.title === "string" && j.title) ||
            j.settings?.title ||
            j.settings?.name ||
            j.workflow_title ||
            `Journey ${j.id}`;
          return {
            id: `cj_${j.id}`,
            title,
            status,
            emails_sent: j.emails_sent ?? 0,
            subscriber_count: j.recipients?.recipient_count ?? 0,
            open_rate: j.report_summary?.open_rate ?? null,
            click_rate: j.report_summary?.click_rate ?? null,
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
