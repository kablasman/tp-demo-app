// ---------------------------------------------------------------------------
// Streaming + loading-state helper for the conversational bot
// ---------------------------------------------------------------------------
// The shimmer/loading animation comes from Slack's native token streaming:
// chat.startStream → chat.appendStream* → chat.stopStream. We use it as the
// primary path (that's what "shimmers"). Blocks (chart/footer) are only allowed
// in stopStream, so they go there. If native streaming isn't available or fails,
// we fall back to a static loading block held 5s, then post the answer once.
// https://docs.slack.dev/ai/developing-agents/
// ---------------------------------------------------------------------------

const LOADING_BLOCK = {
  type: "context",
  elements: [{ type: "mrkdwn", text: ":hourglass_flowing_sand:  _Analyzing CX intelligence…_" }],
};

const LOADING_HOLD_MS = 5000; // fallback: keep the static loading visible ~5s

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

// Cumulative append deltas on paragraph/line boundaries so the shimmer visibly
// progresses without splitting words or bullets.
function streamChunks(text) {
  const paras = text.split("\n\n").filter((p) => p.length);
  if (paras.length > 1) return paras.map((p, i) => (i ? "\n\n" : "") + p);
  const lines = text.split("\n");
  if (lines.length > 1) return lines.map((l, i) => (i ? "\n" : "") + l);
  return [text];
}

// Native streaming (the shimmer). Returns true on success, false to fall back.
async function nativeStream({ client, channel, thread_ts, text, trailingBlocks }) {
  if (typeof client.chat.startStream !== "function") {
    console.log("[stream] chat.startStream unavailable → static fallback");
    return false;
  }
  if (!thread_ts) {
    console.log("[stream] no thread_ts → static fallback (startStream needs a thread)");
    return false;
  }
  const chunks = streamChunks(toMarkdown(text));
  try {
    const started = await client.chat.startStream({
      channel,
      thread_ts,
      chunks: [{ type: "markdown_text", markdown_text: chunks[0] }],
    });
    const message_ts = started.ts;

    for (let i = 1; i < chunks.length; i++) {
      await client.chat.appendStream({
        channel,
        message_ts,
        thread_ts,
        chunks: [{ type: "markdown_text", markdown_text: chunks[i] }],
      });
      await sleep(150); // small gap so the shimmer visibly advances
    }

    // Blocks (chart/footer) are only allowed in stopStream.
    await client.chat.stopStream({
      channel,
      message_ts,
      thread_ts,
      ...(trailingBlocks && trailingBlocks.length ? { blocks: trailingBlocks } : {}),
    });
    console.log("[stream] native streaming OK");
    return true;
  } catch (err) {
    console.error("[stream] native streaming failed → static fallback:", err && err.data ? err.data.error : err.message);
    return false;
  }
}

// Static fallback: loading block held 5s, then the full answer posted once.
async function staticReply({ client, channel, thread_ts, text, trailingBlocks }) {
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
    blocks: [{ type: "section", text: { type: "mrkdwn", text } }, ...(trailingBlocks || [])],
  });
}

// Post a reply — native streaming (shimmer) first, static fallback otherwise.
async function streamReply({ client, channel, thread_ts, text, trailingBlocks = [] }) {
  const ok = await nativeStream({ client, channel, thread_ts, text, trailingBlocks });
  if (!ok) await staticReply({ client, channel, thread_ts, text, trailingBlocks });
}

module.exports = { streamReply };
