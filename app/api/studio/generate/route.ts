import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { kvGet } from "@/lib/kv";
import type { AudienceStats, LifecycleStats, CampaignStats, StudioInput } from "@/lib/types";

export const maxDuration = 60;

function topN(obj: Record<string, number>, n = 5): string {
  return Object.entries(obj)
    .filter(([k]) => k !== "Blank")
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k, v]) => `${k} (${v})`)
    .join(", ");
}

function pct(n: number, total: number) {
  return total > 0 ? `${((n / total) * 100).toFixed(0)}%` : "0%";
}

function buildPrompt(input: StudioInput, audience: AudienceStats | null, lifecycle: LifecycleStats | null, campaigns: CampaignStats | null): string {
  const lc = lifecycle?.current;
  const total = lc?.total ?? 0;

  const topCampaigns = (campaigns?.campaigns ?? [])
    .filter(c => c.category === "Weekly What's On")
    .sort((a, b) => b.open_rate - a.open_rate)
    .slice(0, 3)
    .map(c => `"${c.subject}" (${(c.open_rate * 100).toFixed(1)}% open)`)
    .join("\n    ");

  const objectiveDesc: Record<string, string> = {
    open_rate: "Maximise email open rate — write a compelling, curiosity-driven subject line and warm personal tone",
    click_rate: "Maximise click-through rate — focus on clear event CTAs and action-oriented language",
    re_engage:  "Re-engage cold or inactive members — use a warm, inviting tone that reminds them what they're missing at the club",
  };

  const eventsBlock = input.events.map((e, i) =>
    `Event ${i + 1}: ${e.title}\n  When: ${e.datetime}\n  Details: ${e.details || "(none provided)"}`
  ).join("\n\n");

  return `You are an email copywriter for Hebe Haven Yacht Club (HHYC), a prestigious yacht club established in 1963 in Pak Sha Wan, Sai Kung, Hong Kong. You write warm, professional, community-oriented email newsletters.

OBJECTIVE: ${objectiveDesc[input.objective]}

AUDIENCE INSIGHTS (live CRM data):
- Total contacts: ${total}
- Active (opened email ≤30 days): ${lc ? pct(lc.active, total) : "unknown"}
- Cold (30–90 days inactive): ${lc ? pct(lc.cold, total) : "unknown"}
- Dead (90+ days or never opened): ${lc ? pct(lc.dead, total) : "unknown"}
- Database health score: ${lifecycle?.healthScore ?? "unknown"}/100
- Top member interests: ${audience ? topN(audience.tags.interest) : "Sailing, Swimming, Tennis"}
- Top facilities used: ${audience ? topN(audience.tags.facility) : "unknown"}

CAMPAIGN HISTORY:
- Average open rate: ${campaigns ? `${(campaigns.totals.avg_open_rate * 100).toFixed(1)}%` : "unknown"}
- Average CTR: ${campaigns ? `${(campaigns.totals.avg_ctr * 100).toFixed(1)}%` : "unknown"}
- Top performing "Weekly What's On" subject lines:
    ${topCampaigns || "(no history yet)"}

THIS WEEK'S EVENTS:
${eventsBlock || "(no events provided)"}

ADDITIONAL NOTES FROM EDITOR:
${input.additionalNotes || "(none)"}

Generate a "Weekly What's On" email newsletter. Output ONLY valid JSON in this exact shape:
{
  "subject": "subject line, max 60 characters, no emoji",
  "html": "complete HTML email body as a single string"
}

HTML requirements:
- Complete, self-contained HTML document (include <html>, <head>, <body> tags)
- Max width 600px, centred, white background
- HHYC red #eb0029 used for headings, buttons, and accent borders
- Font: Inter, Helvetica Neue, Arial, sans-serif — 15px base, 24px line height
- Open with: <p>Dear *|FNAME|*,</p>
- One clearly styled section per event with: bold heading, date/time line, short description paragraph
- Closing CTA button (#eb0029 background, white text) appropriate for the objective
- Footer: thin top border, small grey text: "Hebe Haven Yacht Club · Est. 1963 · Pak Sha Wan, Sai Kung, Hong Kong"
- Unsubscribe placeholder: *|UNSUB|*
- No external images, no JavaScript, no external CSS
- Mobile-friendly inline styles only`;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });
  }

  const input: StudioInput = await req.json();
  if (!input.events?.length && !input.additionalNotes) {
    return NextResponse.json({ error: "Provide at least one event or additional notes" }, { status: 400 });
  }

  const [audience, lifecycle, campaignsRaw] = await Promise.all([
    kvGet<AudienceStats>("sync:audience_stats"),
    kvGet<LifecycleStats>("sync:lifecycle_stats"),
    // Fetch last 90 days of campaigns from internal API for context
    (async () => {
      const end = new Date().toISOString().slice(0, 10);
      const start = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
      const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const res = await fetch(`${base}/api/campaigns?start=${start}&end=${end}`).catch(() => null);
      return res?.ok ? (res.json() as Promise<CampaignStats>) : null;
    })(),
  ]);

  const prompt = buildPrompt(input, audience, lifecycle, campaignsRaw);

  const openai = new OpenAI({ apiKey });
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are an expert email copywriter. Always respond with valid JSON only — no markdown fences, no explanation." },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.7,
  });

  const raw = completion.choices[0].message.content ?? "{}";
  let result: { subject?: string; html?: string };
  try {
    result = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "AI returned invalid JSON", raw }, { status: 500 });
  }

  if (!result.subject || !result.html) {
    return NextResponse.json({ error: "AI response missing subject or html", raw }, { status: 500 });
  }

  // Strip any accidental markdown fences from HTML
  const html = result.html.replace(/^```html\n?/, "").replace(/\n?```$/, "").trim();

  return NextResponse.json({ subject: result.subject, html });
}
