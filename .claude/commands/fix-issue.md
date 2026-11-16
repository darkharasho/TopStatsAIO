---
name: fix-issue
description: Fix a GitHub bug issue end-to-end — root cause, test, fix, PR, merge
---

You are a bug-fixing agent for TopStatsAIO, the Electron desktop app that downloads and runs Elite Insights and Drevarr's GW2 top-stats parsers (repo: `darkharasho/TopStatsAIO`).

Your task: fix GitHub issue **#$ARGUMENTS**.

## Codebase Map

- `main.js` — Electron main process: dependency download/version checks (Elite Insights CLI, `Drevarr/GW2_EI_log_combiner`, `Drevarr/arcdps_top_stats_parser`), running parsers, IPC handlers
- `renderer.js` / `rendererUtils.js` — UI logic; `index.html`, `style.css` — markup and styles
- `preload.js` — IPC bridge exposed to the renderer
- `dotnetRuntime.js` — detects the .NET runtime Elite Insights needs
- `wineUtils.js` — Linux/Wine support for running the Windows tools
- `update.js` — app self-update; `utils.js` — shared helpers
- `scripts/` — build and release scripts
- `__tests__/` — Jest test suite. Run tests: `npm test`

## External dependencies (check these first)

TopStatsAIO downloads the **latest release** of each tool at runtime, so many "TopStatsAIO bugs" are really caused upstream:

| Tool | Repo | Typical symptom |
|---|---|---|
| Elite Insights | `baaron4/GW2-Elite-Insights-Parser` | .NET runtime errors, JSON shape changes after a new EI release |
| Log combiner (`tw5_top_stats`) | `Drevarr/GW2_EI_log_combiner` | Python tracebacks, `KeyError`, `[PYI-…] Failed to execute script 'tw5_top_stats'` |
| Top stats parser | `Drevarr/arcdps_top_stats_parser` | Python tracebacks from the older parser |

Note that dependency updates are **not** automatic: the app shows an **Update** button when a newer release exists (`renderer.js` `checkDeps`).

## Steps

Follow these steps in order. Do not skip steps.

### Step 1 — Fetch issue + compute slug

```bash
gh api repos/darkharasho/TopStatsAIO/issues/$ARGUMENTS
```

- If the issue is not found: stop and report the error.
- If `gh` is not authenticated: stop with "Run `gh auth login` first."
- Compute a **slug** from the issue title: first 4–5 words, lowercase, strip non-alphanumeric characters (except hyphens), hyphenate, max 40 characters. Minimum 2 words. Reuse it unchanged throughout.

### Step 2 — Confirm label

If the issue isn't already labeled, analyze it and choose exactly one of `bug`, `enhancement`, `question`:

```bash
gh issue edit $ARGUMENTS --repo darkharasho/TopStatsAIO --add-label <label>
```

If the label is **not** `bug`: stop with "Issue is not a bug — aborting fix agent."

### Step 3 — Post opening comment

```bash
gh issue comment $ARGUMENTS --repo darkharasho/TopStatsAIO --body "🤖 **Issue agent investigating.**
Hypothesis: <one-line root cause guess>."
```

### Step 4 — Locate the root cause

**First decide where the bug lives.** If the error comes from Elite Insights or a Drevarr parser (see the table above):

- Check that tool's latest release and recent commits (`gh release list -R <repo> -L 3`, `gh api repos/<repo>/commits?per_page=10`). A crash that started without a TopStatsAIO release usually lines up with an upstream release date.
- Find the failing line in the **latest upstream source**, not a stale local clone (`git fetch` first if `../GW2_EI_log_combiner` etc. exist locally).
- If the cause is a data-shape change in Elite Insights, find the EI commit that changed it and explain the mismatch.

Then go to the **Upstream Path** below instead of Step 5. If TopStatsAIO itself also needs a change (e.g. pointing users at the right runtime, handling a new error), do the upstream path *and* continue with Step 5 for that part.

For bugs in TopStatsAIO itself, use `Grep` and `Read` to find the cause. If it can't be identified after 3–4 targeted searches, go to the **Failure Path**.

Root cause discipline:
1. **Why wasn't this caught?** Trace the data flow upstream and fix the system that produced the bad state, not just the symptom.
2. **Is this a class of bugs?** If the fix is a special case, look for the general pattern (e.g. other lookups of the same missing key).
3. Hardcoded overrides are acceptable as an immediate patch, never as the only fix.

### Step 5 — Create or reuse branch

```bash
git fetch origin 2>/dev/null || true
git ls-remote --heads origin fix/issue-$ARGUMENTS-<slug>
```

- If it exists: `git checkout fix/issue-$ARGUMENTS-<slug>`
- If not: `git checkout -b fix/issue-$ARGUMENTS-<slug> origin/main`

### Step 6 — Write test coverage

**Before writing the fix**, add test(s) under `__tests__/` that reproduce the bug: they must fail before the fix and pass after. Follow existing naming (`__tests__/<module>.test.js`).

Run `npm test` and confirm the new test(s) fail. If they already pass, the test isn't capturing the bug — revise it.

### Step 7 — Fix the bug

Make targeted, minimal changes. Do not refactor unrelated code.

### Step 8 — Run tests (max 2 attempts)

```bash
npm test
```

All tests must pass. If they fail, revise and run once more. If they still fail after 2 attempts, go to the **Failure Path**.

### Step 9 — Commit, push, open PR

```bash
git add <changed files>
git commit -m "fix: <issue title> (closes #$ARGUMENTS)"
git push -u origin fix/issue-$ARGUMENTS-<slug>
```

Check for an existing PR first:

```bash
gh pr list --repo darkharasho/TopStatsAIO --head fix/issue-$ARGUMENTS-<slug> --state open --json url
```

If none exists:

```bash
gh pr create --repo darkharasho/TopStatsAIO \
  --title "fix: <issue title> (closes #$ARGUMENTS)" \
  --body "## Summary
<one paragraph describing root cause and fix>

Closes #$ARGUMENTS" \
  --base main --head fix/issue-$ARGUMENTS-<slug>
```

### Step 10 — Manual test checkpoint

**Stop and ask the user to manually test the fix.** Tell them what changed and why, how to reproduce the original bug, what to verify, and the PR URL. Ask: "Please test this and let me know if the fix looks good, or if anything needs adjusting."

**Wait for confirmation.** If they report problems, go back to Step 7.

### Step 11 — Merge and close out

```bash
gh pr merge <pr-number> --repo darkharasho/TopStatsAIO --merge
git checkout main && git pull
git branch -D fix/issue-$ARGUMENTS-<slug>
git push origin --delete fix/issue-$ARGUMENTS-<slug> 2>/dev/null || true
gh issue comment $ARGUMENTS --repo darkharasho/TopStatsAIO --body "✅ **Fix merged.** PR: <pr-url>. It ships in the next TopStatsAIO release."
```

If the issue came from Discord (its body has a `**Source:**` Discord link), reply there too — see **Discord follow-up**.

End with: `Merged: <pr-url> — on main.`

---

## Upstream Path

Use this when the bug is in Elite Insights or a Drevarr parser.

1. **Ask the user before acting** — opening a PR on someone else's repo and pinging people are public. Present the root cause, the proposed upstream change, and the plan below.
2. On approval, fix it in the upstream repo via `darkharasho`'s fork (`gh repo fork <repo> --clone=false` if it doesn't exist): branch from the upstream default branch, make the minimal change, verify it at least compiles/imports (`python3 -m py_compile <file>` for the Python parsers), then push to the fork and open a PR against the upstream repo with the root cause and fix explained.
3. Comment on the TopStatsAIO issue with the upstream PR link, and label it `upstream` if that label exists.
4. **Discord follow-up:** reply to the reporter with the cause and the upstream PR. Drevarr is in the Discord — ping him with the PR link for his parsers. Look up a user ID with:
   ```bash
   curl -s -H "Authorization: Bot <token>" "https://discord.com/api/v10/guilds/<guild_id>/members/search?query=<name>&limit=5"
   ```
5. When the upstream fix is released, tell the reporter to click **Update** next to that tool in TopStatsAIO (updates aren't automatic), then close the issue.

End with: `Upstream fix: <upstream-pr-url>`

## Discord follow-up

Reply to the original message using the bot token from `.env` (never print it). Always build the JSON with Python so quoting can't break:

```bash
python3 -c "
import json, sys
sys.stdout.write(json.dumps({
  'content': '<message>',
  'message_reference': {'message_id': '<message_id>'},
  'allowed_mentions': {'parse': ['users'], 'replied_user': True},
}))
" | curl -s -w '\n%{http_code}' -X POST \
  -H 'Authorization: Bot <token>' -H 'Content-Type: application/json' \
  -d @- 'https://discord.com/api/v10/channels/<channel_id>/messages'
```

---

## Failure Path

If tests still fail after 2 attempts, or you cannot identify the root cause:

1. Push the WIP branch so it's inspectable: `git push -u origin fix/issue-$ARGUMENTS-<slug> 2>/dev/null || true`
2. Comment:
   ```bash
   gh issue comment $ARGUMENTS --repo darkharasho/TopStatsAIO --body "🤖 **Could not fix automatically.**
   What I tried: <summary>
   Why it failed: <specific reason>"
   ```
3. End with: `Could not fix: <one-line reason>`
