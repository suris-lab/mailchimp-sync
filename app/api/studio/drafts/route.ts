import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { kvGet, kvSet } from "@/lib/kv";
import type { StudioDraft } from "@/lib/types";

const KV_DRAFTS = "studio:drafts";
const TRASH_TTL_DAYS = 7;

async function loadAll(): Promise<StudioDraft[]> {
  return (await kvGet<StudioDraft[]>(KV_DRAFTS)) ?? [];
}

function purgeExpiredTrash(drafts: StudioDraft[]): StudioDraft[] {
  const cutoff = Date.now() - TRASH_TTL_DAYS * 86_400_000;
  return drafts.filter(
    (d) => !(d.status === "trash" && d.deletedAt && new Date(d.deletedAt).getTime() < cutoff)
  );
}

export async function GET() {
  let all = await loadAll();
  all = purgeExpiredTrash(all);
  await kvSet(KV_DRAFTS, all);

  const drafts = all
    .filter((d) => d.status === "draft")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const trash = all
    .filter((d) => d.status === "trash")
    .sort((a, b) => (b.deletedAt ?? "").localeCompare(a.deletedAt ?? ""));

  return NextResponse.json({ drafts, trash });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { id, input, output } = body as {
    id?: string;
    input: StudioDraft["input"];
    output?: StudioDraft["output"];
  };

  const all = await loadAll();
  const now = new Date().toISOString();

  const title =
    input.events?.find((e) => e.title?.trim())?.title?.trim() ??
    `Draft – ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;

  let saved: StudioDraft;

  if (id) {
    const idx = all.findIndex((d) => d.id === id);
    if (idx >= 0) {
      all[idx] = {
        ...all[idx],
        title,
        input,
        output: output ?? all[idx].output,
        updatedAt: now,
      };
      saved = all[idx];
    } else {
      // ID provided but missing (e.g. after KV flush) — recreate
      saved = { id, title, createdAt: now, updatedAt: now, input, output, status: "draft" };
      all.unshift(saved);
    }
  } else {
    saved = {
      id: randomUUID(),
      title,
      createdAt: now,
      updatedAt: now,
      input,
      output,
      status: "draft",
    };
    all.unshift(saved);
  }

  await kvSet(KV_DRAFTS, all);
  return NextResponse.json(saved);
}
