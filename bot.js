// ---------------------------------------------------------------------------
// Conversational bot — glue between raw Slack text and the scripted matcher
// ---------------------------------------------------------------------------
// The keyword matcher itself lives in data.answerQuestion(); this module strips
// the @mention, runs the matcher, and returns ready-to-post Block Kit blocks.
// ---------------------------------------------------------------------------

const data = require("./data");
const blocks = require("./blocks");
const { buildChartVizBlock } = require("./charts");

// Remove a leading/embedded bot mention like "<@U123ABC> ..." from the text.
function stripMention(text) {
  return (text || "").replace(/<@[^>]+>/g, "").trim();
}

// Given raw message text, return { blocks, text } to post as a reply.
// userId personalizes the fallback greeting with a real mention.
function reply(rawText, userId) {
  const clean = stripMention(rawText);
  const answer = data.answerQuestion(clean, userId);
  return {
    blocks: blocks.answerBlocks(answer),
    // Fallback/notification text (Block Kit won't auto-extract it).
    text: answer.text.replace(/[*_>]/g, ""),
  };
}

// Streaming variant: return the pieces separately so the caller can stream the
// text and append the chart afterward (charts can't be streamed).
//   { text, trailingBlocks }
function replyParts(rawText, userId) {
  const clean = stripMention(rawText);
  const answer = data.answerQuestion(clean, userId);
  const trailingBlocks = [];
  if (answer.chart) trailingBlocks.push(buildChartVizBlock(answer.chart));
  trailingBlocks.push({
    type: "context",
    elements: [{ type: "mrkdwn", text: "_Responses are AI-generated and may not always be accurate_" }],
  });
  return { text: answer.text, trailingBlocks };
}

module.exports = { stripMention, reply, replyParts };
