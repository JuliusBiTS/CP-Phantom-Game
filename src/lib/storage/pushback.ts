/**
 * GM-gated push-back to CP Phantom — SOLO_MODE_BUILD_PLAN.md §5.4.
 *
 * Solo play NEVER auto-applies anything to the live character. Changes pile up
 * in `CampaignState.pendingChangeset`; a human reviews each line and approves or
 * rejects it; only approved lines land here.
 *
 * Safety design (the user's stated top concern):
 *  - Writes ONLY specific leaf paths under `campaign/characters/{id}/…` —
 *    never the whole character object, never a sibling node.
 *  - Only four change kinds can auto-apply: xp (adds globalXP), humanity
 *    (subtracts humanity_current, clamped ≥ 0), loot (appends to inventory),
 *    note (appends to notes). Everything else — talents, injuries, stat
 *    changes — is review-only and surfaced as a note, never written mechanically.
 *  - Every write reads the current value first, then writes current±delta, and
 *    records before/after under `soloCampaigns/pushbackLog/{id}/{ts}`.
 */

import { getDatabase, ref, get, set } from "firebase/database";
import { initializeApp, getApps } from "firebase/app";
import { firebaseConfigured } from "./firebase";
import type { PendingChange } from "../state/campaignState";

const CP_ROOT = "campaign";

function db() {
  if (!firebaseConfigured()) throw new Error("Firebase not configured.");
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL!,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  };
  const app = getApps()[0] ?? initializeApp(config);
  return getDatabase(app);
}

/** Kinds that can be written mechanically. Others are review-only. */
export const AUTO_APPLY_KINDS = new Set<PendingChange["kind"]>(["xp", "humanity", "loot", "note"]);

export interface PushbackReport {
  applied: Array<{ id: string; label: string; field: string; before: unknown; after: unknown }>;
  skipped: Array<{ id: string; label: string; reason: string }>;
}

function sanitizeId(id: string): string {
  const clean = id.replace(/[^A-Za-z0-9_-]/g, "");
  if (!clean) throw new Error("invalid CP Phantom character id");
  return clean;
}

export type LeafWrite =
  | { field: string; before: unknown; after: unknown; value: unknown }
  | { error: string };

/**
 * Pure: given a change and the current character, compute the single leaf field
 * to write and its new value. No I/O. This is the safety-critical logic —
 * `applyApprovedChanges` just executes what this returns.
 */
export function computeLeafWrite(
  kind: PendingChange["kind"],
  patch: Record<string, unknown>,
  char: Record<string, unknown>,
): LeafWrite {
  if (!AUTO_APPLY_KINDS.has(kind)) return { error: `kind "${kind}" is review-only, not written mechanically` };

  if (kind === "xp") {
    const add = Number(patch.globalXP ?? patch.xp ?? 0);
    if (!Number.isFinite(add) || add === 0) return { error: "no numeric XP amount in patch" };
    const before = Number(char.globalXP ?? 0);
    const after = before + add;
    return { field: "globalXP", before, after, value: after };
  }
  if (kind === "humanity") {
    const drop = Math.abs(Number(patch.humanity_current ?? patch.humanity ?? 0));
    if (!Number.isFinite(drop) || drop === 0) return { error: "no numeric humanity amount in patch" };
    const before = Number(char.humanity_current ?? char.humanity_max ?? 0);
    const after = Math.max(0, before - drop);
    return { field: "humanity_current", before, after, value: after };
  }
  if (kind === "loot") {
    const items = Array.isArray(patch.addInventory)
      ? patch.addInventory
      : patch.name
        ? [{ name: patch.name, qty: patch.qty ?? 1, slots: patch.slots ?? 0 }]
        : [];
    if (!items.length) return { error: "no items in patch" };
    const before = Array.isArray(char.inventory) ? (char.inventory as unknown[]) : [];
    const after = [...before, ...items];
    return { field: "inventory", before: before.length, after: after.length, value: after };
  }
  // note
  const text = String(patch.appendNote ?? patch.note ?? "").trim();
  if (!text) return { error: "empty note" };
  const before = String(char.notes ?? "");
  const after = (before ? before + "\n\n" : "") + `[solo ${new Date().toISOString().slice(0, 10)}] ${text}`;
  return { field: "notes", before: before.length, after: after.length, value: after };
}

/**
 * Apply the approved changes to a live CP Phantom character.
 * `characterId` is the CP Phantom `campaign/characters/{id}` key.
 */
export async function applyApprovedChanges(
  characterId: string,
  approved: PendingChange[],
): Promise<PushbackReport> {
  const cid = sanitizeId(characterId);
  const database = db();

  const charSnap = await get(ref(database, `${CP_ROOT}/characters/${cid}`));
  if (!charSnap.exists()) throw new Error(`CP Phantom character ${cid} not found`);
  const char = charSnap.val() as Record<string, unknown>;

  const report: PushbackReport = { applied: [], skipped: [] };
  const ts = Date.now();

  for (const change of approved) {
    const patch = { ...(change.patch ?? {}) };
    if (change.kind === "note" && patch.appendNote == null && patch.note == null) patch.note = change.label;
    const plan = computeLeafWrite(change.kind, patch, char);
    if ("error" in plan) {
      report.skipped.push({ id: change.id, label: change.label, reason: plan.error });
      continue;
    }
    try {
      await set(ref(database, `${CP_ROOT}/characters/${cid}/${plan.field}`), plan.value);
      char[plan.field] = plan.value;
      report.applied.push({ id: change.id, label: change.label, field: plan.field, before: plan.before, after: plan.after });
    } catch (err) {
      report.skipped.push({ id: change.id, label: change.label, reason: (err as Error).message });
    }
  }

  // Audit record — inside the solo namespace, never overwriting CP Phantom data.
  if (report.applied.length) {
    await set(ref(database, `soloCampaigns/pushbackLog/${cid}/${ts}`), {
      ts,
      applied: report.applied,
      skipped: report.skipped,
    });
  }

  return report;
}
