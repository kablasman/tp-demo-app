// ---------------------------------------------------------------------------
// TP Agent — Slack integration prototype
// ---------------------------------------------------------------------------
// Hybrid AI for human-in-the-loop CX workflows. Runs in Socket Mode.
//
// Surfaces:
//   • App Home        CX intelligence dashboard (KPIs, channels, alert cards)
//   • /fab-digest     Post or schedule a daily CX digest in a channel
//   • @mention / DM   Ask the assistant about CX metrics; swarm on an alert
// ---------------------------------------------------------------------------

require("dotenv").config();
const { App } = require("@slack/bolt");

const home = require("./listeners/home");
const mentions = require("./listeners/mentions");
const actions = require("./listeners/actions");
const digest = require("./listeners/digest");
const { assistant } = require("./listeners/assistant");

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
  port: process.env.PORT || 3000,
});

// ── Assistant container (native loading + streaming in the Messages tab) ─────
// Handles DMs/agent-thread messages. Channel @mentions are handled separately.
app.assistant(assistant);

// ── Register feature listeners ──────────────────────────────────────────────
home.register(app);
mentions.register(app);
actions.register(app);
digest.register(app);

// ── Start ────────────────────────────────────────────────────────────────────
(async () => {
  await app.start();
  console.log("");
  console.log("  ╔═══════════════════════════════════════════════════╗");
  console.log("  ║   ⚡️ TP Agent is running (Socket Mode)   ║");
  console.log("  ║                                                   ║");
  console.log("  ║   /fab-digest       Scheduled CX digest           ║");
  console.log("  ║   @mention / DM     Ask about CX metrics          ║");
  console.log("  ║   Home tab          CX intelligence dashboard     ║");
  console.log("  ║   Alert cards       Send / act on alerts          ║");
  console.log("  ╚═══════════════════════════════════════════════════╝");
  console.log("");
})();
