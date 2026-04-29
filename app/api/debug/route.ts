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

export async function GET() {
  const [envVars, kv, sheets, mailchimp] = await Promise.allSettled([
    checkEnvVars(),
    checkKv(),
    checkGoogleSheets(),
    checkMailchimp(),
  ]);

  const result = {
    timestamp: new Date().toISOString(),
    env_vars:   envVars.status   === "fulfilled" ? envVars.value   : { ok: false, error: String(envVars.reason) },
    kv:         kv.status        === "fulfilled" ? kv.value        : { ok: false, error: String(kv.reason) },
    google_sheets: sheets.status === "fulfilled" ? sheets.value    : { ok: false, error: String(sheets.reason) },
    mailchimp:  mailchimp.status === "fulfilled" ? mailchimp.value : { ok: false, error: String(mailchimp.reason) },
  };

  const allOk = [result.env_vars, result.kv, result.google_sheets, result.mailchimp].every((r) => r.ok);
  return NextResponse.json({ status: allOk ? "all_ok" : "issues_found", ...result }, { status: allOk ? 200 : 500 });
}
