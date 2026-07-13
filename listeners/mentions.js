// ---------------------------------------------------------------------------
// Conversational bot — @mention, threaded follow-ups, and DMs
// ---------------------------------------------------------------------------
// Human → Agent surface:
//   • app_mention  — mention the bot in a channel or alert thread
//   • message (im) — direct messages in the Messages tab (no @mention needed)
//   • message (channel/group) — follow-up replies in a thread the bot is in
//     (detected via conversations.replies), so no re-mention is required.
// All paths share respondInThread(): 5s loading status + streamed reply + chart.
// ---------------------------------------------------------------------------

const bot = require("../bot");
const { streamReply } = require("../streaming");

// Post a reply into a thread with the native loading indicator (held 5s) and
// streamed text, falling back gracefully when setStatus isn't available.
async function respondInThread({ client, logger, channel, thread_ts, rawText, user }) {
  let statusShown = false;
  try {
    await client.assistant.threads.setStatus({
      channel_id: channel,
      thread_ts,
      status: "Analyzing CX intelligence…",
    });
    statusShown = true;
    await new Promise((resolve) => setTimeout(resolve, 5000));
  } catch (e) {
    logger.info("assistant.threads.setStatus unavailable, using fallback loader");
  }

  const { text, trailingBlocks } = bot.replyParts(rawText, user);
  await streamReply({ client, channel, thread_ts, text, trailingBlocks, skipLoading: statusShown });

  if (statusShown) {
    try {
      await client.assistant.threads.setStatus({ channel_id: channel, thread_ts, status: "" });
    } catch (e) {
      /* no-op */
    }
  }
}

// Has the bot already posted in this thread? (i.e. did it start/join the convo)
async function botIsInThread({ client, channel, thread_ts, botUserId }) {
  try {
    const res = await client.conversations.replies({ channel, ts: thread_ts, limit: 200 });
    return (res.messages || []).some((m) => m.bot_id || m.user === botUserId || m.app_id);
  } catch (e) {
    return false;
  }
}

function register(app) {
  // @mention in a channel or in an alert thread — starts a threaded conversation.
  app.event("app_mention", async ({ event, client, logger }) => {
    try {
      await respondInThread({
        client,
        logger,
        channel: event.channel,
        thread_ts: event.thread_ts || event.ts,
        rawText: event.text,
        user: event.user,
      });
    } catch (error) {
      logger.error("app_mention handler failed:", error);
    }
  });

  // Direct messages in the Messages tab — respond freely (no @mention needed),
  // mirroring the @mention streaming (loading status + streamed reveal + chart).
  app.event("message", async ({ event, client, logger }) => {
    console.log(`[dm] message.im received: channel_type=${event.channel_type} subtype=${event.subtype} bot_id=${event.bot_id} text=${JSON.stringify(event.text)}`);
    if (event.channel_type !== "im") return;
    if (event.subtype || event.bot_id) return; // ignore edits, bot posts, joins

    try {
      console.log("[dm] handling DM → responding");
      await respondInThread({
        client,
        logger,
        channel: event.channel,
        // Reply at the DM's top level (only thread if the user threaded).
        thread_ts: event.thread_ts,
        rawText: event.text,
        user: event.user,
      });
      console.log("[dm] response sent OK");
    } catch (error) {
      console.error("[dm] DM handler failed:", error && error.data ? error.data : error);
    }
  });

  // Follow-up replies in a thread the bot is part of — no @mention required.
  app.event("message", async ({ event, client, context, logger }) => {
    // Only channel/group thread replies from real users.
    if (event.channel_type !== "channel" && event.channel_type !== "group") return;
    if (event.subtype || event.bot_id) return;        // ignore edits, bot posts, joins
    if (!event.thread_ts || event.thread_ts === event.ts) return; // must be a reply in a thread
    if (event.text && event.text.includes(`<@${context.botUserId}>`)) return; // handled by app_mention

    try {
      const inThread = await botIsInThread({
        client,
        channel: event.channel,
        thread_ts: event.thread_ts,
        botUserId: context.botUserId,
      });
      if (!inThread) return; // not our conversation — stay quiet

      await respondInThread({
        client,
        logger,
        channel: event.channel,
        thread_ts: event.thread_ts,
        rawText: event.text,
        user: event.user,
      });
    } catch (error) {
      logger.error("thread follow-up handler failed:", error);
    }
  });
}

module.exports = { register };
