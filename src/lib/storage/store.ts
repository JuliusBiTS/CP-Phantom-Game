/**
 * Campaign persistence — client-owned. The state travels in each /api/turn
 * request body (keeps the serverless function purely functional), and the
 * client saves the returned state here.
 *
 *  - `localStore`: zero-setup, works immediately. Good enough for the Phase 1
 *    single-machine consistency playtest (§9 tests 1 & 3-5).
 *  - `firebaseStore`: real cross-session / cross-device persistence under the
 *    isolated `soloCampaigns/` node. Needed for §9 test 2 done properly.
 */

import { CampaignState } from "../state/campaignState";
import { firebaseConfigured, soloRead, soloWrite } from "./firebase";

export interface CampaignStore {
  list(): Promise<Array<{ id: string; name: string; lastPlayedAt: number }>>;
  load(id: string): Promise<CampaignState | null>;
  save(state: CampaignState): Promise<void>;
}

const LS_PREFIX = "cpph_solo:";

export const localStore: CampaignStore = {
  async list() {
    if (typeof localStorage === "undefined") return [];
    const out: Array<{ id: string; name: string; lastPlayedAt: number }> = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(LS_PREFIX)) continue;
      try {
        const s = JSON.parse(localStorage.getItem(key)!) as CampaignState;
        out.push({ id: s.meta.id, name: s.meta.name, lastPlayedAt: s.meta.lastPlayedAt });
      } catch {
        /* skip corrupt */
      }
    }
    return out.sort((a, b) => b.lastPlayedAt - a.lastPlayedAt);
  },
  async load(id) {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(LS_PREFIX + id);
    if (!raw) return null;
    return CampaignState.parse(JSON.parse(raw));
  },
  async save(state) {
    if (typeof localStorage === "undefined") return;
    const key = LS_PREFIX + state.meta.id;
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // Quota hit — the undo ring is the biggest droppable payload. Shed it and retry.
      try {
        localStorage.setItem(key, JSON.stringify({ ...state, history: [] }));
      } catch {
        /* still too big — give up silently; Firebase users are unaffected */
      }
    }
  },
};

export const firebaseStore: CampaignStore = {
  async list() {
    const idx = (await soloRead<Record<string, { name: string; lastPlayedAt: number }>>("index")) ?? {};
    return Object.entries(idx)
      .map(([id, v]) => ({ id, name: v.name, lastPlayedAt: v.lastPlayedAt }))
      .sort((a, b) => b.lastPlayedAt - a.lastPlayedAt);
  },
  async load(id) {
    const raw = await soloRead(`campaigns/${id}`);
    return raw ? CampaignState.parse(raw) : null;
  },
  async save(state) {
    const { id, name, lastPlayedAt } = state.meta;
    await soloWrite(`campaigns/${id}`, state);
    await soloWrite(`index/${id}`, { name, lastPlayedAt });
  },
};

export function getStore(): CampaignStore {
  return firebaseConfigured() ? firebaseStore : localStore;
}
