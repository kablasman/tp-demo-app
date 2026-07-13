// ---------------------------------------------------------------------------
// Streaming + loading-state helper for the conversational bot
// ---------------------------------------------------------------------------
// Slack's real token streaming (chat.startStream/appendStream/stopStream)
// requires the Agents & Assistants feature enabled on the app. When that's not
// available we emulate the experience: a held "loading" status, then the text
// revealed in a few smooth steps with a subtle typing indicator (no block
// cursor), then any chart blocks appended at the end.
//
// Set FAB_NATIVE_STREAM=1 to attempt the native streaming APIs instead.
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
  // ── Optional native streaming path (off by default) ───────────────────────
  if (process.env.FAB_NATIVE_STREAM === "1" && typeof client.chat.startStream === "function") {
    try {
      const started = await client.chat.startStream({
        channel,
        thread_ts,
        chunks: [{ type: "markdown_text", markdown_text: text }],
      });
      await client.chat.stopStream({ channel, message_ts: started.ts, thread_ts });
      if (trailingBlocks.length) {
        await client.chat.postMessage({ channel, thread_ts, blocks: trailingBlocks, text: "Details" });
      }
      return;
    } catch (err) {
      // Fall through to the emulated experience.
    }
  }

  // ── Loading indicator → hold 5s → post the full answer once ────────────────
  // When skipLoading is set, the caller already showed & held the native
  // assistant.threads.setStatus indicator, so post the answer immediately.
  // Otherwise (e.g. a channel @mention, where setStatus isn't available) show
  // our own loading block and hold 5s. Neither path does a chunked "typing"
  // reveal — the answer appears in one shot after the loading state.
  if (skipLoading) {
    await client.chat.postMessage({
      channel,
      thread_ts,
      text: plain(text),
      blocks: [{ type: "section", text: { type: "mrkdwn", text } }, ...trailingBlocks],
    });
    return;
  }

  const posted = await client.chat.postMessage({
    channel,
    thread_ts,
    text: "Analyzing CX intelligence…",
    blocks: [LOADING_BLOCK],
  });
  await sleep(LOADING_HOLD_MS);
  await client.chat.update({
    channel,
    ts: posted.ts,
    text: plain(text),
    blocks: [{ type: "section", text: { type: "mrkdwn", text } }, ...trailingBlocks],
  });
}

module.exports = { streamReply, revealSteps };
