// ---------------------------------------------------------------------------
// Assistant (Agents & Assistants) container — native loading + text streaming
// ---------------------------------------------------------------------------
// Runs in the app's Messages/Assistant tab. Uses the real Slack agent APIs:
//   • setStatus  → native "thinking" loading indicator
//   • sayStream  → true token-style text streaming (startStream/appendStream/stopStream)
// Charts can't be streamed, so the chart image is posted after the stream.
// https://docs.slack.dev/ai/developing-agents/
// ---------------------------------------------------------------------------

const { Assistant } = require("@slack/bolt");
const bot = require("../bot");

const assistant = new Assistant({
  threadStarted: async ({ event, say, setSuggestedPrompts, saveThreadContext, logger }) => {
    try {
      await say(":wave: Hi! I'm TP Agent. Ask me about your CX intelligence.");
      await saveThreadContext();
      await setSuggestedPrompts({
        title: "Try one of these:",
        prompts: [
          { title: "Overview", message: "give me an overview" },
          { title: "CSAT by channel", message: "CSAT by channel" },
          { title: "Collaboration mode breakdown", message: "collaboration mode breakdown" },
          { title: "What's driving the claims alert?", message: "what's driving the claims alert?" },
        ],
      });
    } catch (e) {
      logger.error("assistant threadStarted failed:", e);
    }
  },

  userMessage: async ({ message, client, say, setTitle, setStatus, sayStream, logger }) => {
    if (!("text" in message) || !message.text) return;
    const { channel, thread_ts } = message;

    try {
      await setTitle(message.text);
      // Native loading indicator — held for 5s before the response streams.
      await setStatus({
        status: "Analyzing CX intelligence…",
        loading_messages: [
          "Pulling omnichannel metrics…",
          "Checking predictive SLA signals…",
          "Summarizing conversation intelligence…",
        ],
      });
      await new Promise((resolve) => setTimeout(resolve, 5000));

      const { text, trailingBlocks } = bot.replyParts(message.text, message.user);
      // Slack mrkdwn uses *single* asterisks for bold, but markdown_text (the
      // streaming format) reads *single* as italic — promote to **double**.
      const md = text.replace(/\*([^*\n]+)\*/g, "**$1**");

      // Stream the text if sayStream is available; otherwise fall back to say().
      console.log("[assistant] sayStream is", typeof sayStream);
      if (typeof sayStream === "function") {
        try {
          const stream = sayStream();
          const parts = md.split("\n\n");
          if (parts.length > 1) {
            for (let i = 0; i < parts.length; i++) {
              await stream.append({ markdown_text: (i ? "\n\n" : "") + parts[i] });
            }
          } else {
            await stream.append({ markdown_text: md });
          }
          await stream.stop();
          console.log("[assistant] sayStream OK");
        } catch (streamErr) {
          console.error("[assistant] sayStream FAILED:", streamErr && streamErr.data ? JSON.stringify(streamErr.data) : streamErr.message);
          // Fall back to a plain posted message so the user still gets a reply.
          await say({ text: text.replace(/[*_>]/g, ""), blocks: [{ type: "section", text: { type: "mrkdwn", text } }] });
        }
      } else {
        console.log("[assistant] sayStream unavailable → say()");
        await say({ text: text.replace(/[*_>]/g, ""), blocks: [{ type: "section", text: { type: "mrkdwn", text } }] });
      }

      // Charts/footer can't be streamed — post them after the stream finishes.
      if (trailingBlocks && trailingBlocks.length) {
        await client.chat.postMessage({ channel, thread_ts, blocks: trailingBlocks, text: "Details" });
      }
    } catch (e) {
      logger.error("assistant userMessage failed:", e);
      await setStatus({ status: "" });
      await say("Sorry — I hit an error pulling that up. Please try again.");
    }
  },
});

module.exports = { assistant };
