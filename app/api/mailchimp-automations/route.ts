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

// Try multiple candidate field names for the journey title
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractTitle(obj: any, fallback: string): string {
  return (
    (typeof obj?.journey_name === "string" && obj.journey_name) ||  // Mailchimp CJ API
    (typeof obj?.name === "string" && obj.name) ||
    (typeof obj?.title === "string" && obj.title) ||
    (typeof obj?.workflow_title === "string" && obj.workflow_title) ||
    obj?.settings?.title ||
    obj?.settings?.name ||
    fallback
  );
}

// Try multiple candidate field names for journey progress stats
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractStats(obj: any): { started: number | null; in_progress: number | null; completed: number | null } {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pick = (candidates: any[]): number | null => {
    for (const v of candidates) {
      if (typeof v === "number") return v;
    }
    return null;
  };

  // Mailchimp CJ API: stats live under obj.stats with exact keys started/in_progress/completed
  const r = obj?.stats ?? obj?.reporting ?? obj?.report_summary ?? {};
  return {
    started: pick([
      r?.started,                                                    // Mailchimp CJ: stats.started
      obj?.contacts_total, obj?.total_contacts, obj?.contacts_entered,
      r?.total_contacts, r?.contacts_total, r?.entered,
    ]),
    in_progress: pick([
      r?.in_progress,                                               // Mailchimp CJ: stats.in_progress
      obj?.contacts_active, obj?.active_contacts, obj?.contacts_in_progress,
      r?.active_contacts, r?.contacts_active, r?.active,
    ]),
    completed: pick([
      r?.completed,                                                 // Mailchimp CJ: stats.completed
      obj?.contacts_completed, obj?.completed_contacts, obj?.contacts_exited,
      r?.completed_contacts, r?.contacts_completed, r?.exited,
    ]),
  };
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const bust  = params.has("bust");
    const debug = params.has("debug");

    const apiKey = process.env.MAILCHIMP_API_KEY!;
    const server = process.env.MAILCHIMP_SERVER_PREFIX!;
    const authHeader = `Basic ${Buffer.from(`anystring:${apiKey}`).toString("base64")}`;
    const mc = await getMailchimp();

    // ── Debug mode: always bypasses cache, returns raw Mailchimp data ──────────
    if (debug) {
      const classicRes = await mc.automations.list({ count: 50 });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const classicRaw: any[] = classicRes?.automations ?? [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let journeyDebug: any = null;
      try {
        const jRes = await fetch(
          `https://${server}.api.mailchimp.com/3.0/customer-journeys/journeys?count=50`,
          { headers: { Authorization: authHeader } },
        );
        const body = await jRes.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const firstJourney = body?.journeys?.[0] ?? null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let firstDetail: any = null;
        if (firstJourney?.id) {
          const dRes = await fetch(
            `https://${server}.api.mailchimp.com/3.0/customer-journeys/journeys/${firstJourney.id}`,
            { headers: { Authorization: authHeader } },
          );
          firstDetail = await dRes.json();
        }
        journeyDebug = {
          status: jRes.status,
          list_first_journey_keys: firstJourney ? Object.keys(firstJourney) : [],
          list_first_journey: firstJourney,
          detail_first_journey_keys: firstDetail ? Object.keys(firstDetail) : [],
          detail_first_journey: firstDetail,
        };
      } catch (e) {
        journeyDebug = { error: String(e) };
      }

      return NextResponse.json({
        classic: { total_items: classicRes?.total_items, count: classicRaw.length, sample: classicRaw.slice(0, 2) },
        customer_journeys: journeyDebug,
      });
    }

    // ── Normal path ────────────────────────────────────────────────────────────
    if (!bust) {
      const cached = await kvGet<MailchimpAutomationsResponse>(KV_KEY);
      if (cached) return NextResponse.json(cached);
    }

    // Classic automations (legacy editor)
    const classicRes = await mc.automations.list({ count: 50 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const classicRaw: any[] = classicRes?.automations ?? [];

    const classicAutomations: MailchimpAutomation[] = classicRaw.map((a) => ({
      id: a.id,
      title: a.settings?.title ?? a.id,
      status: (a.status ?? "save") as AutomationStatus,
      emails_sent: a.emails_sent ?? 0,
      ...extractStats(a),
      start_time: a.start_time ?? null,
      workflow_type: a.trigger_settings?.workflow_type ?? "emailSeries",
    }));

    // Customer Journeys (newer automation builder)
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

        journeyAutomations = await Promise.all(
          journeyRaw.map(async (j) => {
            let status: AutomationStatus = "save";
            if (j.status === "published" || j.status === "sending") status = "sending";
            else if (j.status === "paused") status = "paused";

            // Fetch detail to get name + stats
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let detail: any = null;
            try {
              const dRes = await fetch(
                `https://${server}.api.mailchimp.com/3.0/customer-journeys/journeys/${j.id}`,
                { headers: { Authorization: authHeader } },
              );
              if (dRes.ok) detail = await dRes.json();
            } catch { /* ignore */ }

            const title =
              extractTitle(detail ?? {}, "") ||
              extractTitle(j, `Journey ${j.id}`);

            const stats = extractStats(detail ?? j);

            return {
              id: `cj_${j.id}`,
              title,
              status,
              emails_sent: j.emails_sent ?? 0,
              ...stats,
              start_time: j.created_at ?? null,
              workflow_type: "customerJourney",
            };
          }),
        );
      }
    } catch { /* endpoint may not exist for all accounts */ }

    const automations = [...classicAutomations, ...journeyAutomations];

    const ORDER: Record<string, number> = { sending: 0, paused: 1, save: 2 };
    automations.sort((a, b) => {
      const od = (ORDER[a.status] ?? 3) - (ORDER[b.status] ?? 3);
      return od !== 0 ? od : (b.emails_sent - a.emails_sent);
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
    return NextResponse.json({ error: "Failed to fetch automations" }, { status: 500 });
  }
}
