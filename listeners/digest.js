// ---------------------------------------------------------------------------
// Scheduled digest — proactively push a daily CX summary to a channel
// ---------------------------------------------------------------------------
// Demonstrates Slack as a real notification channel (vs. the manual /fab-alert).
//   /fab-digest now              → post the digest to this channel immediately
//   /fab-digest on [minutes]     → auto-post here every N minutes (default 60)
//   /fab-digest off              → stop the schedule for this channel
//   /fab-digest                  → show status + usage
//
// A production build would use a real cron (e.g. a 9am daily job) and persist
// subscriptions; here we keep an in-memory interval so it's demoable live.
// ---------------------------------------------------------------------------

const blocks = require("../blocks");

// channelId -> { timer, minutes }
const schedules = new Map();

async function postDigest(client, channel) {
  await client.chat.postMessage({
    channel,
    blocks: blocks.digestBlocks(),
    text: "Daily CX Digest",
  });
}

function register(app) {
  app.command("/fab-digest", async ({ command, ack, respond, client, logger }) => {
    await ack();
    const args = (command.text || "").trim().toLowerCase().split(/\s+/).filter(Boolean);
    const sub = args[0] || "";
    const channel = command.channel_id;

    try {
      if (sub === "now") {
        await postDigest(client, channel);
        return;
      }

      if (sub === "on") {
        const minutes = Math.max(1, parseInt(args[1], 10) || 60);
        // Clear any existing schedule for this channel first.
        if (schedules.has(channel)) clearInterval(schedules.get(channel).timer);
        const timer = setInterval(() => {
          postDigest(client, channel).catch((e) => logger.error("digest post failed:", e));
        }, minutes * 60 * 1000);
        schedules.set(channel, { timer, minutes });

        await postDigest(client, channel); // send one immediately so it's visible
        await respond({
          response_type: "ephemeral",
          text: `:white_check_mark: Daily digest scheduled here every *${minutes} min*. Turn it off with \`/fab-digest off\`.`,
        });
        return;
      }

      if (sub === "off") {
        if (schedules.has(channel)) {
          clearInterval(schedules.get(channel).timer);
          schedules.delete(channel);
          await respond({ response_type: "ephemeral", text: ":octagonal_sign: Digest schedule stopped for this channel." });
        } else {
          await respond({ response_type: "ephemeral", text: "No digest is scheduled in this channel." });
        }
        return;
      }

      // No/unknown subcommand → status + usage.
      const active = schedules.has(channel) ? `on (every ${schedules.get(channel).minutes} min)` : "off";
      await respond({
        response_type: "ephemeral",
        text:
          "*Daily CX Digest*\n" +
          `Status in this channel: *${active}*\n\n` +
          "`/fab-digest now` — post the digest now\n" +
          "`/fab-digest on [minutes]` — schedule it here (default 60)\n" +
          "`/fab-digest off` — stop the schedule",
      });
    } catch (error) {
      logger.error("/fab-digest failed:", error);
      await respond({ response_type: "ephemeral", text: ":warning: Couldn't run that — make sure I'm a member of this channel (`/invite @TP Agent`)." });
    }
  });

  // "Open dashboard" button on the digest → nudge the user to the Home tab.
  app.action("digest_open_home", async ({ ack, body, client, logger }) => {
    await ack();
    try {
      await client.chat.postEphemeral({
        channel: body.channel.id,
        user: body.user.id,
        text: ":bar_chart: Open the *TP Agent* app from the sidebar and check the *Home* tab for your live dashboard.",
      });
    } catch (error) {
      logger.error("digest_open_home failed:", error);
    }
  });
}

module.exports = { register };
