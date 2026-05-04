import { NextResponse } from "next/server";
import { kvGet, kvSet } from "@/lib/kv";
import type { StudioDraft } from "@/lib/types";

const KV_DRAFTS = "studio:drafts";

type RouteProps = { params: Promise<{ id: string }> };

// PATCH — update status: "trash" to move to trash, "draft" to restore
export async function PATCH(req: Request, { params }: RouteProps) {
  const { id } = await params;
  const { status } = (await req.json()) as { status: "draft" | "trash" };

  const all = (await kvGet<StudioDraft[]>(KV_DRAFTS)) ?? [];
  const idx = all.findIndex((d) => d.id === id);
  if (idx < 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  all[idx] = {
    ...all[idx],
    status,
    deletedAt: status === "trash" ? new Date().toISOString() : undefined,
    updatedAt: new Date().toISOString(),
  };

  await kvSet(KV_DRAFTS, all);
  return NextResponse.json(all[idx]);
}

// DELETE — permanent delete (only valid for trash items)
export async function DELETE(_req: Request, { params }: RouteProps) {
  const { id } = await params;

  const all = (await kvGet<StudioDraft[]>(KV_DRAFTS)) ?? [];
  const filtered = all.filter((d) => d.id !== id);
  await kvSet(KV_DRAFTS, filtered);
  return NextResponse.json({ ok: true });
}
