// ---------------------------------------------------------------------------
// Block Kit builders for TP Agent
// ---------------------------------------------------------------------------
// Mirrors the pattern from the Headspace app: a brandHeader() plus one builder
// per surface (Home tab, alert message, bot answer, Add Agent modal).
// ---------------------------------------------------------------------------

const data = require("./data");
const { buildChartVizBlock } = require("./charts");

const SEVERITY_EMOJI = {
  Critical: ":red_circle:",
  High: ":large_orange_circle:",
  Medium: ":large_yellow_circle:",
  Low: ":large_green_circle:",
};

const SLA_RISK_EMOJI = { High: ":red_circle:", Medium: ":large_yellow_circle:", Low: ":large_green_circle:" };

// ── Brand header used across all surfaces ──────────────────────────────────
function brandHeader(title) {
  return [
    { type: "header", text: { type: "plain_text", text: `TP Agent  |  ${title}`, emoji: true } },
    { type: "divider" },
  ];
}

// ── Channel performance as a native data_table block ────────────────────────
// https://docs.slack.dev/reference/block-kit/blocks/data-table-block/
// Header row uses raw_text; raw_number cells carry both `value` and `text`.
function txt(t) { return { type: "raw_text", text: String(t) }; }
function num(value, text) { return { type: "raw_number", value, text: text !== undefined ? text : String(value) }; }

function channelTable() {
  const header = ["Channel", "Volume", "CSAT", "AHT (m)", "Containment", "Sentiment"].map(txt);
  const rows = data.getChannelMetrics().map((c) => [
    txt(c.name),
    num(c.volume, c.volume.toLocaleString()),
    num(c.csat, `${c.csat}%`),
    num(c.aht, `${c.aht}m`),
    num(c.containment, `${c.containment}%`),
    num(c.sentiment, `${c.sentiment}/100`),
  ]);
  return {
    type: "data_table",
    caption: "Channel performance",
    page_size: data.getChannelMetrics().length, // show all channels, no pagination
    rows: [header, ...rows],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// APP HOME — CX intelligence dashboard
// ═══════════════════════════════════════════════════════════════════════════
function homeTab(userId) {
  // Active alerts render as a carousel of cards.
  const alertCarousel = {
    type: "carousel",
    elements: data.alerts.map((a) => {
      const j = data.getJourney(a.journeyId);
      return {
        type: "card",
        block_id: `alert_card_${a.id}`,
        title: { type: "mrkdwn", text: `${SEVERITY_EMOJI[a.severity]}  *${a.title}*`, verbatim: false },
        subtitle: { type: "mrkdwn", text: `\n${a.signal}`, verbatim: false },
        body: { type: "mrkdwn", text: `*Journey:* ${j.name} (${j.vertical})\n*Flow:* ${j.collabMode}`, verbatim: false },
        actions: [
          {
            type: "button",
            text: { type: "plain_text", text: "View", emoji: false },
            action_id: `home_view_alert_${a.id}`,
          },
          {
            type: "button",
            text: { type: "plain_text", text: "Send to channel", emoji: false },
            style: "primary",
            action_id: `home_send_alert_${a.id}`,
          },
        ],
      };
    }),
  };

  return {
    type: "home",
    blocks: [
      { type: "header", text: { type: "plain_text", text: ":chart_with_downwards_trend: TP Intelligence Dashboard", emoji: true }, level: 1 },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `:wave: Hi <@${userId}>, see your live operations picture below!`,
        },
      },
      // KPI strip
      { type: "header", text: { type: "plain_text", text: "Today at a glance", emoji: true }, level: 2 },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Total interactions*\n${data.totalVolume().toLocaleString()}` },
          { type: "mrkdwn", text: `*Avg CSAT*\n${data.avgCsat()}%` },
        ],
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Open alerts* \n${data.openAlertCount()}` },
          { type: "mrkdwn", text: `*High SLA risk journeys* :warning:\n${data.highSlaRiskJourneys().length}` },
        ],
      },
      { type: "divider" },
      channelTable(),
      { type: "header", text: { type: "plain_text", text: "Active alerts", emoji: true }, level: 2 },
      alertCarousel,
      { type: "context", elements: [{ type: "mrkdwn", text: "_Hybrid AI for human-in-the-loop workflows_" }] },
    ],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ALERT / NOTIFICATION message (intervention)
// ═══════════════════════════════════════════════════════════════════════════
function alertBlocks(alert, botUserId) {
  const j = data.getJourney(alert.journeyId);
  // Native data_visualization block. Two series (metric + threshold) render in
  // two distinct colors; Slack assigns series colors automatically.
  const chartBlock = buildChartVizBlock(data.alertChartSpec(alert));
  const mention = botUserId ? `<@${botUserId}>` : "@TP Agent";

  return [
    { type: "header", text: { type: "plain_text", text: `${alert.severity} Alert: ${j.name}`, emoji: true } },
    {
      type: "context",
      elements: [
        { type: "mrkdwn", text: `${SEVERITY_EMOJI[alert.severity]} *${alert.severity}*` },
        { type: "mrkdwn", text: `:mag: ${alert.signal}` },
        { type: "mrkdwn", text: `:handshake: ${j.collabMode}` },
        { type: "mrkdwn", text: `${data.verticalEmoji(j.vertical)} ${j.vertical}` },
      ],
    },
    // Title links out to the alert's item in the TP web app.
    { type: "section", text: { type: "mrkdwn", text: `*<${data.alertDashboardUrl(alert)}|${alert.title}>*\n\n${alert.summary}` } },
    chartBlock,
    { type: "section", text: { type: "mrkdwn", text: "*Suggested actions*" } },
    {
      type: "actions",
      block_id: `alert_actions_${alert.id}`,
      elements: alert.actions.map((a) => {
        const el = {
          type: "button",
          text: { type: "plain_text", text: a.label, emoji: true },
          action_id: a.id,
          value: alert.id,
        };
        if (a.style) el.style = a.style;
        return el;
      }),
    },
    { type: "context", elements: [{ type: "mrkdwn", text: `_Reply in thread to swarm and ${mention} for a deep-dive_` }] },
  ];
}

// ── Result shown after a suggested action is taken (replaces actions block) ──
function alertResolvedBlocks(alert, actionLabel, userId) {
  const j = data.getJourney(alert.journeyId);
  return [
    { type: "header", text: { type: "plain_text", text: `${alert.severity} Alert: ${j.name}`, emoji: true } },
    {
      type: "context",
      elements: [
        { type: "mrkdwn", text: `${SEVERITY_EMOJI[alert.severity]} *${alert.severity}*` },
        { type: "mrkdwn", text: `:mag: ${alert.signal}` },
        { type: "mrkdwn", text: `:handshake: ${j.collabMode}` },
      ],
    },
    { type: "section", text: { type: "mrkdwn", text: `*${alert.title}*\n\n${alert.summary}` } },
    { type: "divider" },
    { type: "section", text: { type: "mrkdwn", text: `:white_check_mark: *${actionLabel}* by <@${userId}>` } },
    { type: "context", elements: [{ type: "mrkdwn", text: "_Action logged in TP dashboard_" }] },
  ];
}

// ═══════════════════════════════════════════════════════════════════════════
// DAILY DIGEST — proactive summary pushed to a channel
// ═══════════════════════════════════════════════════════════════════════════
function digestBlocks() {
  const highRisk = data.highSlaRiskJourneys();

  // Each alert gets its own section (title + muted metadata line) so they're
  // clearly spaced apart rather than crammed into one block.
  const alertBlocksList = [];
  data.alerts.forEach((a) => {
    const j = data.getJourney(a.journeyId);
    alertBlocksList.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${SEVERITY_EMOJI[a.severity]}  *<${data.alertDashboardUrl(a)}|${a.title}>*\n_${a.signal}  ·  ${j.name} (${j.vertical})_`,
      },
    });
  });

  return [
    { type: "header", text: { type: "plain_text", text: ":bell: Daily CX Digest", emoji: true }, level: 2 },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Total interactions*\n${data.totalVolume().toLocaleString()}` },
        { type: "mrkdwn", text: `*Avg CSAT*\n${data.avgCsat()}%` },
      ],
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Open alerts*\n${data.openAlertCount()}` },
        { type: "mrkdwn", text: `*High SLA risk journeys* :warning:\n${highRisk.length}` },
      ],
    },
    { type: "divider" },
    { type: "header", text: { type: "plain_text", text: "Active alerts", emoji: true }, level: 3 },
    ...alertBlocksList,
    {
      type: "actions",
      elements: [
        { type: "button", text: { type: "plain_text", text: "Open dashboard", emoji: true }, action_id: "digest_open_home" },
      ],
    },
    { type: "context", elements: [{ type: "mrkdwn", text: "_Automated digest powered by TP_" }] },
  ];
}

// ═══════════════════════════════════════════════════════════════════════════
// BOT ANSWER blocks (from scripted matcher)
// ═══════════════════════════════════════════════════════════════════════════
function answerBlocks(answer) {
  const blocks = [{ type: "section", text: { type: "mrkdwn", text: answer.text } }];
  if (answer.chart) {
    blocks.push(buildChartVizBlock(answer.chart));
  }
  blocks.push({ type: "context", elements: [{ type: "mrkdwn", text: "_Responses are AI-generated and may not always be accurate_" }] });
  return blocks;
}

// ── Channel picker modal — send an alert notification to a channel ──────────
function sendAlertModal(alert) {
  const j = data.getJourney(alert.journeyId);
  return {
    type: "modal",
    callback_id: "send_alert_submit",
    private_metadata: alert.id, // remember which alert to send
    title: { type: "plain_text", text: "Send alert" },
    submit: { type: "plain_text", text: "Send" },
    close: { type: "plain_text", text: "Cancel" },
    blocks: [
      { type: "section", text: { type: "mrkdwn", text: "You're about to post this alert to a channel:" } },
      {
        type: "section",
        text: { type: "mrkdwn", text: `${SEVERITY_EMOJI[alert.severity]}  *${alert.title}*` },
      },
      {
        type: "context",
        elements: [
          { type: "mrkdwn", text: `:mag: ${alert.signal}` },
          { type: "mrkdwn", text: `${data.verticalEmoji(j.vertical)} ${j.name} (${j.vertical})` },
        ],
      },
      { type: "divider" },
      {
        type: "input",
        block_id: "send_channel",
        label: { type: "plain_text", text: "Channel" },
        element: { type: "channels_select", action_id: "send_channel_select", placeholder: { type: "plain_text", text: "Select a public channel" } },
      },
      {
        type: "input",
        block_id: "send_note",
        optional: true,
        label: { type: "plain_text", text: "Add a note" },
        element: { type: "rich_text_input", action_id: "send_note_input", placeholder: { type: "plain_text", text: "e.g. @here please swarm this" } },
      },
    ],
  };
}

module.exports = {
  brandHeader,
  homeTab,
  channelTable,
  alertBlocks,
  alertResolvedBlocks,
  answerBlocks,
  digestBlocks,
  sendAlertModal,
  SEVERITY_EMOJI,
  SLA_RISK_EMOJI,
};
