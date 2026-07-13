# TP Agent — Slack Prototype

A clickable Slack integration prototype for **TP Agent** (Teleperformance's "Hybrid AI for human-in-the-loop CX workflows"). It demonstrates how the TP.ai platform can use Slack as an interaction channel: pushing CX **Alerts / Notifications** into channels, hosting a conversational assistant over **Conversation Intelligence** data, letting operators **swarm** on an alert (Human-In-The-Loop), and provisioning custom AI agents from a roster.

Built with [Slack Bolt](https://tools.slack.dev/bolt-js/) in **Socket Mode**. All CX data is scripted mock data — deterministic, no external AI, no latency, safe for live demos.

## Features

| Surface | What it does |
|---|---|
| **App Home** | CX intelligence dashboard: KPIs, per-channel performance, active alerts, a 7-day volume chart, and an *Add Agent* button. |
| **`/fab-alert [id]`** | Posts a rich Alert / Notification (anomaly / Predictive SLA) to the channel — with a trend chart and *suggested action* buttons. |
| **@mention / DM** | Ask about CX metrics (e.g. *"chat volume today"*, *"CSAT for email"*, *"what's driving the claims alert?"*). Mention it in an alert thread to swarm. |
| **`/fab-add-agent`** | Modal to provision a custom AI agent (name, skill level, Collaboration Mode, channel) into a channel. |
| **`/fab`** | Menu / entry point. |

Alert ids: `claims`, `billing`, `cancellation`.

## Setup

**Prereqs:** Node 18+ (tested on v24), a Slack workspace where you can install an app.

1. **Install deps**
   ```bash
   npm install
   ```

2. **Create the Slack app from the manifest**
   - Go to <https://api.slack.com/apps> → *Create New App* → *From a manifest*.
   - Pick your workspace and paste the contents of [`manifest.json`](./manifest.json).
   - (Socket Mode, App Home, slash commands, scopes, and event subscriptions are all pre-configured.)

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

## Live demo script

1. **Dashboard** — Open the app's **Home** tab. KPIs, channel breakdown, the volume chart, and the active alert list render.
2. **Post an alert** — In a channel the bot is in, run `/fab-alert claims`. A *Critical* Claims Intake alert appears with a trend chart and suggested-action buttons.
3. **Swarm** — @mention the app in that alert's thread: *"what's driving this?"* → it replies in-thread with the root-cause summary + chart.
4. **DM** — DM the app *"chat volume today"* → metric answer with a 7-day trend chart.
5. **Take an action** — Click **Reroute to senior CE** on the alert → the message updates in place: *"✅ Rerouted to senior CE by @you"*.
6. **Add an agent** — Click **Add Agent to Slack** (Home tab) or run `/fab-add-agent` → fill in the modal → a provisioning confirmation posts to the chosen channel.

> Tip: invite the bot to your demo channel (`/invite @TP Agent`) so it can post alerts and agent confirmations there.

## Project structure

```
app.js                 Bolt bootstrap + /fab menu; registers all listeners
manifest.json          Slack app manifest (Socket Mode, scopes, commands)
data.js                Mock CX dataset + helpers (channels, journeys, alerts, roster, NL matcher)
charts.js              Native data_visualization block builders (line / bar)
blocks.js              Block Kit builders (Home, alert, bot answer, Add Agent modal)
bot.js                 Mention cleanup → scripted answer → blocks
listeners/
  home.js              app_home_opened → dashboard
  interventions.js     /fab-alert → post alert
  mentions.js          app_mention + DM → assistant replies
  actions.js           button actions, Add Agent modal, menu buttons
```

## Notes & scope

- **Charts & tables:** Uses Slack's native [`data_visualization`](https://docs.slack.dev/reference/block-kit/blocks/data-visualization-block/) block for trend charts and the [`data_table`](https://docs.slack.dev/reference/block-kit/blocks/data-table-block/) block for channel performance — no external image hosting.
- **State:** The agent roster is in-memory only (resets on restart) — fine for a prototype.
- **Out of scope (v1):** real LLM wiring, Canvases, real data ingestion/persistence, production HTTP deployment, Marketplace distribution.
