# ArcadeClash — standing rules

Read `PROGRESS.md` first (self-contained handoff doc, updated every
session) and `GAMES.md` (per-game manifest) before doing anything else.
This file holds durable process rules, not project status — status lives
in `PROGRESS.md`.

## Documentation rules (added 2026-07-30, after an audit found docs claiming features as "established" that didn't exist in code)

1. **Code is the source of truth.** If a doc (`PROGRESS.md`, `GAMES.md`,
   a game's own files, anything) and the actual code disagree, the code
   wins. Correct the doc — don't treat the doc as authoritative just
   because it's more detailed or was written more recently than the code
   changed.

2. **Never assume an architectural feature exists because a doc
   describes it.** Grep or read the actual source first. A doc saying
   "seeded RNG is in place" or "engines are shared across games" is a
   claim, not evidence — verify it before building on top of it,
   especially before a new system (matchmaking, wallet, etc.) is about to
   depend on the claim being true.

3. **Every claim in `PROGRESS.md` must state how it was verified**: ran a
   test / read the code / user confirmed in their own browser / assumed.
   "Assumed" is a legitimate answer — write it down as assumed rather
   than omitting the verification method or implying a stronger check
   happened.

4. **Mark every architectural claim BUILT or PLANNED.** New claims
   default to PLANNED until someone actually verifies them in code (by
   reading it, grepping it, or running it) — don't write something as
   built based on it having been discussed, proposed, or intended.

5. **Before reporting a session complete, run every test script in
   `scripts/`, not just the ones touched by that session's work, and
   report each script's pass count explicitly.** "Tests pass" without a
   count is not verification. Added 2026-07-31 after
   `scripts/matchmaking-check.ts` silently failed 6 assertions for two
   sessions — a payload-shape change in one session's work (score
   validation requiring `inputLog`/`viewport` on every submission) broke
   a different, unrelated script that nobody re-ran to check.

## Environment gotchas (this machine specifically — see PROGRESS.md "Decisions" for full detail on each)

- Node.js is not on the system PATH — prefix PowerShell commands with
  `$env:Path = "C:\Program Files\nodejs;" + $env:Path`.
- Restart the server via PowerShell (`Get-CimInstance Win32_Process` +
  `Stop-Process`), not git-bash's `pkill` — it silently fails to kill
  Windows-native node processes, leaving stale servers with stale env
  vars. Confirm via `netstat` that the new process actually holds the
  port.
- Vite needs `server: { host: true }` in `vite.config.ts` for the dev
  server to be reachable via IPv4 on this machine (already set).
- Before reporting any UI element or feature as missing/broken, run
  netstat and confirm BOTH the client (5173) AND the Express server
  are LISTENING. A dead backend presents as silently missing features
  (no Find Opponent, cannot log in), not as an error message.
  Third occurrence of an environment-state false alarm — see sessions
  9, 12, and 20.
