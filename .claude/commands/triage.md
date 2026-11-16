---
name: triage
description: Triage a GitHub issue or Discord message — classify it, then hand off to /fix-issue or /add-feature
---

You are a triage agent for TopStatsAIO, the Electron desktop app that runs Elite Insights and Drevarr's GW2 top-stats parsers (repo: `darkharasho/TopStatsAIO`).

Your task: triage **$ARGUMENTS** — which is either a GitHub issue number or a Discord message/thread link.

## Step 0 — Detect the input type

Look at `$ARGUMENTS`:

- **Bare number** (e.g. `42`) → this is a **GitHub issue**. Skip to Step 1A.
- Contains `discord.com/channels/` **or** is two whitespace-separated IDs (`<channel_id> <message_id>`) → this is a **Discord message**. Go to Step 1B.

If it's neither (e.g. a bare Discord message ID with no channel, or unrecognizable text), stop and output:

> **Error:** Usage: `/triage <issue-number>` or `/triage <discord-message-link>`. A bare Discord message ID alone won't work — Discord needs the channel ID too (use *Copy Message Link*).

Whichever branch you take, the goal is the same: end Step 1 holding a **GitHub issue number** (`ISSUE_NUMBER`) to triage. The Discord branch creates that issue from the message so everything downstream is identical.

---

## Step 1A — Fetch the GitHub issue

```bash
gh api repos/darkharasho/TopStatsAIO/issues/$ARGUMENTS
```

- If the issue is not found: stop and report the error.
- If `gh` is not authenticated: stop with "Run `gh auth login` first."

Set `ISSUE_NUMBER = $ARGUMENTS` and continue to Step 2.

---

## Step 1B — Materialize the Discord message as a GitHub issue

### 1B.1 — Parse the input

From `$ARGUMENTS`, extract a **channel ID** and a **message ID**:

- If it contains `discord.com/channels/`, take the last two path segments: the second-to-last is the channel ID, the last is the message ID. (The first segment after `channels/` is the guild ID — ignore it.)
- Otherwise, split on whitespace: the first token is the channel ID, the second is the message ID.

### 1B.2 — Read the Discord bot token

```bash
grep '^DISCORD_BOT_TOKEN=' .env | sed 's/^DISCORD_BOT_TOKEN=//' | tr -d '"' | tr -d "'"
```

If empty or the file doesn't exist, stop and output:

> **Error:** No Discord bot token found. Add `DISCORD_BOT_TOKEN=<your_token>` to `.env` at the repository root.

Store the token for the calls below. **Never print it.**

### 1B.3 — Fetch the message and its context

```bash
curl -s -w "\n%{http_code}" -H "Authorization: Bot <token>" \
  "https://discord.com/api/v10/channels/<channel_id>/messages/<message_id>"
```

Handle errors:
- **401 / 403:** Stop. "Bot token is invalid or the bot lacks permission to read this channel."
- **404:** Stop. "Message not found. Check the channel ID and message ID, and that the bot can see that channel."
- **429:** Read `retry_after` from the JSON body, `sleep <retry_after>`, retry once. If still 429, stop and report the rate limit.

Capture: `content`, `author` (prefer `author.global_name`, fall back to `author.username`), `timestamp`, `attachments`, and `embeds`.

Support requests in `#help` are often a back-and-forth ("sorry, another error..."), so also read the surrounding conversation:

```bash
curl -s -H "Authorization: Bot <token>" "https://discord.com/api/v10/channels/<channel_id>/messages?before=<message_id>&limit=30"
curl -s -H "Authorization: Bot <token>" "https://discord.com/api/v10/channels/<channel_id>/messages?after=<message_id>&limit=20"
```

Use the messages from the same author (and replies to them) to understand OS, app version, and what has already been tried.

If `content` is empty **and** there are no attachments/embeds, stop and output:

> **Warning:** That message has no text or images. Nothing to triage.

### 1B.4 — View any images

For each `attachments` entry whose `content_type` starts with `image/` (and any `embeds[].image` / `embeds[].thumbnail` URLs):

```bash
mkdir -p /tmp/discord_triage
curl -s -o /tmp/discord_triage/<message_id>_<index>.img "<attachment_url>"
```

Discord often serves `.webp`; convert with `magick <file> <file>.png` if needed, then Read each image. Error screenshots usually carry the real signal (Python tracebacks, exit codes, missing .NET runtime dialogs).

### 1B.5 — Create the GitHub issue

Distill the message + context + images into an issue body. Do **not** pre-apply a type label here — Step 2 classifies and labels.

```bash
gh issue create --repo darkharasho/TopStatsAIO \
  --title "<concise title summarizing the report>" \
  --body "$(cat <<'EOF'
## From Discord

**Reported by:** <author display name>
**Source:** <the message link>

### Summary
<Clear, specific restatement of what they reported or asked. Include OS, app version, error text, and anything they already tried.>

### Visual references
<One line per image on what it shows — transcribe error text verbatim. If none, write "None.">

### Original message
> <verbatim message content>
EOF
)"
```

Capture the issue **URL** and **number**. Set `ISSUE_NUMBER` to that number.

### 1B.6 — Link the issue back in Discord

Reply to the original message so the reporter knows it was captured:

```bash
python3 -c "
import json, sys
sys.stdout.write(json.dumps({
  'content': '📝 Filed for triage: <issue-url>',
  'message_reference': {'message_id': '<message_id>'},
  'allowed_mentions': {'replied_user': False},
}))
" | curl -s -w '\n%{http_code}' -X POST \
  -H 'Authorization: Bot <token>' \
  -H 'Content-Type: application/json' \
  -d @- 'https://discord.com/api/v10/channels/<channel_id>/messages'
```

If this returns 403, the bot can't post there — report it and continue; don't abort.

Continue to Step 2 with `ISSUE_NUMBER`.

---

## Step 2 — Classify and label

Analyze the issue title and body. Choose exactly one label:

| Label | Criteria |
|---|---|
| `bug` | Something is broken, crashes, or produces incorrect results — including crashes inside Elite Insights or the top-stats parser |
| `enhancement` | A new feature, UI change, or improvement to existing functionality |
| `question` | A question about usage, setup, or project direction |

```bash
gh issue edit $ISSUE_NUMBER --repo darkharasho/TopStatsAIO --add-label <label>
```

## Step 3 — Hand off

### If `bug`:

> Issue #$ISSUE_NUMBER classified as **bug**. Proceeding to fix.

Then invoke `/fix-issue $ISSUE_NUMBER`.

### If `enhancement`:

> Issue #$ISSUE_NUMBER classified as **enhancement**. Proceeding to implement.

Then invoke `/add-feature $ISSUE_NUMBER`.

### If `question`:

Do NOT hand off. Instead:

1. Post a comment answering the question (or acknowledging it):

```bash
gh issue comment $ISSUE_NUMBER --repo darkharasho/TopStatsAIO \
  --body "🤖 **Triaged as question.**
<your answer based on your understanding of the codebase>"
```

2. If the input was a Discord message, also reply there with the answer (same pattern as 1B.6, replying to the original message).

3. End with: `Triaged as question. Comment posted on #$ISSUE_NUMBER.`
