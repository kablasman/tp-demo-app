// ---------------------------------------------------------------------------
// Streaming + loading-state helper for the conversational bot
// ---------------------------------------------------------------------------
// Native-first, per https://docs.slack.dev/ai/developing-agents/#loading-state
//   • Loading:   assistant.threads.setStatus (shown by the caller / respondInThread)
//   • Streaming: chat.startStream → chat.appendStream* → chat.stopStream
//     Blocks (charts/footer) are only allowed in stopStream, so they go there.
// If the native streaming APIs aren't available (older SDK / feature off), we
// fall back to an emulated reveal (post + progressive chat.update).
// ---------------------------------------------------------------------------

const LOADING_BLOCK = {
  type: "context",
  elements: [{ type: "mrkdwn", text: ":hourglass_flowing_sand:  _Analyzing CX intelligence…_" }],
};
const TYPING_BLOCK = {
  type: "context",
  elements: [{ type: "mrkdwn", text: ":writing_hand:  _typing…_" }],
};

const LOADING_HOLD_MS = 5000; // emulated fallback: keep loading visible ~5s
const STEP_MS = 300; // emulated fallback: delay between reveal steps
const MAX_STEPS = 3;

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

// Break text into cumulative chunks (append deltas) on line/paragraph
// boundaries so words and bullets never split mid-token.
function streamChunks(text) {
  const paras = text.split("\n\n").filter((p) => p.length);
  if (paras.length > 1) return paras.map((p, i) => (i ? "\n\n" : "") + p);
  const lines = text.split("\n");
  if (lines.length > 1) return lines.map((l, i) => (i ? "\n" : "") + l);
  return [text];
}

// Break text into at most MAX_STEPS cumulative reveals (emulated fallback).
function revealSteps(text) {
  const lines = text.split("\n");
  if (lines.length <= 1) return [text];
  const perStep = Math.ceil(lines.length / MAX_STEPS);
  const steps = [];
  for (let i = perStep; i < lines.length; i += perStep) {
    steps.push(lines.slice(0, i).join("\n"));
  }
  steps.push(text);
  return steps;
}

// Native streaming via chat.startStream / appendStream / stopStream.
// Returns true on success, false if the APIs aren't available / failed.
async function nativeStream({ client, channel, thread_ts, text, trailingBlocks }) {
  if (typeof client.chat.startStream !== "function") {
    console.log("[stream] native APIs unavailable → emulated");
    return false;
  }
  if (!thread_ts) {
    console.log("[stream] no thread_ts → emulated (native streaming needs a thread)");
    return false;
  }
  const md = toMarkdown(text);
  const chunks = streamChunks(md);
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
      await sleep(120); // small gap so the append is visibly progressive
    }

    // Blocks are only allowed in stopStream — attach the chart/footer here.
    await client.chat.stopStream({
      channel,
      message_ts,
      thread_ts,
      ...(trailingBlocks && trailingBlocks.length ? { blocks: trailingBlocks } : {}),
    });
    console.log("[stream] native streaming OK");
    return true;
  } catch (err) {
    console.error("[stream] native streaming failed → emulated:", err && err.data ? err.data.error : err.message);
    return false;
  }
}

// Emulated fallback: post a loading message, then progressively edit it.
async function emulatedStream({ client, channel, thread_ts, text, trailingBlocks }) {
  const posted = await client.chat.postMessage({
    channel,
    thread_ts,
    text: "Analyzing CX intelligence…",
    blocks: [LOADING_BLOCK],
  });
  const ts = posted.ts;
  await sleep(LOADING_HOLD_MS);

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

  if (trailingBlocks && trailingBlocks.length) {
    await client.chat.update({
      channel,
      ts,
      text: plain(text),
      blocks: [{ type: "section", text: { type: "mrkdwn", text } }, ...trailingBlocks],
    });
  }
}

// Stream a reply: native streaming APIs first, emulated reveal as fallback.
async function streamReply({ client, channel, thread_ts, text, trailingBlocks = [] }) {
  const ok = await nativeStream({ client, channel, thread_ts, text, trailingBlocks });
  if (!ok) await emulatedStream({ client, channel, thread_ts, text, trailingBlocks });
}

module.exports = { streamReply, revealSteps };
