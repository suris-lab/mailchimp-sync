import { NextResponse } from "next/server";
import { kvGet, kvSet } from "@/lib/kv";
import { readRawSheet } from "@/tools/google-sheets";
import type {
  SurveyInsights, SurveyAreaStat, SurveySegmentStat,
  SurveyActionItem, CommentTheme, SurveyDataQuality,
} from "@/lib/types";

// ── Config ────────────────────────────────────────────────────────────────────

const SURVEY_SHEET_ID = "1xXYioBArLe4uVlWKmRaY8ri8DXTc0OzaHiG3ZvRcITU";
// This route NEVER reads from process.env.SHEET_ID (CRM). Always SURVEY_SHEET_ID.
const KV_KEY   = "survey:insights_2026";
const CACHE_TTL = 300; // 5 minutes — live survey data

const JOIN_KEY = "Entry ID";

// Priority score weights (0–1, must sum to 1.0)
const WEIGHTS = { importance: 0.40, satisfaction: 0.35, comments: 0.25 };

// ── Column maps (confirmed from sheet inspection 2026-06-10) ─────────────────

const R1 = {
  membership_category:  "1. What is your membership category? 您的會籍類別是？",
  membership_cat_other: "1a. Please specify 請註明",
  membership_length:    "2. How long have you been a member of HHYC?",
  main_usage:           "3. Which of the following best describes how you mainly use the Club?",
  visit_frequency:      "4. On average, how often do you visit the Club?",
  satisfaction_overall: "5. Overall, how satisfied are you with your HHYC membership experience?",
  nps_score:            "6. How likely are you to recommend HHYC to a friend, or suitable prospective member?",
  nps_reason:           "7. What is the main reason for your score above?",
  improvement_trend:    "8. Compared with one year ago, do you feel the Club has:",
  best_thing:           "9. What is the one thing HHYC currently does best?",
  improve_thing:        "10. What is the one thing HHYC most needs to improve?",
  clubhouse_ratings:    "11. Clubhouse and facilities",
  fnb_ratings:          "12. Food and Beverage",
  marine_ratings:       "13. Marine facilities and services",
  sailing_ratings:      "14. Sailing activities and programmes",
  most_important:       "15. Which areas are most important to your overall satisfaction as a member?",
  most_important_other: "15a. Please specify 請註明",
  priority_improve:     "16. Where should the Club prioritise improvement over the next 12 months?",
  priority_other:       "16a. Please specify 請註明",
  highest_priority:     "17. Of the areas you selected above, which ONE should be the highest priority and why?",
  comm_satisfaction:    "18. How satisfied are you with the Club’s communication with members?",
  comm_channels:        "19. Which channels do you usually use to receive Club information?",
  comm_channels_other:  "19a. Please specify 請註明",
  comm_info_wanted:     "20. What type of Club information would you like to receive more clearly or more regularly?",
  comm_info_other:      "20a. Please specify 請註明",
} as const;

const R2 = {
  website_rating:      "21. How would you rate the clarity of the Club website? 您對本會官方網站的清晰度評分如何",
  membership_value:    "22. How would you rate the overall value of your HHYC membership?",
  referral_aware:      "23. Were you aware of HHYC’s existing Member Referral Programme? 您是否知道本會現有的會員推薦計劃？",
  referral_attractive: "23a. How attractive is the existing Member Referral Programme to you?  您認為現有會員推薦計劃的吸引力如何？",
  referral_improve:    "24. What would make the Member Referral Programme more attractive to you? 哪些安排可令會員推薦計劃更具吸引力?",
  privilege_value:     "25. How valuable do you find the privileges and benefits currently available to HHYC members? 您認為本會現時提供的會員專享禮遇及福利價值如何？",
  final_comments:      "26. Is there anything else you would like the Club, General Committee, or management team to know? 您還有其他任何想法，希望讓本會、執行委員會或管理團隊了解嗎？",
} as const;

// ── Rating helpers ────────────────────────────────────────────────────────────

const RATING_TEXT_MAP: Record<string, number> = {
  "Very Dissatisfied": 1, "Dissatisfied": 2, "Neutral": 3,
  "Satisfied": 4, "Very Satisfied": 5,
};
const NOT_APPLICABLE = [
  "Not applicable / I do not use this", "Not Applicable", "N/A", "n/a",
];

// Q25 privilege value labels → numeric (different scale from RATING_TEXT_MAP)
const PRIVILEGE_VALUE_MAP: Record<string, number> = {
  "Not valuable": 1, "Slightly valuable": 2, "Moderately valuable": 3,
  "Valuable": 4, "Very valuable": 5,
};

function parseRating(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw);
  if (!isNaN(n) && n >= 1 && n <= 5) return n;
  return RATING_TEXT_MAP[normBilingual(raw)] ?? null;
}

function parseNps(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw);
  if (!isNaN(n) && n >= 0 && n <= 10) return n;
  return null;
}

// Parse "Category:\nRating\nCategory:\nRating" sub-rating blocks (Q11–Q14)
function parseSubRatings(text: string): Record<string, number | null> {
  if (!text) return {};
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const result: Record<string, number | null> = {};
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const cat   = normBilingual(lines[i].replace(/:$/, "").trim());
    const rtext = normBilingual(lines[i + 1].trim());
    result[cat] = NOT_APPLICABLE.includes(rtext) ? null : (RATING_TEXT_MAP[rtext] ?? null);
  }
  return result;
}

// Split a multi-select cell (newline-separated) into cleaned tokens
function parseMultiSelect(raw: string): string[] {
  if (!raw) return [];
  return raw.split("\n").map((s) => normBilingual(s)).filter(Boolean);
}

// Q23: referral programme awareness (Yes/No)
function parseReferralAware(raw: string | undefined): "yes" | "no" | null {
  if (!raw) return null;
  const n = normBilingual(raw).toLowerCase();
  if (n === "yes" || n === "y") return "yes";
  if (n === "no"  || n === "n") return "no";
  return null;
}

// Q25: privilege value rating (distinct 5-point scale + "not aware" opt-out → null)
function parsePrivilegeValue(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = normBilingual(raw);
  if (n.toLowerCase().startsWith("i am not aware")) return null;
  return PRIVILEGE_VALUE_MAP[n] ?? null;
}

// Normalise a bilingual preset value "English 中文" → "English".
// Safe no-op on already-English strings. Never apply to open-text comment fields.
function normBilingual(raw: string): string {
  return raw.replace(/[一-鿿㐀-䶿＀-￯\s]+$/, "").trim() || raw.trim();
}

// Average of a number array, ignoring nulls
function avg(values: (number | null)[]): number {
  const valid = values.filter((v): v is number => v !== null);
  if (valid.length === 0) return 0;
  return valid.reduce((s, v) => s + v, 0) / valid.length;
}

// ── Merge ─────────────────────────────────────────────────────────────────────

// __partial stored as string "1" (partial) or "" (complete) to satisfy Record<string,string>
type MergedRow = Record<string, string>;
const PARTIAL_KEY = "__partial";
const isPartial = (r: MergedRow) => r[PARTIAL_KEY] === "1";

function mergeSheets(r1: MergedRow[], r2: MergedRow[]) {
  const map2 = new Map(r2.map((r) => [r[JOIN_KEY], r]));
  const r1Keys = new Set(r1.map((r) => r[JOIN_KEY]));
  const merged: MergedRow[] = r1.map((row) => {
    const match = map2.get(row[JOIN_KEY]);
    return { ...row, ...(match ?? {}), [PARTIAL_KEY]: match ? "" : "1" };
  });
  const unmatched_r2 = r2.filter((r) => !r1Keys.has(r[JOIN_KEY])).length;
  const unmatched_r1 = merged.filter(isPartial).length;
  return { merged, unmatched_r1, unmatched_r2 };
}

// ── Comment theme coding (keyword rules, deterministic) ───────────────────────

const THEME_RULES: { theme: string; positive: string[]; negative: string[] }[] = [
  { theme: "F&B Quality",      positive: ["food quality","menu","cuisine","delicious","tasty","fresh"],           negative: ["food quality","menu","stale","bland","cold","overcooked"] },
  { theme: "F&B Pricing",      positive: ["value for money","affordable","reasonable price","worth"],             negative: ["expensive","overpriced","pricing","price","costly","markup"] },
  { theme: "Service Attitude", positive: ["friendly","helpful","attentive","staff","service","polite","warm"],    negative: ["rude","slow","unhelpful","ignored","service","staff attitude"] },
  { theme: "Facilities",       positive: ["facilities","clean","well maintained","modern","locker","shower"],     negative: ["facilities","broken","dirty","maintenance","outdated","shabby"] },
  { theme: "Parking",          positive: ["parking","easy access","convenient"],                                  negative: ["parking","no parking","difficult","traffic","access"] },
  { theme: "Sailing & Marine", positive: ["sailing","dinghy","keelboat","regatta","cruising","marina","pontoon"], negative: ["sailing","marine","berthing","racing","regatta"] },
  { theme: "Youth Programmes", positive: ["youth","kids","children","junior","cadet","young","school"],           negative: ["youth","junior","kids","children","lack of","no programme"] },
  { theme: "Communications",   positive: ["communication","newsletter","update","informed","website","clear"],    negative: ["communication","newsletter","lack of","not informed","confusing","outdated website"] },
  { theme: "Billing & Admin",  positive: ["billing","admin","efficient","easy","online"],                         negative: ["billing","invoice","admin","difficult","error","slow response"] },
  { theme: "Member Culture",   positive: ["community","welcoming","friendly","atmosphere","social"],              negative: ["clique","exclusive","unwelcoming","culture","attitude","new member"] },
  { theme: "Events & Social",  positive: ["event","social","party","function","gathering","prize giving"],        negative: ["event","no events","lack of activities","boring","poor turnout"] },
  { theme: "Clubhouse",        positive: ["clubhouse","atmosphere","ambience","comfortable","lounge","bar"],      negative: ["clubhouse","atmosphere","noisy","crowded","run down","bar"] },
  { theme: "Membership Value", positive: ["value","worth","good value","membership"],                             negative: ["expensive membership","fee","not worth","value","cost"] },
];

// Detect if a comment is Chinese-dominant (≥15% CJK characters)
function detectLang(text: string): "zh" | "en" {
  if (!text) return "en";
  const cjkCount = (text.match(/[一-鿿㐀-䶿]/g) ?? []).length;
  return cjkCount / text.length >= 0.15 ? "zh" : "en";
}

const ZH_POS = ["好","優","滿意","非常好","出色","完善","方便","愉快","喜歡","推薦","感謝","讚","棒"];
const ZH_NEG = ["差","不滿","問題","改善","失望","不足","困難","不好","投訴","需要改","較差","沒有","太差"];

function codeSentimentZh(text: string): "positive" | "negative" | "neutral" {
  const p = ZH_POS.filter((w) => text.includes(w)).length;
  const n = ZH_NEG.filter((w) => text.includes(w)).length;
  return p > n ? "positive" : n > p ? "negative" : "neutral";
}

function codeSentiment(text: string): "positive" | "negative" | "neutral" {
  if (detectLang(text) === "zh") return codeSentimentZh(text);
  const lower = text.toLowerCase();
  const posWords = ["great","excellent","good","love","wonderful","fantastic","satisfied","happy","perfect","recommend","enjoy","appreciate","best","outstanding","amazing"];
  const negWords = ["poor","bad","terrible","awful","disappoint","improve","lacking","issue","problem","concern","dissatisfied","worst","fail","inadequate","unacceptable"];
  const posHits = posWords.filter((w) => lower.includes(w)).length;
  const negHits = negWords.filter((w) => lower.includes(w)).length;
  if (posHits > negHits) return "positive";
  if (negHits > posHits) return "negative";
  return "neutral";
}

function codeThemes(texts: string[]): CommentTheme[] {
  const counts: Record<string, { count: number; pos: number; neg: number; neu: number; examples: string[] }> = {};
  for (const rule of THEME_RULES) counts[rule.theme] = { count: 0, pos: 0, neg: 0, neu: 0, examples: [] };
  counts["Chinese (untagged)"] = { count: 0, pos: 0, neg: 0, neu: 0, examples: [] };
  counts["Other"] = { count: 0, pos: 0, neg: 0, neu: 0, examples: [] };

  for (const text of texts) {
    if (!text.trim()) continue;
    const lower = text.toLowerCase();
    const sentiment = codeSentiment(text);
    let matched = false;

    for (const rule of THEME_RULES) {
      const allKeywords = [...rule.positive, ...rule.negative];
      if (allKeywords.some((kw) => lower.includes(kw))) {
        const b = counts[rule.theme];
        b.count++;
        if (sentiment === "positive") b.pos++;
        else if (sentiment === "negative") b.neg++;
        else b.neu++;
        if (b.examples.length < 3) b.examples.push(text.slice(0, 200));
        matched = true;
      }
    }
    if (!matched) {
      const bucketKey = detectLang(text) === "zh" ? "Chinese (untagged)" : "Other";
      const b = counts[bucketKey];
      b.count++;
      if (sentiment === "positive") b.pos++;
      else if (sentiment === "negative") b.neg++;
      else b.neu++;
      if (b.examples.length < 3) b.examples.push(text.slice(0, 200));
    }
  }

  return Object.entries(counts)
    .filter(([, v]) => v.count > 0)
    .map(([theme, v]) => ({
      theme,
      count: v.count,
      sentiment: { positive: v.pos, neutral: v.neu, negative: v.neg },
      examples: v.examples,
    }))
    .sort((a, b) => b.count - a.count);
}

// ── Area satisfaction map ─────────────────────────────────────────────────────
// Maps analysis areas to sub-category names within Q11–Q14

const AREA_SUBCATS: Record<string, { field: "clubhouse_ratings" | "fnb_ratings" | "marine_ratings" | "sailing_ratings"; subcats: string[] }[]> = {
  "F&B Quality":          [{ field: "fnb_ratings",      subcats: ["Food quality", "Menu variety", "Drinks and bar offering"] }],
  "F&B Pricing / Value":  [{ field: "fnb_ratings",      subcats: ["Value for money", "Dining promotions"] }],
  "Clubhouse Facilities": [{ field: "clubhouse_ratings", subcats: ["Locker facilities", "Bar / verandah / social areas"] }],
  "Cleanliness":          [{ field: "clubhouse_ratings", subcats: ["Toilets and shower facilities", "General cleanliness and maintenance"] }],
  "Community Atmosphere": [{ field: "clubhouse_ratings", subcats: ["Overall atmosphere of the Club"] }],
  "Family Activities":    [{ field: "clubhouse_ratings", subcats: ["Children's play facilities"] }],
  "Car Parking":          [{ field: "clubhouse_ratings", subcats: ["Car parking"] }],
  "Marine Facilities":    [{ field: "marine_ratings",    subcats: ["Pontoon berthing", "Swing moorings", "Hardstand", "Boatyard services", "Safety and access arrangements"] }],
  "Sailing Programmes":   [{ field: "sailing_ratings",   subcats: ["Dinghy sailing activities", "Cruising activities", "Youth sailing programmes", "Adult sailing courses", "School / community sailing programmes"] }],
  "Racing & Regattas":    [{ field: "sailing_ratings",   subcats: ["Keelboat racing", "Regatta organisation"] }],
  "Social Events":        [{ field: "fnb_ratings",       subcats: ["Club social dining events"] }, { field: "sailing_ratings", subcats: ["Prize giving and sailing social activities"] }],
  "Member Service":       [{ field: "fnb_ratings",       subcats: ["Service quality", "Speed of service"] }, { field: "marine_ratings", subcats: ["Marine staff support"] }],
  "Communications":       [],  // uses Q18 directly
  "Membership Value":     [],  // uses Q22 directly
};

// ── Segment helper ────────────────────────────────────────────────────────────

function buildSegmentStats(rows: MergedRow[], key: string): Record<string, SurveySegmentStat> {
  const groups: Record<string, MergedRow[]> = {};
  for (const row of rows) {
    const val = row[key] ? normBilingual(row[key]) : "Unknown";
    if (!groups[val]) groups[val] = [];
    groups[val].push(row);
  }
  const result: Record<string, SurveySegmentStat> = {};
  for (const [seg, segRows] of Object.entries(groups)) {
    const complete = segRows.filter((r) => !isPartial(r));
    const sats = complete.map((r) => parseRating(r[R1.satisfaction_overall])).filter((v): v is number => v !== null);
    const npsVals = complete.map((r) => parseNps(r[R1.nps_score])).filter((v): v is number => v !== null);
    const promoters  = npsVals.filter((n) => n >= 9).length;
    const detractors = npsVals.filter((n) => n <= 6).length;
    const npsScore   = npsVals.length > 0 ? Math.round(((promoters - detractors) / npsVals.length) * 100) : 0;

    // Top 3 priorities from Q15+Q16
    const priFreq: Record<string, number> = {};
    for (const row of segRows) {
      for (const item of [...parseMultiSelect(row[R1.most_important]), ...parseMultiSelect(row[R1.priority_improve])]) {
        priFreq[item] = (priFreq[item] ?? 0) + 1;
      }
    }
    const top_priorities = Object.entries(priFreq).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([l]) => l);

    result[seg] = {
      count:            segRows.length,
      avg_satisfaction: avg(sats),
      nps_score:        npsScore,
      top_priorities,
      low_sample:       segRows.length < 10,
    };
  }
  return result;
}

// ── Action item generator ────────────────────────────────────────────────────

function buildActionItems(areas: SurveyAreaStat[], themes: CommentTheme[], n: number): SurveyActionItem[] {
  const maxImportance = Math.max(...areas.map((a) => a.importance), 0.001);
  const maxSat = 5;

  const scored = areas.map((a) => {
    const impNorm = a.importance / maxImportance;
    const satNorm = a.satisfaction / maxSat;
    const theme   = themes.find((t) => t.theme.toLowerCase().includes(a.label.toLowerCase().split(" ")[0]));
    const negPct  = theme ? (theme.sentiment.negative / (theme.count || 1)) : 0;
    const score   = Math.round((WEIGHTS.importance * impNorm + WEIGHTS.satisfaction * (1 - satNorm) + WEIGHTS.comments * negPct) * 100);
    return { area: a, score };
  }).sort((a, b) => b.score - a.score).slice(0, n);

  const OWNER_MAP: Record<string, string> = {
    "F&B":         "F&B",       "Fnb": "F&B",          "Food": "F&B",
    "Marine":      "Marine",    "Sailing": "Sailing Centre",
    "Racing":      "Sailing Centre",
    "Family":      "Membership", "Youth": "Sailing Centre",
    "Communications": "Marketing & Comms", "Membership Value": "GenCom",
    "Clubhouse":   "Operations", "Cleanliness": "Operations", "Car Parking": "Operations",
    "Community":   "GenCom",    "Member Service": "General Office/Admin",
    "Social":      "Membership",
  };

  const TIMING_MAP = (score: number): SurveyActionItem["timing"] => {
    if (score >= 60) return "0–3m";
    if (score >= 40) return "3–6m";
    if (score >= 25) return "6–12m";
    return "Long-term";
  };

  return scored.map(({ area, score }, i) => {
    const ownerKey = Object.keys(OWNER_MAP).find((k) => area.label.includes(k)) ?? "";
    return {
      priority_rank:      i + 1,
      priority_score:     score,
      issue:              area.label,
      evidence:           `Satisfaction ${area.satisfaction.toFixed(1)}/5 · Importance rank ${i + 1} · Priority freq ${(area.importance * 100).toFixed(0)}%`,
      recommended_action: `Review and improve ${area.label.toLowerCase()} based on member feedback`,
      owner:              OWNER_MAP[ownerKey] ?? "GenCom",
      timing:             TIMING_MAP(score),
    };
  });
}

// ── Main computation ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function computeInsights(merged: MergedRow[], unmatched_r1: number, unmatched_r2: number, r1Len: number, r2Len: number): SurveyInsights {
  const complete = merged.filter((r) => !isPartial(r));
  const total    = complete.length;

  // ── Overall satisfaction ─────────────────────────────────────────────────
  const satValues = complete.map((r) => parseRating(r[R1.satisfaction_overall]));
  const satDist: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
  for (const v of satValues) if (v !== null) satDist[String(v)]++;
  const avgSat     = avg(satValues);
  const validN     = satValues.filter((v) => v !== null).length || 1;
  const pctSat     = Math.round(((satDist["4"] + satDist["5"]) / validN) * 100);
  const pctDissat  = Math.round(((satDist["1"] + satDist["2"]) / validN) * 100);

  // ── NPS ──────────────────────────────────────────────────────────────────
  const npsValues  = complete.map((r) => parseNps(r[R1.nps_score])).filter((v): v is number => v !== null);
  const promoters  = npsValues.filter((n) => n >= 9).length;
  const passives   = npsValues.filter((n) => n >= 7 && n <= 8).length;
  const detractors = npsValues.filter((n) => n <= 6).length;
  const npsTotal   = npsValues.length || 1;
  const npsScore   = Math.round(((promoters - detractors) / npsTotal) * 100);
  const avgNps     = avg(npsValues);

  // ── Priority frequencies (Q15 + Q16) ─────────────────────────────────────
  const priFreq: Record<string, number> = {};
  for (const row of merged) {
    for (const item of [...parseMultiSelect(row[R1.most_important]), ...parseMultiSelect(row[R1.priority_improve])]) {
      priFreq[item] = (priFreq[item] ?? 0) + 1;
    }
  }
  const totalPriResponses = merged.length || 1;
  const top_priorities = Object.entries(priFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([label, count]) => ({ label, count, pct: Math.round((count / totalPriResponses) * 100) }));

  // Normalise priority frequency for importance (0–1)
  const maxPriFreq = Math.max(...Object.values(priFreq), 1);

  // ── Area satisfaction ─────────────────────────────────────────────────────
  const area_stats: SurveyAreaStat[] = [];
  for (const [areaLabel, sources] of Object.entries(AREA_SUBCATS)) {
    if (sources.length === 0) {
      // Communications (Q18) or Membership Value (Q22)
      const isComms = areaLabel === "Communications";
      const isValue = areaLabel === "Membership Value";
      const vals = complete.map((r) => {
        if (isComms) return parseRating(r[R1.comm_satisfaction]);
        if (isValue) return parseRating(r[R2.membership_value]);
        return null;
      }).filter((v): v is number => v !== null);
      // Importance: how often this area appears in Q15/Q16
      // "membership value" is specific enough to avoid matching "F&B Pricing / Value"
      const keyword = isComms ? "commun" : "membership value";
      const impFreq = Object.entries(priFreq)
        .filter(([k]) => k.toLowerCase().includes(keyword))
        .reduce((s, [, v]) => s + v, 0);
      area_stats.push({
        label: areaLabel,
        satisfaction: avg(vals),
        importance: impFreq / maxPriFreq,
        importance_source: "priority_frequency",
        count: vals.length,
      });
      continue;
    }
    const allVals: (number | null)[] = [];
    for (const row of complete) {
      for (const src of sources) {
        const fieldKey = R1[src.field];
        const parsed   = parseSubRatings(row[fieldKey] ?? "");
        for (const sub of src.subcats) {
          const v = parsed[sub];
          if (v !== null && v !== undefined) allVals.push(v);
        }
      }
    }
    // Match area to priority freq — exact label first, then specific keyword fallback.
    // First-word-only matching caused collisions (e.g. "f&b" matched both F&B areas).
    const exactImpFreq = priFreq[areaLabel] ?? 0;
    const impFreq = exactImpFreq > 0 ? exactImpFreq : (() => {
      const KW: Record<string, string> = {
        "F&B Quality":          "f&b quality",
        "F&B Pricing / Value":  "f&b pric",
        "Clubhouse Facilities": "clubhouse",
        "Cleanliness":          "cleanli",
        "Community Atmosphere": "community",
        "Family Activities":    "family",
        "Car Parking":          "parking",
        "Marine Facilities":    "marine",
        "Sailing Programmes":   "sailing",
        "Racing & Regattas":    "racing",
        "Social Events":        "social event",
        "Member Service":       "member service",
      };
      const kw = KW[areaLabel] ?? areaLabel.toLowerCase();
      return Object.entries(priFreq)
        .filter(([k]) => k.toLowerCase().includes(kw))
        .reduce((s, [, v]) => s + v, 0);
    })();

    area_stats.push({
      label: areaLabel,
      satisfaction: avg(allVals),
      importance: impFreq / maxPriFreq,
      importance_source: "priority_frequency",
      count: allVals.filter((v) => v !== null).length,
    });
  }

  // Re-normalise importance so the most-selected area = 1.0 (prevents >100% on chart).
  // Raw impFreqs can exceed maxPriFreq when a keyword matches multiple Q15/Q16 options.
  const maxAreaImp = Math.max(...area_stats.map((a) => a.importance), 0.001);
  for (const a of area_stats) a.importance = a.importance / maxAreaImp;

  // ── Segment analysis ──────────────────────────────────────────────────────
  const by_membership_category = buildSegmentStats(merged, R1.membership_category);
  const by_tenure              = buildSegmentStats(merged, R1.membership_length);
  const by_visit_freq          = buildSegmentStats(merged, R1.visit_frequency);
  const by_usage_type          = buildSegmentStats(merged, R1.main_usage);

  const npsGrouped: Record<string, MergedRow[]> = { Promoters: [], Passives: [], Detractors: [] };
  for (const row of complete) {
    const n = parseNps(row[R1.nps_score]);
    if (n === null) continue;
    if (n >= 9) npsGrouped["Promoters"].push(row);
    else if (n >= 7) npsGrouped["Passives"].push(row);
    else npsGrouped["Detractors"].push(row);
  }
  const by_nps_group: Record<string, SurveySegmentStat> = {};
  for (const [grp, rows] of Object.entries(npsGrouped)) {
    const sats = rows.map((r) => parseRating(r[R1.satisfaction_overall])).filter((v): v is number => v !== null);
    by_nps_group[grp] = {
      count: rows.length, avg_satisfaction: avg(sats), nps_score: 0,
      top_priorities: [], low_sample: rows.length < 10,
    };
  }

  // ── Distributions ─────────────────────────────────────────────────────────
  function dist(rows: MergedRow[], field: string): Record<string, number> {
    const d: Record<string, number> = {};
    for (const r of rows) {
      const v = (r[field] ?? "").trim();
      if (v) d[normBilingual(v)] = (d[normBilingual(v)] ?? 0) + 1;
    }
    return d;
  }
  const tenure_dist              = dist(merged, R1.membership_length);
  const visit_freq_dist          = dist(merged, R1.visit_frequency);
  const usage_type_dist          = dist(merged, R1.main_usage);
  const membership_category_dist = dist(merged, R1.membership_category);
  const improvement_trend_dist   = dist(merged, R1.improvement_trend);

  // ── Communication channels ────────────────────────────────────────────────
  const chFreq: Record<string, number> = {};
  for (const row of merged) {
    for (const ch of parseMultiSelect(row[R1.comm_channels])) {
      chFreq[ch] = (chFreq[ch] ?? 0) + 1;
    }
  }
  const comm_channels = Object.entries(chFreq)
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count, pct: Math.round((count / (merged.length || 1)) * 100) }));

  // Scalar ratings
  const commSatVals = complete.map((r) => parseRating(r[R1.comm_satisfaction])).filter((v): v is number => v !== null);
  const websiteVals = complete.map((r) => parseRating(r[R2.website_rating])).filter((v): v is number => v !== null);
  const valueVals   = complete.map((r) => parseRating(r[R2.membership_value])).filter((v): v is number => v !== null);

  // Referral programme awareness (Q23 — Yes / No)
  const referralVals = complete.map((r) => parseReferralAware(r[R2.referral_aware]));
  const referralYes  = referralVals.filter((v) => v === "yes").length;
  const referralNo   = referralVals.filter((v) => v === "no").length;
  const referralN    = referralVals.filter((v) => v !== null).length || 1;

  // Member privilege value (Q25 — 5-point scale, "not aware" excluded)
  const privVals          = complete.map((r) => parsePrivilegeValue(r[R2.privilege_value]));
  const avgPrivilegeValue = avg(privVals);
  const privNotAwareCount = complete.filter((r) => normBilingual(r[R2.privilege_value] ?? "").toLowerCase().startsWith("i am not aware")).length;
  const privilegeValueDist: Record<string, number> = {};
  for (const row of complete) {
    const v = normBilingual(row[R2.privilege_value] ?? "");
    if (v && !v.toLowerCase().startsWith("i am not aware")) {
      privilegeValueDist[v] = (privilegeValueDist[v] ?? 0) + 1;
    }
  }

  // Referral programme attractiveness (Q23a — conditional, only answered when Q23 = Yes)
  const refAttrVals = complete
    .map((r) => parseRating(r[R2.referral_attractive]))
    .filter((v): v is number => v !== null);
  const avgReferralAttractive = refAttrVals.length > 0 ? avg(refAttrVals) : 0;
  const referralAttractiveDist: Record<string, number> = {};
  for (const row of complete) {
    const v = normBilingual(row[R2.referral_attractive] ?? "");
    if (v) referralAttractiveDist[v] = (referralAttractiveDist[v] ?? 0) + 1;
  }

  // ── Comment collection + theme coding ─────────────────────────────────────
  const allComments: { segment?: string; lang?: "en" | "zh"; text: string }[] = [];
  const textSources = [R1.nps_reason, R1.best_thing, R1.improve_thing, R1.highest_priority, R2.referral_improve, R2.final_comments];
  for (const row of merged) {
    const seg = row[R1.membership_category] ? normBilingual(row[R1.membership_category]) : undefined;
    for (const field of textSources) {
      const text = (row[field] ?? "").trim();
      if (text && text.toLowerCase() !== "test") allComments.push({ segment: seg, lang: detectLang(text), text });
    }
  }
  const commentTexts  = allComments.map((c) => c.text);
  const comment_themes = codeThemes(commentTexts);
  const comments = allComments.slice(0, 200);

  // ── Action items ──────────────────────────────────────────────────────────
  const action_items = buildActionItems(area_stats, comment_themes, 10);

  // ── Data quality ─────────────────────────────────────────────────────────
  const missingFields: string[] = [];
  if (complete.length > 0) {
    const sample = complete[0];
    if (!sample[R1.satisfaction_overall]) missingFields.push("Q5 overall satisfaction");
    if (!sample[R1.nps_score])            missingFields.push("Q6 NPS score");
    if (!sample[R1.membership_category])  missingFields.push("Q1 membership category");
  }

  const data_quality: SurveyDataQuality = {
    r1_rows: r1Len, r2_rows: r2Len,
    matched_complete: complete.length,
    unmatched_r1, unmatched_r2,
    join_method: `Entry ID (WPForms)`,
    missing_fields: missingFields,
  };

  return {
    computed_at:            new Date().toISOString(),
    total_responses:        total,
    data_quality,
    avg_satisfaction:       avgSat,
    satisfaction_dist:      satDist,
    pct_satisfied:          pctSat,
    pct_dissatisfied:       pctDissat,
    area_stats,
    nps_score:              npsScore,
    avg_nps_raw:            avgNps,
    nps_dist:               { promoters, passives, detractors },
    by_membership_category,
    by_tenure,
    by_visit_freq,
    by_usage_type,
    by_nps_group,
    top_priorities,
    comm_channels,
    comm_satisfaction:      avg(commSatVals),
    website_rating:         avg(websiteVals),
    membership_value:       avg(valueVals),
    referral_aware:             { yes: referralYes, no: referralNo, pct_aware: Math.round((referralYes / referralN) * 100) },
    avg_referral_attractive:    avgReferralAttractive,
    referral_attractive_dist:   referralAttractiveDist,
    avg_privilege_value:        avgPrivilegeValue,
    privilege_value_dist:       privilegeValueDist,
    privilege_not_aware_n:      privNotAwareCount,
    tenure_dist,
    visit_freq_dist,
    usage_type_dist,
    membership_category_dist,
    improvement_trend_dist,
    comment_themes,
    comment_count:          allComments.length,
    comments,
    action_items,
  };
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const bust  = params.has("bust");
    const debug = params.has("debug");

    // Cache check FIRST — skip sheets read entirely on a cache hit
    if (!bust && !debug) {
      try {
        const cached = await kvGet<SurveyInsights>(KV_KEY);
        if (cached) return NextResponse.json(cached);
      } catch {
        // KV unavailable — fall through to fresh computation
      }
    }

    // Read both sheets in parallel (only when cache misses or bust/debug)
    const [r1Rows, r2Rows] = await Promise.all([
      readRawSheet(SURVEY_SHEET_ID, "Response!A:AZ"),
      readRawSheet(SURVEY_SHEET_ID, "Response2!A:AZ"),
    ]);

    // Debug: return raw structure
    if (debug) {
      const { merged, unmatched_r1, unmatched_r2 } = mergeSheets(r1Rows, r2Rows);
      return NextResponse.json({
        r1: { headers: r1Rows.length > 0 ? Object.keys(r1Rows[0]) : [], total_rows: r1Rows.length, sample: r1Rows.slice(0, 2) },
        r2: { headers: r2Rows.length > 0 ? Object.keys(r2Rows[0]) : [], total_rows: r2Rows.length, sample: r2Rows.slice(0, 2) },
        join_key: JOIN_KEY,
        merge_preview: {
          matched_complete: merged.filter((r) => !isPartial(r)).length,
          unmatched_r1,
          unmatched_r2,
        },
      });
    }

    const { merged, unmatched_r1, unmatched_r2 } = mergeSheets(r1Rows, r2Rows);
    const payload = computeInsights(merged, unmatched_r1, unmatched_r2, r1Rows.length, r2Rows.length);
    try { await kvSet(KV_KEY, payload, CACHE_TTL); } catch { /* non-fatal */ }
    return NextResponse.json(payload);
  } catch (err) {
    console.error("[survey-insights]", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
