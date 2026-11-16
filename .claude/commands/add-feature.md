---
name: add-feature
description: Implement an enhancement issue end-to-end — plan, test, implement, PR, merge
---

You are a feature implementation agent for TopStatsAIO, the Electron desktop app that downloads and runs Elite Insights and Drevarr's GW2 top-stats parsers (repo: `darkharasho/TopStatsAIO`).

Your task: implement the feature requested in GitHub issue **#$ARGUMENTS**.

## Codebase Map

- `main.js` — Electron main process: dependency download/version checks, running parsers, IPC handlers
- `renderer.js` / `rendererUtils.js` — UI logic; `index.html`, `style.css` — markup and styles
- `preload.js` — IPC bridge exposed to the renderer (new IPC calls need an entry here)
- `dotnetRuntime.js` — .NET runtime detection; `wineUtils.js` — Linux/Wine support
- `update.js` — app self-update; `utils.js` — shared helpers
- `top_stats_config.ini`, `EliteInsightsConfigTemplate.conf` — config templates shipped with the app
- `__tests__/` — Jest test suite. Run tests: `npm test`

If the request is really about what the top-stats output contains (new stats, tables, columns), that lives in `Drevarr/GW2_EI_log_combiner`, not here. Tell the user and ask whether to propose it upstream before doing anything.

## Steps

Follow these steps in order. Do not skip steps.

### Step 1 — Fetch issue + compute slug

```bash
gh api repos/darkharasho/TopStatsAIO/issues/$ARGUMENTS
```

- If the issue is not found: stop and report the error.
- If `gh` is not authenticated: stop with "Run `gh auth login` first."
- If it has a `bug` label, stop with "Issue is a bug — use `/fix-issue $ARGUMENTS` instead."
- Compute a **slug** from the issue title: first 4–5 words, lowercase, strip non-alphanumeric characters (except hyphens), hyphenate, max 40 characters. Minimum 2 words. Reuse it unchanged throughout.

### Step 2 — Label

If the issue doesn't already have `enhancement`:

```bash
gh issue edit $ARGUMENTS --repo darkharasho/TopStatsAIO --add-label enhancement
```

### Step 3 — Explore + plan

Read the code relevant to the feature (UI → `renderer.js`, `index.html`, `style.css`; dependency/parser handling → `main.js`; anything crossing processes → also `preload.js`).

**Before writing any code**, present a brief plan to the user:
1. Which files will change
2. What the changes do at a high level
3. Design decisions or trade-offs

Ask: "Does this approach look good, or would you like me to adjust anything?"

**Wait for confirmation before continuing.**

### Step 4 — Post opening comment

```bash
gh issue comment $ARGUMENTS --repo darkharasho/TopStatsAIO --body "🤖 **Feature agent working on this.**
Approach: <one-line summary of the agreed plan>.
Branch: \`feat/issue-$ARGUMENTS-<slug>\`."
```

### Step 5 — Create or reuse branch

```bash
git fetch origin 2>/dev/null || true
git ls-remote --heads origin feat/issue-$ARGUMENTS-<slug>
```

- If it exists: `git checkout feat/issue-$ARGUMENTS-<slug>`
- If not: `git checkout -b feat/issue-$ARGUMENTS-<slug> origin/main`

### Step 6 — Write test coverage

Add tests under `__tests__/` for the new behavior (`__tests__/<module>.test.js`). Run `npm test` and confirm they fail before implementation. If they already pass, they aren't covering the new behavior — revise.

### Step 7 — Implement

Targeted, minimal changes that follow existing patterns. Don't refactor unrelated code. Keep UI consistent with existing styles.

### Step 8 — Run tests (max 2 attempts)

```bash
npm test
```

All tests must pass. If they fail, revise and run once more. If they still fail after 2 attempts, go to the **Failure Path**.

### Step 9 — Manual test checkpoint

**Stop and ask the user to try the feature** (`npm start`). Tell them what was added and where, how to exercise it, and what to verify. Ask: "Please test this and let me know if the feature looks good, or if anything needs adjusting."

**Wait for confirmation.** If they report problems, go back to Step 7.

### Step 10 — Commit, push, open PR

```bash
git add <changed files>
git commit -m "feat: <issue title> (closes #$ARGUMENTS)"
git push -u origin feat/issue-$ARGUMENTS-<slug>
```

Check for an existing PR:

```bash
gh pr list --repo darkharasho/TopStatsAIO --head feat/issue-$ARGUMENTS-<slug> --state open --json url
```

If none:

```bash
gh pr create --repo darkharasho/TopStatsAIO \
  --title "feat: <issue title> (closes #$ARGUMENTS)" \
  --body "## Summary
<one paragraph describing the feature and implementation>

Closes #$ARGUMENTS" \
  --base main --head feat/issue-$ARGUMENTS-<slug>
```

### Step 11 — Merge and close out

```bash
gh pr merge <pr-number> --repo darkharasho/TopStatsAIO --merge
git checkout main && git pull
git branch -D feat/issue-$ARGUMENTS-<slug>
git push origin --delete feat/issue-$ARGUMENTS-<slug> 2>/dev/null || true
gh issue comment $ARGUMENTS --repo darkharasho/TopStatsAIO --body "✅ **Feature merged.** PR: <pr-url>. It ships in the next TopStatsAIO release."
```

If the issue came from Discord (its body has a `**Source:**` Discord link), reply to the original message letting the requester know it's merged and will ship in the next release. Use the bot token from `.env` (never print it) and build the JSON with Python:

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

End with: `Merged: <pr-url> — on main.`

---

## Failure Path

If tests still fail after 2 attempts, or there's no viable implementation:

1. Push the WIP branch: `git push -u origin feat/issue-$ARGUMENTS-<slug> 2>/dev/null || true`
2. Comment:
   ```bash
   gh issue comment $ARGUMENTS --repo darkharasho/TopStatsAIO --body "🤖 **Could not implement automatically.**
   What I tried: <summary>
   Why it failed: <specific reason>"
   ```
3. End with: `Could not implement: <one-line reason>`
