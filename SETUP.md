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

Reuse the **same Firebase project** as CP Phantom. The solo tool only ever
touches a new top-level node, `soloCampaigns/` — this is enforced both in code
(`src/lib/storage/firebase.ts` throws on any other path) and by the security
rules below.

1. Firebase console → your CP Phantom project → **Project settings → General →
   Your apps**. Either reuse the existing web app's config or **Add app → Web**
   for a "solo" app. Copy the config values into Vercel's env vars
   (`NEXT_PUBLIC_FIREBASE_API_KEY`, `..._DATABASE_URL`, `..._PROJECT_ID`, etc.).
2. **Realtime Database → Rules.** Add a `soloCampaigns` block *alongside* your
   existing `campaign` rules — do not replace them:

   ```json
   {
     "rules": {
       "campaign": {
         "...": "// your existing CP Phantom rules — leave untouched"
       },
       "soloCampaigns": {
         ".read": true,
         ".write": true
       }
     }
   }
   ```

   (Phase 1 uses open rules on the solo node for simplicity — it's a personal
   single-user tool. Tighten to auth-gated in Phase 2 alongside the life-path
   creator. Your `campaign` node's rules are completely separate and unaffected.)

3. Redeploy on Vercel so it picks up the new env vars.

Without Firebase, campaigns are saved to your browser's localStorage — good
enough to prove the consistency architecture on one machine (§9 tests 1, 3–5),
just not across devices.

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
