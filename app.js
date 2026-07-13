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

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
  port: process.env.PORT || 3000,
});

// ── Assistant/agent container: suggested prompts on DM open ──────────────────
// We handle assistant_thread_started directly (rather than app.assistant(), whose
// message.im handler would double-reply with our own DM handler). The actual
// replies — with native setStatus loading + chat.*Stream streaming — are handled
// by the message.im listener in listeners/mentions.js.
app.event("assistant_thread_started", async ({ event, client, logger }) => {
  try {
    const { channel_id, thread_ts } = event.assistant_thread;
    await client.assistant.threads.setSuggestedPrompts({
      channel_id,
      thread_ts,
      title: "Try one of these:",
      prompts: [
        { title: "Overview", message: "give me an overview" },
        { title: "CSAT by channel", message: "CSAT by channel" },
        { title: "Collaboration mode breakdown", message: "collaboration mode breakdown" },
        { title: "What's driving the claims alert?", message: "what's driving the claims alert?" },
      ],
    });
  } catch (e) {
    logger.error("assistant_thread_started failed:", e.data ? e.data.error : e.message);
  }
});

// ── Register feature listeners ──────────────────────────────────────────────
// DMs (message.im) are handled in listeners/mentions.js with native loading +
// streaming — a single handler owns replies, so there are no duplicates.
home.register(app);
mentions.register(app);
actions.register(app);
digest.register(app);

// ── Start ────────────────────────────────────────────────────────────────────
(async () => {
  try {
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
  } catch (err) {
    // Surface the real reason in logs (e.g. bad/missing tokens) instead of a
    // bare stack trace, so Render logs make the failure obvious.
    console.error("[fatal] Slack connection failed — check SLACK_* env vars:", err.data && err.data.error ? err.data.error : err.message);
  }
})();

// Surface async failures in logs instead of silently crashing the process.
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason && reason.message ? reason.message : reason);
});
