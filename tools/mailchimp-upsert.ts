import { createHash } from "crypto";
import type { SheetContact, ContactSyncResult } from "@/lib/types";
import { FIELD_MAP, TAG_COLUMNS, buildTagName } from "@/lib/field-map";
import { kvGet, kvSet } from "@/lib/kv";

const BATCH_SIZE = 500;
const TAG_CONCURRENCY = 10; // Mailchimp allows max 10 simultaneous connections
const KV_FINGERPRINTS = "sync:tag_fingerprints";

function contactFingerprint(contact: SheetContact): string {
  const { updatedAt, changedId, interest, facility, skill, administrative } = contact;
  return [updatedAt, changedId, ...interest, ...facility, ...skill, ...administrative].join("|");
}

function emailMd5(email: string): string {
  return createHash("md5").update(email.toLowerCase().trim()).digest("hex");
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

async function getMailchimp() {
  const mc = (await import("@mailchimp/mailchimp_marketing")).default as typeof import("@mailchimp/mailchimp_marketing");
  mc.setConfig({
    apiKey: process.env.MAILCHIMP_API_KEY!,
    server: process.env.MAILCHIMP_SERVER_PREFIX!,
  });
  return mc;
}

function buildMergeFields(contact: SheetContact): Record<string, string> {
  const { firstName, lastName } = splitName(contact.fullName);
  return {
    FNAME: firstName,
    LNAME: lastName,
    [FIELD_MAP.FULLNAME]: contact.fullName,
    [FIELD_MAP.MEMBERSHIP]: contact.membership,
    [FIELD_MAP.MEMBERSHIP_MOD]: contact.membershipModifier,
    [FIELD_MAP.PHONE]: contact.phone,
    [FIELD_MAP.MEMBERID]: contact.memberId,
    [FIELD_MAP.NOTE]: contact.note,
    [FIELD_MAP.CREATEDAT]: contact.createdAt,
    [FIELD_MAP.UPDATEDAT]: contact.updatedAt,
    [FIELD_MAP.CHANGEDID]: contact.changedId,
  };
}

function buildTags(contact: SheetContact): string[] {
  const tags: string[] = [];
  for (const col of TAG_COLUMNS) {
    const values = contact[col.toLowerCase() as keyof SheetContact] as string[];
    for (const v of values) {
      tags.push(buildTagName(col, v));
    }
  }
  return tags;
}

async function retryWithBackoff<T>(fn: () => Promise<T>, maxRetries = 4, baseMs = 1000): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const is429 =
        String(err).includes("Too Many Requests") ||
        (err as any)?.status === 429 ||
        (err as any)?.statusCode === 429;
      if (is429 && attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, baseMs * 2 ** attempt)); // 1s, 2s, 4s, 8s
        continue;
      }
      throw err;
    }
  }
  throw new Error("retryWithBackoff: unreachable");
}

async function withConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  for (let i = 0; i < items.length; i += concurrency) {
    await Promise.allSettled(items.slice(i, i + concurrency).map(fn));
  }
}

export async function upsertContacts(
  contacts: SheetContact[],
  _knownEmails: Set<string>,
  skipTags = false
): Promise<ContactSyncResult[]> {
  const audienceId = process.env.MAILCHIMP_AUDIENCE_ID!;
  const mc = await getMailchimp();
  const results: ContactSyncResult[] = [];

  // Step 1: batch upsert merge fields
  for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
    const batch = contacts.slice(i, i + BATCH_SIZE);
    const members = batch.map((c) => ({
      email_address: c.email,
      status: "subscribed" as const,
      merge_fields: buildMergeFields(c),
    }));

    try {
      const res = await (mc.lists as any).batchListMembers(audienceId, {
        members,
        update_existing: true,
      });
      for (const m of res.new_members ?? [])     results.push({ email: m.email_address, status: "new" });
      for (const m of res.updated_members ?? []) results.push({ email: m.email_address, status: "updated" });
      for (const e of res.errors ?? [])          results.push({ email: e.email_address ?? "unknown", status: "error", error: e.error });
    } catch (err) {
      batch.forEach((c) => results.push({ email: c.email, status: "error", error: String(err) }));
    }
  }

  // Step 2: apply tags — skipped entirely on first run to keep it within time limits
  if (skipTags) return results;

  // Apply tags — skip contacts whose tag data hasn't changed (KV-persisted fingerprints)
  const successEmails = new Set(
    results.filter((r) => r.status !== "error").map((r) => r.email.toLowerCase())
  );
  const contactsWithTags = contacts.filter(
    (c) => successEmails.has(c.email.toLowerCase()) && buildTags(c).length > 0
  );

  // Load persisted fingerprints — survives cold starts unlike an in-process Map
  const savedFingerprints = (await kvGet<Record<string, string>>(KV_FINGERPRINTS)) ?? {};
  const updatedFingerprints: Record<string, string> = { ...savedFingerprints };

  const tagErrors: string[] = [];
  await withConcurrency(contactsWithTags, TAG_CONCURRENCY, async (contact) => {
    const email = contact.email.toLowerCase();
    const fp = contactFingerprint(contact);
    if (savedFingerprints[email] === fp) return; // unchanged — skip API call
    try {
      const hash = emailMd5(contact.email);
      await retryWithBackoff(() =>
        (mc.lists as any).updateListMemberTags(audienceId, hash, {
          tags: buildTags(contact).map((name) => ({ name, status: "active" })),
        })
      );
      updatedFingerprints[email] = fp;
    } catch (err) {
      tagErrors.push(`tag:${contact.email}: ${String(err)}`);
    }
  });

  // Persist updated fingerprints for the next sync
  await kvSet(KV_FINGERPRINTS, updatedFingerprints);

  for (const errMsg of tagErrors) {
    const email = errMsg.split(":")[1]?.trim() ?? "unknown";
    results.push({ email, status: "error", error: errMsg });
  }

  return results;
}
