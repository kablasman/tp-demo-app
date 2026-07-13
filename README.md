# TP Agent — Slack Prototype

A clickable Slack integration prototype for **TP Agent** (Teleperformance's "Hybrid AI for human-in-the-loop CX workflows"). It demonstrates how the TP.ai platform can use Slack as an interaction channel: pushing CX **Alerts / Notifications** into channels, hosting a conversational assistant over **Conversation Intelligence** data, letting operators **swarm** on an alert (Human-In-The-Loop), and pushing a scheduled CX digest.

Built with [Slack Bolt](https://tools.slack.dev/bolt-js/) in **Socket Mode**. All CX data is scripted mock data — deterministic, no external AI, no latency, safe for live demos.

## Features

| Surface | What it does |
|---|---|
| **App Home** | CX intelligence dashboard: KPIs, per-channel performance (`data_table`), and an **Active alerts** carousel. Each alert card has **View** (DMs the full alert) and **Send to channel**. |
| **@mention** | Mention the bot in a channel or alert thread to ask about CX metrics; it streams a response with a loading status and native charts. Follow-up replies in the same thread are answered automatically (no re-mention). |
| **DM / Assistant** | The Assistant container (Messages tab) with suggested prompts, native `setStatus` loading, and streamed replies. |
| **Send to channel** | From a Home alert card, a modal (public-channel picker + optional rich-text note) posts the full alert — chart + suggested-action buttons — to a channel. |
| **`/fab-digest`** | Post or schedule a **Daily CX Digest** (KPIs + active alerts) to a channel. |

### Alerts
Five mock alerts of varying severity power the Home carousel and the digest: `claims` (Critical), `billing` (High), `cancellation` (High), `onboarding` (Medium), `ordertracking` (Low). Each has a hyperlinked title (links to an example TP dashboard URL), a native trend chart with a threshold line, and suggested-action buttons (Re-route to CE / Deploy macro / Escalate to human / Dismiss).

### What you can ask the assistant
- *"chat volume today"* — volume + week-over-week trend
- *"CSAT for email"* — CSAT, sentiment, handle time, containment
- *"CSAT by channel"* — compare all channels
- *"collaboration mode breakdown"* — Agent↔Human mix (pie)
- *"what's driving the claims alert?"* — root-cause deep-dive
- *"which journeys are at risk?"* — journey health
- *"give me an overview"* — today's operations at a glance

### `/fab-digest` subcommands
- `/fab-digest now` — post the digest immediately
- `/fab-digest on [minutes]` — auto-post to this channel every N minutes (default 60)
- `/fab-digest off` — stop the schedule
- `/fab-digest` — show status + usage

## Setup

**Prereqs:** Node 18+ (tested on v24), a Slack workspace where you can install an app.

1. **Install deps**
   ```bash
   npm install
   ```

2. **Create the Slack app from the manifest**
   - Go to <https://api.slack.com/apps> → *Create New App* → *From a manifest*.
   - Pick your workspace and paste the contents of [`manifest.json`](./manifest.json).
   - Socket Mode, App Home, the Agents & Assistants view, slash command, scopes, and event subscriptions are all pre-configured.

3. **Generate tokens**
   - **Bot token** (`xoxb-…`): *OAuth & Permissions* → *Install to Workspace*.
   - **App-level token** (`xapp-…`): *Basic Information* → *App-Level Tokens* → generate one with the `connections:write` scope (required for Socket Mode).
   - **Signing secret**: *Basic Information* → *App Credentials*.

4. **Configure environment**
   ```bash
   cp .env.example .env
   # then fill in SLACK_BOT_TOKEN, SLACK_APP_TOKEN, SLACK_SIGNING_SECRET
   ```

5. **Run**
   ```bash
   npm start
   ```
   You should see `⚡️ TP Agent is running (Socket Mode)`.

> Tip: invite the bot to your demo channel (`/invite @TP Agent`) so it can post alerts and digests there. After editing `manifest.json`, re-save it in the app config and **reinstall** the app so scope/command/event changes take effect.

## Always-on hosting (Render)

This repo includes [`render.yaml`](./render.yaml) configured as a **background worker** (Socket Mode holds an outbound WebSocket, so there's no HTTP port and it must never sleep).

1. Push this repo to GitHub/GitLab.
2. On [Render](https://dashboard.render.com): **New → Blueprint**, connect the repo (it reads `render.yaml`).
3. Set `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`, `SLACK_SIGNING_SECRET` in the service's Environment tab.
4. Deploy, then check Logs for `⚡️ TP Agent is running`.
5. Stop any local instance so two processes don't compete for the same Socket Mode connection.

> The `starter` plan is used because Render's free tier sleeps, which drops the Socket Mode connection.

## Project structure

```
app.js                 Bolt bootstrap; registers all listeners + the Assistant
manifest.json          Slack app manifest (Socket Mode, Agents view, scopes, /fab-digest)
data.js                Mock CX dataset + helpers (channels, journeys, alerts, roster, NL matcher, chart specs)
charts.js              Native data_visualization block builders + QuickChart image fallback
blocks.js              Block Kit builders (Home dashboard, alert message, digest, bot answers, send-to-channel modal)
bot.js                 Mention cleanup → scripted answer → blocks (reply / replyParts)
streaming.js           Loading status + emulated text streaming for @mentions
render.yaml            Render blueprint (background worker)
listeners/
  home.js              app_home_opened → dashboard
  mentions.js          app_mention + threaded follow-ups (conversations.replies)
  assistant.js         Assistant container (DM): suggested prompts, setStatus, sayStream
  actions.js           alert action buttons, View / Send-to-channel, send modal submit
  digest.js            /fab-digest (now / on / off) + scheduling
```

## Notes & scope

- **Charts & tables:** Uses Slack's native [`data_visualization`](https://docs.slack.dev/reference/block-kit/blocks/data-visualization-block/) block for charts and the [`data_table`](https://docs.slack.dev/reference/block-kit/blocks/data-table-block/) block for channel performance — no external image hosting. (These are newer blocks; the workspace/app must support them.)
- **Streaming:** Real token streaming (`chat.startStream`) requires the Agents & Assistants feature enabled. The @mention path emulates a loading status + streamed reveal so it works without it; DMs use the native Assistant APIs.
- **State:** Digest schedules and the agent roster are in-memory only (reset on restart) — fine for a prototype.
- **Out of scope (v1):** real LLM wiring, Canvases, real data ingestion/persistence, HTTP-mode deployment, OAuth multi-workspace distribution, Marketplace listing.
```
