// ---------------------------------------------------------------------------
// Streaming + loading-state helper for the conversational bot
// ---------------------------------------------------------------------------
// Slack's real token streaming (chat.startStream/appendStream/stopStream)
// requires the Agents & Assistants feature enabled on the app. When that's not
// available we emulate the experience: a held "loading" status, then the text
// revealed in a few smooth steps with a subtle typing indicator (no block
// cursor), then any chart blocks appended at the end.
//
// Native streaming (chat.startStream) is the default path when a thread_ts is
// present; the static/emulated reveal is only the fallback.
// https://docs.slack.dev/ai/developing-agents/
// ---------------------------------------------------------------------------

// Loading status shown while "analyzing", and the typing indicator shown
// beneath partial text while it streams.
const LOADING_BLOCK = {
  type: "context",
  elements: [{ type: "mrkdwn", text: ":hourglass_flowing_sand:  _Analyzing CX intelligence…_" }],
};
const TYPING_BLOCK = {
  type: "context",
  elements: [{ type: "mrkdwn", text: ":writing_hand:  _typing…_" }],
};

const LOADING_HOLD_MS = 5000; // keep the loading status visible for 5s
const STEP_MS = 300; // delay between reveal steps
const MAX_STEPS = 3; // total reveal steps (keeps it snappy, avoids rate limits)

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function plain(text) {
  return text.replace(/[*_>`]/g, "");
}

// Slack mrkdwn uses *single* asterisks for bold, but markdown_text (the
// streaming format) reads *single* as italic — promote to **double**.
function toMarkdown(text) {
  return text.replace(/\*([^*\n]+)\*/g, "**$1**");
}

// Break text into at most MAX_STEPS cumulative reveals, splitting on line
// boundaries so we never cut a word or a bullet in half.
function revealSteps(text) {
  const lines = text.split("\n");
  if (lines.length <= 1) return [text];
  const perStep = Math.ceil(lines.length / MAX_STEPS);
  const steps = [];
  for (let i = perStep; i < lines.length; i += perStep) {
    steps.push(lines.slice(0, i).join("\n"));
  }
  steps.push(text); // always finish with the full text
  return steps;
}

async function streamReply({ client, channel, thread_ts, text, trailingBlocks = [], skipLoading = false }) {
  // ── Native token streaming (the shimmer) — default path ───────────────────
  // Requires a thread_ts (startStream ties the stream to a thread).
  if (thread_ts && typeof client.chat.startStream === "function") {
    try {
      const md = toMarkdown(text);
      const chunks = md.split("\n\n").filter(Boolean).map((p, i) => (i ? "\n\n" : "") + p);
      const started = await client.chat.startStream({
        channel,
        thread_ts,
        chunks: [{ type: "markdown_text", markdown_text: chunks[0] }],
      });
      for (let i = 1; i < chunks.length; i++) {
        await client.chat.appendStream({
          channel,
          message_ts: started.ts,
          thread_ts,
          chunks: [{ type: "markdown_text", markdown_text: chunks[i] }],
        });
        await sleep(150);
      }
      // Blocks (chart/footer) are only allowed in stopStream.
      await client.chat.stopStream({
        channel,
        message_ts: started.ts,
        thread_ts,
        ...(trailingBlocks.length ? { blocks: trailingBlocks } : {}),
      });
      console.log("[stream] native streaming OK");
      return;
    } catch (err) {
      console.error("[stream] native streaming failed → fallback:", err && err.data ? err.data.error : err.message);
      // Fall through to the static/emulated path.
    }
  } else {
    console.log(`[stream] native streaming skipped (thread_ts=${!!thread_ts}, startStream=${typeof client.chat.startStream === "function"})`);
  }

  // ── 1. Loading status ─────────────────────────────────────────────────────
  // When skipLoading is set, the caller already showed a loading indicator
  // (e.g. assistant.threads.setStatus) and held it — go straight to the text.
  const posted = await client.chat.postMessage({
    channel,
    thread_ts,
    text: skipLoading ? plain(text) : "Analyzing CX intelligence…",
    blocks: skipLoading
      ? [{ type: "section", text: { type: "mrkdwn", text } }]
      : [LOADING_BLOCK],
  });
  const ts = posted.ts;

  // When the caller already showed & held a loading indicator (native
  // setStatus), the full text was posted above — don't reveal/stream again.
  if (!skipLoading) {
    await sleep(LOADING_HOLD_MS);

    // ── 2. Reveal the text in a few smooth steps (typing indicator below) ───
    const steps = revealSteps(text);
    for (let i = 0; i < steps.length; i++) {
      const isLast = i === steps.length - 1;
      await client.chat.update({
        channel,
        ts,
        text: plain(steps[i]),
        blocks: isLast
          ? [{ type: "section", text: { type: "mrkdwn", text: steps[i] } }]
          : [{ type: "section", text: { type: "mrkdwn", text: steps[i] } }, TYPING_BLOCK],
      });
      if (!isLast) await sleep(STEP_MS);
    }
  }

  // ── 3. Append chart / footer blocks to the finished message ───────────────
  if (trailingBlocks.length) {
    await client.chat.update({
      channel,
      ts,
      text: plain(text),
      blocks: [{ type: "section", text: { type: "mrkdwn", text } }, ...trailingBlocks],
    });
  }
}

module.exports = { streamReply, revealSteps };
