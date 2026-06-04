import { NextResponse } from "next/server";

async function checkEnvVars() {
  const required = [
    "GOOGLE_SERVICE_ACCOUNT_EMAIL",
    "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
    "SHEET_ID",
    "SHEET_RANGE",
    "MAILCHIMP_API_KEY",
    "MAILCHIMP_SERVER_PREFIX",
    "MAILCHIMP_AUDIENCE_ID",
    "WEBHOOK_SECRET",
  ];
  const missing = required.filter((k) => !process.env[k]);
  const kvUrl = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL ?? "";
  const kvToken = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN ?? "";
  return {
    ok: missing.length === 0,
    missing,
    kv_url_present: !!kvUrl,
    kv_url_format: kvUrl ? (kvUrl.startsWith("https://") ? "ok" : `wrong format: starts with "${kvUrl.slice(0, 10)}..."`) : "missing",
    kv_token_present: !!kvToken,
    mc_server_prefix: process.env.MAILCHIMP_SERVER_PREFIX ?? "missing",
    sheet_range: process.env.SHEET_RANGE ?? "missing",
  };
}

async function checkKv() {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token || !url.startsWith("https://")) return { ok: false, error: "Missing or invalid KV env vars" };
  try {
    const { Redis } = await import("@upstash/redis");
    const redis = new Redis({ url, token });
    await redis.set("debug:ping", "pong", { ex: 10 });
    const val = await redis.get("debug:ping");
    return { ok: val === "pong", value: val };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

async function checkGoogleSheets() {
  try {
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
    if (!email || !key) return { ok: false, error: "Missing credentials" };

    const { google } = await import("googleapis");
    const auth = new google.auth.GoogleAuth({
      credentials: { client_email: email, private_key: key },
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
    const sheets = google.sheets({ version: "v4", auth });
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID!,
      range: "A1:A1",
    });
    return { ok: true, rows_sample: res.data.values };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

async function checkMailchimp() {
  try {
    const mc = (await import("@mailchimp/mailchimp_marketing")).default as any;
    mc.setConfig({
      apiKey: process.env.MAILCHIMP_API_KEY!,
      server: process.env.MAILCHIMP_SERVER_PREFIX!,
    });
    const ping = await mc.ping.get();
    return { ok: ping?.health_status === "Everything's Chimpy!", ping };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

async function checkMergeFields() {
  try {
    const mc = (await import("@mailchimp/mailchimp_marketing")).default as any;
    mc.setConfig({
      apiKey: process.env.MAILCHIMP_API_KEY!,
      server: process.env.MAILCHIMP_SERVER_PREFIX!,
    });
    const res = await mc.lists.getListMergeFields(process.env.MAILCHIMP_AUDIENCE_ID!, { count: 50 });
    const fields = (res.merge_fields ?? []).map((f: any) => ({
      tag: f.tag,
      name: f.name,
      type: f.type,
      required: f.required,
    }));
    const bdayTags = ["BDAY", "18BDAY", "21BDAY", "25BDAY", "30BDAY"];
    const found = bdayTags.map(t => ({
      tag: t,
      configured: fields.find((f: any) => f.tag === t) ?? null,
    }));
    return { ok: true, all_fields: fields, bday_check: found };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

async function checkSheetBdayData() {
  try {
    const { fetchSheetContacts } = await import("@/tools/google-sheets");
    const contacts = await fetchSheetContacts();
    const withBday = contacts.filter(c => c.bday || c.bday18 || c.bday21 || c.bday25 || c.bday30).slice(0, 3);
    return {
      ok: true,
      total_contacts: contacts.length,
      contacts_with_bday: contacts.filter(c => c.bday || c.bday18 || c.bday21 || c.bday25 || c.bday30).length,
      sample: withBday.map(c => ({
        email: c.email,
        bday: c.bday,
        bday18: c.bday18,
        bday21: c.bday21,
        bday25: c.bday25,
        bday30: c.bday30,
      })),
    };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const [envVars, kv, sheets, mailchimp, mergeFields, bdayData] = await Promise.allSettled([
    checkEnvVars(),
    checkKv(),
    checkGoogleSheets(),
    checkMailchimp(),
    checkMergeFields(),
    checkSheetBdayData(),
  ]);

  const result = {
    timestamp: new Date().toISOString(),
    env_vars:     envVars.status     === "fulfilled" ? envVars.value     : { ok: false, error: String(envVars.reason) },
    kv:           kv.status          === "fulfilled" ? kv.value          : { ok: false, error: String(kv.reason) },
    google_sheets: sheets.status     === "fulfilled" ? sheets.value      : { ok: false, error: String(sheets.reason) },
    mailchimp:    mailchimp.status   === "fulfilled" ? mailchimp.value   : { ok: false, error: String(mailchimp.reason) },
    merge_fields: mergeFields.status === "fulfilled" ? mergeFields.value : { ok: false, error: String(mergeFields.reason) },
    bday_sheet:   bdayData.status    === "fulfilled" ? bdayData.value    : { ok: false, error: String(bdayData.reason) },
  };

  const allOk = [result.env_vars, result.kv, result.google_sheets, result.mailchimp].every((r) => r.ok);
  return NextResponse.json({ status: allOk ? "all_ok" : "issues_found", ...result }, { status: allOk ? 200 : 500 });
}
