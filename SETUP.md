# Setup checklist — the parts only you can do

The code is done for Phase 1. These steps need your accounts / secrets — Claude
can't create them.

## 1. Vercel (hosting + the API-key vault)

1. Go to vercel.com → **Add New → Project** → import `JuliusBiTS/CP-Phantom-Game`.
2. Framework preset: **Next.js** (auto-detected). No overrides needed.
3. Before the first deploy, add **Environment Variables**:
   - `ANTHROPIC_API_KEY` = your key from console.anthropic.com. **This is the only
     thing that must never be in the repo.** Vercel injects it server-side only.
   - `SOLO_MODEL` = `claude-sonnet-5` (default; cheaper per turn) or
     `claude-opus-5` (best narration, ~2.5× the token cost).
   - The `NEXT_PUBLIC_FIREBASE_*` values from step 2 (optional — skip for now if
     you just want to playtest with localStorage).
4. Deploy. Every `git push` to `main` auto-deploys from then on.

Free "Hobby" tier is fine for single-user solo play.

## 2. Firebase (persistence) — optional for the first playtest

Without Firebase, campaigns save to your browser's localStorage — enough to
prove the consistency + dice architecture on one machine (§9 tests 1, 3–5), just
not across devices/sessions. Do this step when you want real persistence.

Reuse the **same Firebase project** as CP Phantom. The solo tool only ever
touches one new top-level node, `soloCampaigns/`. That isolation is enforced
twice: in code (`src/lib/storage/firebase.ts` throws on any path outside
`soloCampaigns/`, and there is no write path to `campaign/` at all) and by the
security rules in step 2.4. Your CP Phantom `campaign/` data is never read or
written by this tool.

### 2.1 — Get the Firebase web config

1. Open the [Firebase console](https://console.firebase.google.com/) → your
   **CP Phantom project**.
2. Click the gear icon (top-left) → **Project settings**.
3. Scroll to **Your apps**. Use the existing Web app (`</>` icon) — you do NOT
   need to add a new one. If there is no Web app, click **Add app → Web**, name
   it `solo`, skip Firebase Hosting, Register.
4. Under **SDK setup and configuration**, select **Config**. You'll see:

   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "your-project.firebaseapp.com",
     databaseURL: "https://your-project-default-rtdb.europe-west1.firebasedatabase.app",
     projectId: "your-project",
     storageBucket: "your-project.appspot.com",
     messagingSenderId: "1234567890",
     appId: "1:1234567890:web:abc123",
   };
   ```

5. **If `databaseURL` is missing** from that object: go to **Build → Realtime
   Database** in the left nav. The URL shown at the top of the Data tab (e.g.
   `https://your-project-default-rtdb.firebaseio.com`) is your `databaseURL`.
   If there is no Realtime Database yet, click **Create Database**, pick the
   region closest to you, and start in **locked mode** (step 2.4 opens the one
   node you need).

### 2.2 — Map the config to env var names

| `firebaseConfig` key | Vercel environment variable |
|---|---|
| `apiKey` | `NEXT_PUBLIC_FIREBASE_API_KEY` |
| `authDomain` | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` |
| `databaseURL` | `NEXT_PUBLIC_FIREBASE_DATABASE_URL` |
| `projectId` | `NEXT_PUBLIC_FIREBASE_PROJECT_ID` |
| `storageBucket` | `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` |
| `messagingSenderId` | `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` |
| `appId` | `NEXT_PUBLIC_FIREBASE_APP_ID` |

Only `API_KEY`, `DATABASE_URL`, and `PROJECT_ID` are strictly required; add the
rest anyway. These are the *public* web-app values — they're safe to expose;
access is governed by the database rules, not by hiding them.

### 2.3 — Add them to Vercel

1. Vercel → your project → **Settings → Environment Variables**.
2. Add each row from the table above. Environment: tick **Production**,
   **Preview**, and **Development**.
3. **Redeploy**: Deployments tab → latest → ⋯ → **Redeploy**. Env vars only take
   effect on a fresh deploy.

For local dev, put the same values in `.env.local` (see `.env.example`).

### 2.4 — Add the security rule for the isolated node

1. Firebase console → **Build → Realtime Database → Rules** tab.
2. You'll see your current rules — likely something like
   `{ "rules": { "campaign": { ... } } }`. **Add a `soloCampaigns` sibling** to
   whatever `campaign` block is already there. Do not delete or edit the
   `campaign` block:

   ```json
   {
     "rules": {
       "campaign": {
         "// your existing CP Phantom rules stay exactly as they are": true
       },
       "soloCampaigns": {
         ".read": true,
         ".write": true
       }
     }
   }
   ```

   (If your current rules are just `{ "rules": { ".read": ..., ".write": ... } }`
   with nothing nested, tell me and I'll give you the merged version — a
   top-level `.read`/`.write` there would also cover `campaign`, which you may or
   may not want.)

3. Click **Publish**.

**Why open read/write on `soloCampaigns` for now:** this is a personal
single-user tool with no login yet, and the node is isolated. Anyone who has
your `databaseURL` could read/write *that node only* — not your campaign data.
Phase 2 adds auth-gating here alongside the life-path creator. If that bothers
you before then, the quick hardening is a rules condition on a secret path
segment — ask and I'll wire it.

### 2.5 — Verify

1. After the redeploy, open the app, create a campaign, take one turn.
2. Firebase console → **Realtime Database → Data**. You should see a new
   `soloCampaigns` node appear, and `campaign` completely unchanged.
3. Everything the solo tool stores lives under `soloCampaigns/` — you can delete
   that whole node at any time with zero effect on CP Phantom.

## 3. First playtest

1. Open the deployed URL (or `npm run dev` locally with `.env.local`).
2. **+ New campaign** → name it → pick Gigs → paste a character JSON exported
   from CP Phantom (or leave blank for a stub runner).
3. Play ~30–40 turns. Watch for:
   - Every enemy/NPC roll shows up in "Engine rolls this turn" with real dice —
     never just narrated.
   - Your own actions always pause for a physical roll — the tool never rolls
     for you.
   - Facts established early (an NPC's name, a promise) still hold 30 turns later.
4. Report back what breaks. Phase 2 starts after you've actually played it.

## Local dev

```bash
npm install
cp .env.example .env.local     # fill in ANTHROPIC_API_KEY at minimum
npm run dev                     # http://localhost:3000
npm test                        # dice engine + rules (no API key needed)
```
