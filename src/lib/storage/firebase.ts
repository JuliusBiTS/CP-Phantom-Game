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

/** Force a relative solo path under `soloCampaigns/` and reject traversal. */
function soloPath(relative: string): string {
  const clean = relative.replace(/^\/+|\/+$/g, "");
  if (clean.includes("..") || clean.startsWith(CP_PHANTOM_ROOT + "/") || clean === CP_PHANTOM_ROOT) {
    throw new Error(`Refusing Firebase path outside the solo namespace: ${relative}`);
  }
  return `${SOLO_ROOT}/${clean}`;
}

export async function soloRead<T = unknown>(relative: string): Promise<T | null> {
  const snap = await get(ref(database(), soloPath(relative)));
  return snap.exists() ? (snap.val() as T) : null;
}

export async function soloWrite(relative: string, value: unknown): Promise<void> {
  await set(ref(database(), soloPath(relative)), value);
}

/**
 * READ-ONLY import of a CP Phantom character — SOLO_MODE_BUILD_PLAN.md §5.4.
 * Path prefix per CP Phantom's `dbPath()`: `campaign/characters/{id}`.
 * There is deliberately no corresponding write helper.
 */
export async function readCpPhantomCharacter(characterId: string): Promise<unknown | null> {
  const clean = characterId.replace(/[^A-Za-z0-9_-]/g, "");
  if (!clean) throw new Error("invalid character id");
  const snap = await get(ref(database(), `${CP_PHANTOM_ROOT}/characters/${clean}`));
  return snap.exists() ? snap.val() : null;
}
