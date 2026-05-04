import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { kvGet } from "@/lib/kv";
import type { AudienceStats, LifecycleStats, CampaignStats, StudioInput, StudioEvent } from "@/lib/types";

export const maxDuration = 60;

const CATEGORY_TONES: Record<string, string> = {
  "F&B":           "Warm, social, appetising — emphasise atmosphere, food quality, and community gathering",
  "Sailing Event": "Energetic, competitive, nautical pride — appeal to the love of sailing and the open sea",
  "Club News":     "Professional, clear, informative — concise and action-oriented for club operations",
  "Marine":        "Practical, utility-focused — communicate member convenience and facility updates clearly",
};

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

function eventLine(e: StudioEvent, i: number): string {
  const typeTag = e.eventCategory
    ? `${e.eventCategory}${e.eventType ? ` — ${e.eventType}` : ""}`
    : "";
  const tone = e.eventCategory ? CATEGORY_TONES[e.eventCategory] ?? "" : "";
  const cta = e.ctaUrl
    ? `  CTA: "${e.ctaLabel || "Learn More"}" → ${e.ctaUrl}`
    : "  CTA: (none)";

  return [
    `Event ${i + 1}: ${e.title}${typeTag ? ` (${typeTag})` : ""}`,
    tone ? `  Tone: ${tone}` : null,
    `  When: ${e.datetime}`,
    `  Details: ${e.details || "(none provided)"}`,
    cta,
  ].filter(Boolean).join("\n");
}

function buildContext(
  input: StudioInput,
  audience: AudienceStats | null,
  lifecycle: LifecycleStats | null,
  campaigns: CampaignStats | null,
): string {
  const lc = lifecycle?.current;
  const total = lc?.total ?? 0;

  const topCampaigns = (campaigns?.campaigns ?? [])
    .filter(c => c.category === "Weekly What's On")
    .sort((a, b) => b.open_rate - a.open_rate)
    .slice(0, 3)
    .map(c => `"${c.subject}" (${(c.open_rate * 100).toFixed(1)}% open)`)
    .join("\n    ");

  const objectiveDesc: Record<string, string> = {
    open_rate: "Maximise email open rate — compelling, curiosity-driven subject line and warm personal tone",
    click_rate: "Maximise click-through rate — clear event CTAs, action-oriented language",
    re_engage:  "Re-engage cold or inactive members — warm, inviting tone reminding them what they're missing",
  };

  const eventsBlock = input.events.map((e, i) => eventLine(e, i)).join("\n\n");

  return `OBJECTIVE: ${objectiveDesc[input.objective]}

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
${input.additionalNotes || "(none)"}`;
}

function buildFullPrompt(context: string): string {
  return `You are an email copywriter for Hebe Haven Yacht Club (HHYC), established 1963 in Pak Sha Wan, Sai Kung, Hong Kong. You write warm, professional, community-oriented newsletters.

${context}

Generate a "Weekly What's On" email newsletter. Output ONLY valid JSON:
{
  "subject": "subject line, max 60 characters, no emoji",
  "html": "complete HTML email body as a single string"
}

HTML requirements:
- Complete self-contained HTML document (<html>, <head>, <body>)
- Max width 600px, centred, white background
- HHYC red #eb0029 for headings, buttons, accent borders
- Font: Inter, Helvetica Neue, Arial, sans-serif — 15px base, 24px line height
- Open with: <p>Dear *|FNAME|*,</p>
- One clearly styled section per event: bold heading, date/time line, description paragraph
- Apply the tone guidance specified per event category
- For each event with a CTA URL: red (#eb0029) button, white text, border-radius 6px, padding 10px 20px, using the provided label and URL. Skip button if no CTA URL.
- Footer: thin top border, small grey text: "Hebe Haven Yacht Club · Est. 1963 · Pak Sha Wan, Sai Kung, Hong Kong"
- Unsubscribe placeholder: *|UNSUB|*
- No external images, no JavaScript, no external CSS
- Mobile-friendly inline styles only`;
}

function buildSubjectPrompt(context: string): string {
  return `You are an email copywriter for Hebe Haven Yacht Club (HHYC), established 1963 in Pak Sha Wan, Sai Kung, Hong Kong.

${context}

Generate ONLY a new subject line for the Weekly What's On newsletter. Output ONLY valid JSON:
{
  "subject": "subject line, max 60 characters, no emoji"
}`;
}

function buildCtaLabelPrompt(event: StudioEvent, objective: string): string {
  const typeTag = event.eventCategory
    ? `${event.eventCategory}${event.eventType ? ` — ${event.eventType}` : ""}`
    : "";
  const tone = event.eventCategory ? CATEGORY_TONES[event.eventCategory] ?? "" : "";

  return `You are a copywriter for Hebe Haven Yacht Club (HHYC), a yacht club in Sai Kung, Hong Kong.

Event: ${event.title}${typeTag ? ` (${typeTag})` : ""}
${tone ? `Category tone: ${tone}` : ""}
Email objective: ${objective}
${event.ctaUrl ? `CTA URL: ${event.ctaUrl}` : ""}
${event.details ? `Event details: ${event.details}` : ""}

Suggest a short, compelling CTA button label (2–4 words max) that fits this event and objective.
Output ONLY valid JSON: { "ctaLabel": "Register Now" }`;
}

async function fetchCampaigns(): Promise<CampaignStats | null> {
  const end = new Date().toISOString().slice(0, 10);
  const start = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const res = await fetch(`${base}/api/campaigns?start=${start}&end=${end}`).catch(() => null);
  return res?.ok ? (res.json() as Promise<CampaignStats>) : null;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });
  }

  const input: StudioInput = await req.json();
  const { subjectOnly, ctaLabelOnly, ctaLabelEventIndex = 0 } = input;

  const openai = new OpenAI({ apiKey });

  // ── CTA label generation (fast, single-event call) ─────────────────────────
  if (ctaLabelOnly) {
    const event = input.events[ctaLabelEventIndex];
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 400 });
    }
    const prompt = buildCtaLabelPrompt(event, input.objective);
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a copywriter. Always respond with valid JSON only." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.8,
    });
    const raw = completion.choices[0].message.content ?? "{}";
    const result = JSON.parse(raw);
    return NextResponse.json({ ctaLabel: result.ctaLabel ?? "" });
  }

  if (!subjectOnly && !input.events?.length && !input.additionalNotes) {
    return NextResponse.json({ error: "Provide at least one event or additional notes" }, { status: 400 });
  }

  const [audience, lifecycle, campaigns] = await Promise.all([
    kvGet<AudienceStats>("sync:audience_stats"),
    kvGet<LifecycleStats>("sync:lifecycle_stats"),
    fetchCampaigns(),
  ]);

  const context = buildContext(input, audience, lifecycle, campaigns);
  const prompt = subjectOnly ? buildSubjectPrompt(context) : buildFullPrompt(context);

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are an expert email copywriter. Always respond with valid JSON only — no markdown fences, no explanation." },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
    temperature: subjectOnly ? 0.9 : 0.7,
  });

  const raw = completion.choices[0].message.content ?? "{}";
  let result: { subject?: string; html?: string };
  try {
    result = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "AI returned invalid JSON", raw }, { status: 500 });
  }

  if (!result.subject) {
    return NextResponse.json({ error: "AI response missing subject", raw }, { status: 500 });
  }

  if (subjectOnly) {
    return NextResponse.json({ subject: result.subject });
  }

  if (!result.html) {
    return NextResponse.json({ error: "AI response missing html", raw }, { status: 500 });
  }

  const html = result.html.replace(/^```html\n?/, "").replace(/\n?```$/, "").trim();
  return NextResponse.json({ subject: result.subject, html });
}
