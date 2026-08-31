/**
 * Firebase Realtime Database access — SOLO_MODE_BUILD_PLAN.md §6.
 *
 * HARD ISOLATION RULE (user requirement, 2026-08-31): this tool shares the
 * CP Phantom Firebase *project* but must never read or write CP Phantom's
 * campaign data. Everything the solo tool persists lives under a single
 * top-level node, `soloCampaigns/`. Every path built here is forced under that
 * prefix; anything else throws. CP Phantom character import (Phase 2) is a
 * separate, explicitly READ-ONLY path.
 */

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getDatabase,
  ref,
  get,
  set,
  type Database,
} from "firebase/database";

const SOLO_ROOT = "soloCampaigns";
/** CP Phantom's data root — the solo tool may READ under here for import, never write. */
const CP_PHANTOM_ROOT = "campaign";

let app: FirebaseApp | null = null;
let db: Database | null = null;

export function firebaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
      process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL &&
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  );
}

function database(): Database {
  if (db) return db;
  if (!firebaseConfigured()) {
    throw new Error("Firebase is not configured (NEXT_PUBLIC_FIREBASE_* env vars missing).");
  }
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL!,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
  app = getApps()[0] ?? initializeApp(config);
  db = getDatabase(app);
  return db;
}

/**
 * Force a relative path under `soloCampaigns/`. This is the ONLY place the solo
 * tool constructs a writable DB ref, and it can only ever produce a path inside
 * `soloCampaigns/` — the prefix is string-concatenated on, not checked. The
 * guards below reject the two theoretical ways to climb out (`..` traversal,
 * explicit re-targeting) and a final assertion refuses anything that somehow
 * isn't under the solo root.
 */
export function soloPath(relative: string): string {
  const clean = String(relative).replace(/^\/+|\/+$/g, "");
  if (
    clean.includes("..") ||
    clean.startsWith(CP_PHANTOM_ROOT + "/") ||
    clean === CP_PHANTOM_ROOT ||
    clean.startsWith(SOLO_ROOT + "/") // don't let a caller double-prefix / smuggle a sibling
  ) {
    throw new Error(`Refusing Firebase path outside the solo namespace: ${relative}`);
  }
  const full = `${SOLO_ROOT}/${clean}`;
  if (full !== SOLO_ROOT && !full.startsWith(SOLO_ROOT + "/")) {
    throw new Error(`Path assertion failed, refusing write: ${full}`);
  }
  return full;
}

export async function soloRead<T = unknown>(relative: string): Promise<T | null> {
  const snap = await get(ref(database(), soloPath(relative)));
  return snap.exists() ? (snap.val() as T) : null;
}

export async function soloWrite(relative: string, value: unknown): Promise<void> {
  await set(ref(database(), soloPath(relative)), value);
}

/**
 * READ-ONLY import from CP Phantom — SOLO_MODE_BUILD_PLAN.md §5.4.
 * Data path per CP Phantom's `dbPath()`: `campaign/characters/{id}`.
 * There is deliberately NO write helper for this path anywhere in the codebase.
 */
export async function readCpPhantomCharacter(characterId: string): Promise<unknown | null> {
  const clean = characterId.replace(/[^A-Za-z0-9_-]/g, "");
  if (!clean) throw new Error("invalid character id");
  const snap = await get(ref(database(), `${CP_PHANTOM_ROOT}/characters/${clean}`));
  return snap.exists() ? snap.val() : null;
}

export interface CpPhantomCharacterRef {
  id: string;
  name: string;
  isNPC: boolean;
  isCompanion: boolean;
  isVehicle: boolean;
  isDrone: boolean;
}

/** List CP Phantom characters for the import picker. Read-only snapshot. */
export async function listCpPhantomCharacters(): Promise<CpPhantomCharacterRef[]> {
  const snap = await get(ref(database(), `${CP_PHANTOM_ROOT}/characters`));
  if (!snap.exists()) return [];
  const all = snap.val() as Record<string, Record<string, unknown>>;
  return Object.entries(all).map(([id, c]) => ({
    id,
    name: String(c.name ?? id),
    isNPC: Boolean(c.isNPC),
    isCompanion: Boolean(c.isCompanion),
    isVehicle: Boolean(c.isVehicle),
    isDrone: Boolean(c.isDrone),
  }));
}
