import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { kvGet } from "@/lib/kv";
import { fetchSheetContacts } from "@/tools/google-sheets";
import type { SheetContact } from "@/lib/types";

const KV_CONTACT_FP = "sync:contact_fingerprints_v3";
const KV_UNSUBSCRIBED = "sync:unsubscribed_emails";

type ContactFpEntry = { email: string; fp: string };

function stableKey(c: { memberId: string; email: string }): string {
  return c.memberId.trim() || c.email.toLowerCase();
}

// Must stay byte-for-byte identical to the one in sync-engine.ts
function fingerprintRaw(c: SheetContact): string {
  return [
    c.email, c.fullName, c.memberId, c.membership, c.membershipModifier,
    c.phone, c.note, c.createdAt, c.updatedAt, c.changedId,
    ...[...c.interest].sort(), ...[...c.facility].sort(),
    ...[...c.skill].sort(),    ...[...c.administrative].sort(),
  ].join("|");
}

function fullFingerprint(c: SheetContact): string {
  return createHash("md5").update(fingerprintRaw(c)).digest("hex");
}

export async function GET() {
  try {
    const [savedFp, allContacts, unsubscribedList] = await Promise.all([
      kvGet<Record<string, ContactFpEntry>>(KV_CONTACT_FP),
      fetchSheetContacts(),
      kvGet<string[]>(KV_UNSUBSCRIBED),
    ]);

    const fp = savedFp ?? {};
    const unsubscribed = new Set<string>(unsubscribedList ?? []);

    const mismatches: Array<{
      stableKey: string;
      email: string;
      isUnsubscribed: boolean;
      reason: "no_saved_fp" | "fp_mismatch";
      savedFp: string | null;
      currentFp: string;
      // The raw pipe-joined string that gets hashed — shows exactly what changed
      rawHashInput: string;
    }> = [];

    for (const c of allContacts) {
      const key = stableKey(c);
      const saved = fp[key];
      const currentFp = fullFingerprint(c);

      if (!saved || saved.fp !== currentFp) {
        mismatches.push({
          stableKey: key,
          email: c.email,
          isUnsubscribed: unsubscribed.has(c.email.toLowerCase()),
          reason: saved ? "fp_mismatch" : "no_saved_fp",
          savedFp: saved?.fp ?? null,
          currentFp,
          rawHashInput: fingerprintRaw(c),
        });
      }
    }

    return NextResponse.json({
      total_contacts: allContacts.length,
      total_saved_fingerprints: Object.keys(fp).length,
      total_mismatches: mismatches.length,
      unsubscribed_cached_count: unsubscribed.size,
      // Cap at 30 to keep response readable
      mismatches: mismatches.slice(0, 30),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
