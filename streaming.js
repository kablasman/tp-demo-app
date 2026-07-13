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
// present; the emulated reveal is the fallback if it fails.
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

async function streamReply({
  client,
  channel,
  thread_ts,
  text,
  trailingBlocks = [],
  skipLoading = false,
  recipientUserId,
  recipientTeamId,
}) {
  // ── Native token streaming (chat.startStream/appendStream/stopStream) ──────
  // Requires a thread_ts. Streaming into a *channel* also requires
  // recipient_user_id + recipient_team_id — and on Enterprise Grid the team id
  // must be the specific workspace (event.team / context.teamId), not the org.
  if (thread_ts && typeof client.chat.startStream === "function") {
    try {
      // markdown_text uses **double** asterisks for bold (single = italic).
      const md = text.replace(/\*([^*\n]+)\*/g, "**$1**");
      const parts = md.split("\n\n").filter(Boolean).map((p, i) => (i ? "\n\n" : "") + p);

      const started = await client.chat.startStream({
        channel,
        thread_ts,
        ...(recipientUserId ? { recipient_user_id: recipientUserId } : {}),
        ...(recipientTeamId ? { recipient_team_id: recipientTeamId } : {}),
        markdown_text: parts[0],
      });
      for (let i = 1; i < parts.length; i++) {
        await client.chat.appendStream({ channel, message_ts: started.ts, thread_ts, markdown_text: parts[i] });
        await sleep(120);
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
      console.error("[stream] native streaming failed → fallback:", err && err.data ? JSON.stringify(err.data) : err.message);
      // Fall through to the emulated reveal.
    }
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
