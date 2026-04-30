import { NextRequest, NextResponse } from "next/server";
import type { CampaignRecord, CampaignStats, CampaignCategory } from "@/lib/types";

function categorize(subject: string): CampaignCategory {
  const s = subject.toLowerCase();
  if (s.includes("what's on") || s.includes("whats on")) return "Weekly What's On";
  if (s.includes("member notice") || s.includes("member update") || s.includes("member alert"))
    return "Member Notice";
  return "Standalone EDM";
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const start = searchParams.get("start") ?? "";
  const end   = searchParams.get("end")   ?? "";

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mc = ((await import("@mailchimp/mailchimp_marketing")).default) as any;
    mc.setConfig({
      apiKey: process.env.MAILCHIMP_API_KEY!,
      server: process.env.MAILCHIMP_SERVER_PREFIX!,
    });

    const res = await mc.reports.getAllCampaignReports({
      count: 500,
      ...(start && { since_send_time: `${start}T00:00:00+00:00` }),
      ...(end   && { before_send_time: `${end}T23:59:59+00:00` }),
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: any[] = res?.reports ?? [];

    const campaigns: CampaignRecord[] = raw
      .filter((r) => r.emails_sent > 0) // skip test sends
      .map((r) => {
        const subject = r.subject_line ?? r.campaign_title ?? "—";
        return {
          id:           r.id,
          subject,
          sent_time:    r.send_time ?? "",
          emails_sent:  r.emails_sent ?? 0,
          opens:        r.opens?.unique_opens ?? 0,
          open_rate:    r.opens?.open_rate ?? 0,
          clicks:       r.clicks?.unique_clicks ?? r.clicks?.unique_subscriber_clicks ?? 0,
          click_rate:   r.clicks?.click_rate ?? 0,
          unsubscribes: r.unsubscribed ?? 0,
          category:     categorize(subject),
        };
      })
      .sort((a, b) => b.sent_time.localeCompare(a.sent_time));

    const count         = campaigns.length;
    const total_sent    = campaigns.reduce((s, c) => s + c.emails_sent, 0);
    const avg_open_rate = count > 0 ? campaigns.reduce((s, c) => s + c.open_rate, 0) / count : 0;
    const avg_ctr       = count > 0 ? campaigns.reduce((s, c) => s + c.click_rate, 0) / count : 0;

    const stats: CampaignStats = {
      campaigns,
      totals: { count, total_sent, avg_open_rate, avg_ctr },
    };

    return NextResponse.json(stats);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
