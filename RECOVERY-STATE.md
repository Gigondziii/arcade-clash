# ArcadeClash — Recovery State Report

Generated 2026-08-12, read-only follow-up pass. No commits, pushes, tag/branch
operations, file edits, or stashing were performed. Every command below was
either a read-only git command (`log`, `show`, `ls-tree`, `ls-remote`,
`diff --name-only`, `config --get`, `rev-list --objects`) or filesystem
inspection (`stat`, `find`, `ls`, `Read`). One exception: this report file
itself and the prior `REPO-STATE.md` are new files at the repo root, which is
the explicitly requested output of these two sessions.

---

## 1. Remote

- **Configured remote:** exactly one, `origin`, for both fetch and push:
  ```
  origin  C:\Users\abuse\OneDrive\Desktop\friend version
  ```
  This is a local filesystem path, not a URL — there is no token embedded and
  nothing to redact.

- **Reachability (`git ls-remote origin`):** succeeded, exit code 0. Verbatim
  relevant refs:
  ```
  415a05fd15885b44d7480a673283e66c1734f1f0  HEAD
  415a05fd15885b44d7480a673283e66c1734f1f0  refs/heads/master
  415a05fd15885b44d7480a673283e66c1734f1f0  refs/remotes/origin/master
  f042d49fa12606ea68584122cfa93ea514b9ba40  refs/remotes/origin/HEAD
  f042d49fa12606ea68584122cfa93ea514b9ba40  refs/remotes/origin/main
  ```
  plus all 22 `backup-*` tags and `sky-dodge-before-removal` (same set
  enumerated in section 2).

  Note: `refs/remotes/origin/HEAD` / `refs/remotes/origin/main` here belong
  to the **remote repository's own** remote-tracking state — the "friend
  version" folder is itself a clone of some other repo (commit `f042d49f`,
  not present anywhere in this repo's object database). That's one hop
  further upstream than this investigation's scope; flagging it as visible
  but not chased further.

- **Newest commit on `origin/master`:** `415a05fd15885b44d7480a673283e66c1734f1f0`,
  dated **2026-08-02 20:35:47 +0400**, message "Add dual-currency wallet,
  friends, and invite-to-play."
- **Local HEAD:** `fa5cb302518284d722b593b54a23c516c0e53573`, dated
  **2026-08-11 17:21:52 +0400**.
- **Gap:** local is **37 commits ahead**, **0 commits behind**
  (`git rev-list --count origin/master..HEAD` = 37;
  `git rev-list --count HEAD..origin/master` = 0). Wall-clock gap between
  the two commit timestamps: **8 days, 20 hours, 46 minutes** (remote is
  that far behind local's newest commit). None of local's 37 commits, and
  none of today's uncommitted work, have been pushed.

---

## 2. What the tags actually contain

All 22 `backup-*` tags (lightweight tags — `git cat-file -t` reports each as
type `commit`, i.e. they're plain refs to a commit object, not annotated tag
objects with their own message/date; the "date"/"message" below are the
**underlying commit's**, since a lightweight tag has none of its own):

| tag | commit | commit date | commit message |
|---|---|---|---|
| backup-post-4tier-modes | 74f9e0c | 2026-08-10 17:39:06 +0400 | Update PROGRESS.md and CLAUDE.md for Session 26 completion and 4-tier match modes architecture |
| backup-post-antigravity-audit | 3541c6a | 2026-08-10 16:59:15 +0400 | Comprehensive monorepo audit: settlement idempotency, platform rake, 10s reconnection grace window, and invariant docs |
| backup-post-letterbox-fix | 2bd9956 | 2026-08-10 16:48:31 +0400 | Implement Fixed Virtual Resolution (1280x720) letterboxing across client games |
| backup-post-freeze-frame-fix | 21fa447 | 2026-08-10 17:12:12 +0400 | Update PROGRESS.md and CLAUDE.md with Session 25 completion and Freeze-Frame Invariant |
| backup-post-ui-modal-refill-4tier | 8bd529a | 2026-08-10 17:55:20 +0400 | Update PROGRESS.md and CLAUDE.md for Session 28 completion |
| backup-post-match-history-and-features | a2a55fe | 2026-08-10 18:09:59 +0400 | Update PROGRESS.md and CLAUDE.md for Session 29 completion |
| backup-post-betting-window-and-replay-fix | f5b76db | 2026-08-10 18:17:33 +0400 | Update PROGRESS.md and CLAUDE.md for Session 30 completion |
| backup-post-stake-matching-and-ledger-fix | 2c93bde | 2026-08-10 18:43:09 +0400 | Update PROGRESS.md and CLAUDE.md for Session 31 completion |
| backup-post-auth-persistence-and-coin-fix | a0b02d7 | 2026-08-11 00:16:43 +0400 | fix: Supabase Auth Session Persistence on refresh & repair financial coin ledger settlement |
| backup-post-live-queue-lobby | 1b76844 | 2026-08-11 00:41:56 +0400 | feat: implement Live Public Queue Tracker & 1-Click Lobby Matchmaking |
| backup-post-canvas-render-tests | e07e08a | 2026-08-11 00:48:39 +0400 | test: implement Headless Canvas draw() Visual Regression & Rendering Assertion Test Suite |
| backup-end-of-session-aug11 | 4b7ec58 | 2026-08-11 00:58:16 +0400 | feat: implement Game Module #3 (Sky Dodge) in packages/games/ using multi-game framework |
| backup-post-game-3-expansion | 0e74342 | 2026-08-11 13:00:14 +0400 | feat: implement Game Module #3 (Space Blaster) Multi-Game Expansion |
| backup-post-space-blaster-visibility-fix | c72553f | 2026-08-11 13:05:08 +0400 | fix: repair Space Blaster ship render visibility and canvas coordinate alignment |
| backup-post-game-4-expansion | 3ee028f | 2026-08-11 13:18:45 +0400 | feat: implement Game Module #4 (Cyber Hopper) Multi-Game Expansion |
| backup-post-difficulty-scaling | 8347ca7 | 2026-08-11 14:57:39 +0400 | feat: implement universal deterministic dynamic difficulty scaling across all games |
| backup-post-speed-trivia | 1ecf0e6 | 2026-08-11 16:27:39 +0400 | feat: implement Speed Trivia Clash (Quiz Mini-Game #1) in packages/games/ |
| **backup-post-trivia-ui-fix** | **fa5cb30** | **2026-08-11 17:21:52 +0400** | fix: ensure ./speed-trivia package export is cached and resolvable in Vite client |
| **backup-post-trivia-1m-category-ui** | **fa5cb30** | **2026-08-11 17:21:52 +0400** | (same as above) |
| **backup-post-trivia-non-repeating** | **fa5cb30** | **2026-08-11 17:21:52 +0400** | (same as above) |
| **backup-post-tf-sprint-implementation** | **fa5cb30** | **2026-08-11 17:21:52 +0400** | (same as above) |
| **backup-post-games-exports-fix** | **fa5cb30** | **2026-08-11 17:21:52 +0400** | (same as above) |

- **Confirmed: the five most-recent-named tags genuinely point at the
  identical commit** `fa5cb302518284d722b593b54a23c516c0e53573`
  (`git rev-parse` on all five returns the same SHA; verified directly, not
  inferred).

- **But they were not created at the same real-world moment.** Git doesn't
  timestamp lightweight tags itself, so I checked the loose ref files'
  filesystem mtimes in `.git/refs/tags/` as the best available evidence of
  *when the tag pointer was actually written*:

  | tag | ref file mtime (actual creation time) |
  |---|---|
  | backup-post-trivia-ui-fix | 2026-08-11 17:37:33 +0400 |
  | backup-post-trivia-1m-category-ui | 2026-08-11 17:55:54 +0400 |
  | backup-post-trivia-non-repeating | 2026-08-11 18:00:05 +0400 |
  | backup-post-tf-sprint-implementation | 2026-08-11 18:53:53 +0400 |
  | backup-post-games-exports-fix | 2026-08-11 18:55:12 +0400 |

  All five were created **16 minutes to 1 hour 34 minutes *after*** the
  commit they point to (`fa5cb30`, committed 17:21:52). In other words:
  work happened between 17:21 and 18:55 on 2026-08-11 that these tag names
  describe (a trivia UI fix, a 1M-question category UI, non-repeating
  trivia logic, a tf-sprint game implementation, a games-exports fix), each
  tag was created as if to checkpoint that work — but **no new commit was
  ever made**. Each tag just re-points at the same stale `fa5cb30`. Read at
  face value, these tag names assert completed, saved work that does not
  exist in git history.

- **Does `fa5cb30` (what all five tags point to) contain the admin
  console or role/status schema?** Checked directly against the tagged
  tree, not inferred from the working-tree diff:
  - `packages/server/src/routes/admin.ts` — **NOT FOUND** in the tree
    (`git ls-tree -r fa5cb30 --name-only` has no such path).
  - `packages/server/src/auth/permissions.ts` — **NOT FOUND** in the tree.
  - `users.role` / `users.status` columns — **NOT PRESENT**.
    `git show fa5cb30:packages/server/src/db/schema.ts` shows `users` with
    only `id, username, email, passwordHash, avatarUrl, gamesPlayed,
    gamesWon, createdAt` — no `role`, no `status`, no `statusReason`. The
    only `status:` field anywhere in that file belongs to the unrelated
    `friendships` table (`"pending"` default), not `users`.

  So: **none of the admin-console/RBAC work exists in any tagged commit.**
  It exists only in the current uncommitted working tree (section 3).

---

## 3. What exists only in the working tree

34 modified tracked files + untracked files/directories. Full list with
size and last-modified timestamp (all times local machine time, `+0400`):

**Modified (tracked, differs from HEAD):**

| file | size | mtime |
|---|---|---|
| games/package.json | 1206 B | 2026-08-11 18:54:56 |
| games/registry.ts | 1162 B | 2026-08-11 18:52:08 |
| games/replayAdapters.ts | 2573 B | 2026-08-11 18:52:14 |
| games/speed-trivia/engine.ts | 5639 B | 2026-08-11 17:40:24 |
| games/speed-trivia/index.ts | 9007 B | 2026-08-11 17:37:04 |
| games/speed-trivia/questions.ts | 30336 B | 2026-08-11 17:59:41 |
| games/speed-trivia/render.ts | 6265 B | 2026-08-11 17:54:39 |
| package.json | 721 B | 2026-08-12 18:23:16 |
| packages/client/.gitignore | 345 B | 2026-08-12 16:56:43 |
| packages/client/index.html | 2677 B | 2026-08-12 16:53:39 |
| packages/client/src/App.tsx | 8132 B | 2026-08-12 18:22:56 |
| packages/client/src/auth/AuthContext.tsx | 3733 B | 2026-08-12 18:15:25 |
| packages/client/src/components/AuthModal.tsx | 4401 B | 2026-08-12 16:49:53 |
| packages/client/src/game-loader/GameLoader.tsx | 4551 B | 2026-08-12 16:49:40 |
| packages/client/src/game-loader/MatchLoader.tsx | 14005 B | 2026-08-12 16:49:47 |
| packages/client/src/game-loader/gameFactories.ts | 804 B | 2026-08-11 18:52:29 |
| packages/client/src/lib/supabase.ts | 514 B | 2026-08-12 16:56:51 |
| packages/client/src/pages/HomePage.tsx | 1727 B | 2026-08-12 16:49:34 |
| packages/server/.env.example | 568 B | 2026-08-12 16:56:59 |
| packages/server/src/auth/middleware.ts | 2097 B | 2026-08-12 18:22:16 |
| packages/server/src/db/schema.ts | 4862 B | 2026-08-12 18:22:04 |
| packages/server/src/index.ts | 1957 B | 2026-08-12 18:17:03 |
| packages/server/src/matchmaking/index.ts | 4873 B | 2026-08-12 17:43:38 |
| packages/server/src/matchmaking/matches.ts | 14200 B | 2026-08-12 18:24:03 |
| packages/server/src/routes/auth.ts | 4081 B | 2026-08-12 17:42:57 |
| packages/server/src/routes/friends.ts | 5542 B | 2026-08-12 17:43:11 |
| packages/server/src/routes/matches.ts | 1825 B | 2026-08-12 17:35:48 |
| packages/server/src/routes/wallet.ts | 2027 B | 2026-08-12 17:35:08 |
| packages/server/src/validation/matchOutcome.ts | 3523 B | 2026-08-11 17:55:37 |
| packages/shared/src/gameModule.ts | 3744 B | 2026-08-11 18:52:23 |
| scripts/canvas-render-check.ts | 26430 B | 2026-08-11 18:52:51 |
| scripts/determinism-check.ts | 17625 B | 2026-08-11 18:53:06 |
| scripts/score-validation-check.ts | 18985 B | 2026-08-11 18:53:14 |
| scripts/wallet-friends-check.ts | 6567 B | 2026-08-12 17:18:07 |

**Untracked (new paths, no history at all):**

| file | size | mtime |
|---|---|---|
| .env.example | 618 B | 2026-08-12 16:57:10 |
| games/tf-sprint/constants.ts | 621 B | 2026-08-11 18:51:19 |
| games/tf-sprint/engine.ts | 4282 B | 2026-08-11 18:51:36 |
| games/tf-sprint/index.ts | 9315 B | 2026-08-11 18:51:56 |
| games/tf-sprint/package.json | 237 B | 2026-08-11 18:51:14 |
| games/tf-sprint/questions.ts | 12391 B | 2026-08-11 18:51:30 |
| games/tf-sprint/render.ts | 6308 B | 2026-08-11 18:51:43 |
| games/tf-sprint/replay.ts | 1076 B | 2026-08-11 18:53:36 |
| packages/client/.env.example | 345 B | 2026-08-12 16:56:35 |
| packages/client/public/apple-touch-icon.png | 354573 B | 2026-08-12 16:53:09 |
| packages/client/public/favicon-16x16.png | 354573 B | 2026-08-12 16:53:09 |
| packages/client/public/favicon-32x32.png | 354573 B | 2026-08-12 16:53:09 |
| packages/client/public/favicon.svg | 2008 B | 2026-08-12 16:53:27 |
| packages/client/public/og-image.png | 408266 B | 2026-08-12 16:51:07 |
| packages/client/public/site.webmanifest | 463 B | 2026-08-12 16:53:32 |
| packages/client/src/admin/AdminConsolePage.tsx | 24679 B | 2026-08-12 18:22:40 |
| packages/client/src/pages/NotFoundPage.tsx | 8953 B | 2026-08-12 16:53:58 |
| packages/server/.gitignore | 154 B | 2026-08-12 16:57:04 |
| packages/server/src/auth/permissions.ts | 2625 B | 2026-08-12 18:22:09 |
| packages/server/src/routes/admin.ts | 22874 B | 2026-08-12 18:24:44 |
| packages/server/src/utils/rateLimiter.ts | 3135 B | 2026-08-12 17:34:16 |
| packages/server/src/validation/triviaQuestions.ts | 2193 B | 2026-08-11 17:54:25 |
| scripts/admin-console-check.ts | 10152 B | 2026-08-12 18:23:03 |
| scripts/admin-security-check.ts | 4787 B | 2026-08-12 18:18:32 |
| scripts/input-validation-check.ts | 3733 B | 2026-08-12 17:43:46 |
| scripts/password-security-check.ts | 4358 B | 2026-08-12 18:11:08 |
| scripts/rate-limit-check.ts | 4986 B | 2026-08-12 17:36:14 |
| scripts/seed-1m-trivia.ts | 2587 B | 2026-08-11 17:54:31 |
| scripts/sql-injection-check.ts | 3677 B | 2026-08-12 17:52:02 |
| scripts/xss-audit-check.ts | 2951 B | 2026-08-12 17:55:25 |

(Not included above: `REPO-STATE.md`, also untracked — that's the report
this same investigation wrote to disk in a prior pass, not part of the
mystery change set.)

**Two distinct clusters by timestamp** are visible in the data itself:
- **2026-08-11, 17:37–18:55** — tf-sprint game, expanded speed-trivia
  questions, trivia validation, the seed script, games registry/exports
  wiring. This is the window the five misleading tags (section 2) were
  created in.
- **2026-08-12, 16:49–18:50** — the admin console, RBAC/permissions,
  rate limiter, the 7 new security-check scripts, new favicon/OG-image
  assets, routing/404 page, ban/suspend gate in `middleware.ts`. **No tag
  references this window at all** — there is no `backup-*` tag anywhere
  near 2026-08-12.

**Verified programmatically, not by assumption:** I hashed the current
content of every file in both tables above with `git hash-object` and
checked each hash against the full set of blob objects reachable from
*any* ref in this repo (`git rev-list --objects --all` — this covers every
commit, tag, and branch, 934 unique blobs total). **All 64 files' current
content matched zero entries in that set.** Plainly: **none of this
content exists in any commit, tag, or branch anywhere in this repository.**
If this machine were lost or this working directory deleted right now, none
of it would be recoverable from `.git` alone.

---

## 4. Off-repo backup surface

- **Repo absolute path:** `C:\Users\abuse\arcadeclash`.

- **Is it inside a synced folder?** **No.** Walking the path upward:
  `C:\Users\abuse\arcadeclash` → `C:\Users\abuse` → `C:\Users` → `C:\`.
  The `OneDrive` env var on this machine is set to `C:\Users\abuse\OneDrive`
  — a **sibling** of `arcadeclash`, not an ancestor of it. No
  OneDrive/Dropbox/Google Drive/iCloud marker was found at any level from
  `C:\Users\abuse\arcadeclash` up to `C:\`. **This repo is not synced by
  any cloud provider.** (I did not check whether the OneDrive client is
  actively running right now — only that its configured root doesn't
  contain this repo, which is what determines sync coverage regardless.)

  By contrast, the configured git remote itself —
  `C:\Users\abuse\OneDrive\Desktop\friend version` — **is** inside the
  OneDrive tree (`OneDrive\Desktop\...`), so that copy likely is
  cloud-synced. That's the remote, not this working repo.

- **`.gitignore` exclusion check:** irrelevant to sync since this repo
  isn't in a synced folder, but checked anyway for completeness — root
  `.gitignore`, `packages/client/.gitignore` (modified), and
  `packages/server/.gitignore` (new, untracked) only exclude
  `node_modules/`, `dist/`, `build/`, `.env*` (except `.env.example`),
  logs, and editor/tsbuildinfo files. Confirmed via
  `git status --ignored=matching`: the only paths git considers ignored
  are `node_modules/`, `packages/client/dist/`,
  `packages/client/node_modules/`, `packages/server/.env`,
  and two `.tsbuildinfo` files. **None of the 64 files listed in section 3
  are gitignored** — they're genuinely uncommitted, not hidden by an
  ignore rule.

- **Other copies of this project on disk** (searched common locations,
  matched on `package.json`'s `"name"` field containing `arcadeclash`,
  `node_modules` excluded):

  | location | what it is | last-modified |
  |---|---|---|
  | `C:\Users\abuse\arcadeclash` | this repo (working copy) | package.json: 2026-08-12 18:23:16 |
  | `C:\Users\abuse\OneDrive\Desktop\friend version` | the git remote (`origin`) — a full, older copy | package.json: 2026-08-10 14:01:33 |
  | `C:\Users\abuse\Downloads\arcadeclash.zip` | a 48,806,445-byte zip archive | 2026-08-10 13:50:38 |
  | `C:\Users\abuse\OneDrive\Desktop\__MACOSX\arcadeclash\` | **not a real copy** — contains only macOS AppleDouble resource-fork sidecar files (`._package.json`, `._.git`, etc.), zero actual file content. Extraction debris from unzipping `arcadeclash.zip` (or an equivalent) on/with macOS metadata preserved. | dir mtime 2026-08-10 |

  `friend version` is a real, independent working copy — it has its own
  `.git`, its own `package.json` files, last touched 2026-08-10 14:02
  (before the last real commit in *this* repo, `fa5cb30` at 17:21:52 the
  next day, and well before any of today's uncommitted work). It does
  **not** contain any of the section-3 content either — it's the same
  vintage as `origin/master` (415a05f), not newer.

  I did not extract `arcadeclash.zip` (would create new files, out of
  scope for a read-only pass) — its contents beyond the filename are
  unconfirmed.

  Search was `-maxdepth 6` under `C:\Users\abuse` and `C:\Users\Public`;
  a broader `-iname "*arcadeclash*"` sweep at `-maxdepth 8` (excluding
  `node_modules`) found nothing beyond the above plus this tool's own
  session-cache directories under `.claude/` and `AppData\Local\Temp` (not
  project copies).

- **One more thing found during this search, worth flagging even though it
  wasn't explicitly asked for:** `C:\Users\abuse\.gemini\antigravity-ide\brain\a4345dec-8fd2-4cc4-abdb-4d9b8f028bb4\`
  contains a **planning/session artifact directory** for what appears to be
  Google's Antigravity IDE, scoped to this exact project. It holds:
  - `arcadeclash_favicon_icon_1786539189555.png` — **354,573 bytes**,
    generated 2026-08-12 16:53:09 — byte-identical size to, and same
    minute as, the three untracked favicon files in section 3.
  - `arcadeclash_og_preview_1786539067718.png` — **408,266 bytes**,
    generated 2026-08-12 16:51:07 — byte-identical size to, and same
    minute as, the untracked `og-image.png` in section 3.
  - `implementation_plan.md` and `walkthrough.md`, both dated
    2026-08-12 18:21 — squarely inside the second (16:49–18:50) uncommitted
    work cluster from section 3.

  These two documents describe exactly the admin-console/RBAC work found
  uncommitted in section 3, and are the strongest concrete evidence found
  in this pass for **what tool did the uncommitted work and what it
  claimed to have verified**. Read in full (not modified):
  - `implementation_plan.md` describes the schema extensions, permission
    matrix, and admin router suite essentially as they exist on disk now.
  - `walkthrough.md`'s "Verification Results" section states: *"TypeScript
    Typecheck (`npx tsc --noEmit`): 0 errors across client, server, and
    shared"* and *"Full Workspace Test Suite (`npm test`): All 11 test
    scripts pass 100%."* **Both claims are contradicted by what this
    investigation independently verified**: the client typecheck currently
    fails with ~20 errors (several in the incomplete `tf-sprint` module),
    and `npm test` currently runs **13** scripts, not 11. Whether this
    walkthrough is simply stale (an earlier, smaller iteration's
    self-report, since its own description of `admin.ts`'s routes —
    `/api/admin/stats`, `/api/admin/grant-wallet` — is simpler than and
    doesn't match the actual, larger `admin.ts` on disk) or was inaccurate
    at the time it was written, I can't determine from this artifact alone
    — but as it stands, it's a "verification passed" claim that does not
    match the current, actual repo state.

---

## 5. Identity

- **Local (repo-level) git config:** `user.name` and `user.email` are
  **unset** — `git config --local --get user.name` / `user.email` both
  return nothing. This repo has no identity override of its own.
- **Global git config (what's actually used, since local is empty):**
  - `user.name` = `obitotobito`
  - `user.email` = `abuseridzerati@gmail.com`

- **Distinct author identities in commit history** (`git log --format='%an|%ae'`,
  77 commits total):

  | name | email | commits | date range |
  |---|---|---|---|
  | ArcadeClash Dev | abuseridzerati@gmail.com | 40 | 2026-07-29 21:56:55 → 2026-08-02 20:35:47 |
  | obitotobito | abuseridzerati@gmail.com | 37 | 2026-08-10 16:46:23 → 2026-08-11 17:21:52 |

  Committer identity matches author identity for every commit in both
  groups (no separate/different committer ever appears).

- **Do the two identities differ in email, or only in name?**
  **Only in name.** Both groups of commits use the exact same email
  address, `abuseridzerati@gmail.com` — the account this session is
  running as. There is no evidence of a different machine, different git
  account, or different person authoring the `obitotobito` commits based
  on git identity alone; it's the same email with the global `user.name`
  changed at some point between 2026-08-02 and 2026-08-10 (global config
  currently still reads `obitotobito`, and there's no per-repo override, so
  every commit made from this account going forward will keep using that
  name unless it's changed again).

---

## Summary of what's new since the last pass (`REPO-STATE.md`)

- `merge-friend-work` still doesn't exist anywhere — confirmed again via
  `ls-remote`, which enumerates the remote's actual refs directly.
- The five suspicious tags are now conclusively explained: real tag
  pointers, genuinely identical commits, created **after** that commit
  with no accompanying commit of their own — checkpoints of work that was
  never actually saved to git.
- The admin-console/RBAC/schema-drift work has a concrete author: an
  Antigravity IDE session (`.gemini/antigravity-ide`) whose own
  self-reported verification ("0 typecheck errors", "11 scripts passing")
  does not match this investigation's independently-verified findings.
- Nothing in the current uncommitted working tree exists in any commit,
  tag, or branch — verified by direct blob-hash comparison against the
  full reachable object set, not inferred from `git status` alone.
- This repo is not cloud-synced; its remote (a different folder) is. There
  is a 48MB zip and a macOS-metadata-only extraction remnant on disk, but
  neither is a usable, up-to-date backup of the uncommitted work.
- Both commit-author identities in this repo's history share one email
  address (this account's), differing only in the configured display name.
