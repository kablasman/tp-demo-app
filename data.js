// ---------------------------------------------------------------------------
// TP Agent — mock CX intelligence dataset
// ---------------------------------------------------------------------------
// Deterministic fake data modeled on the TP.ai FAB deck: omnichannel
// interactions, Interaction Journeys with Collaboration Modes, Conversation
// Intelligence signals, Alerts/Notifications (anomaly + Predictive SLA), and a
// roster of custom AI agents. No randomness — safe for live demos.
// ---------------------------------------------------------------------------

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ── Collaboration Modes (exact terms from the deck) ─────────────────────────
const COLLAB_MODES = {
  AGENT_AGENT: "Agent → Agent",
  AGENT_HUMAN: "Agent → Human",
  HUMAN_AGENT: "Human → Agent",
};

// ── Omnichannel channels ────────────────────────────────────────────────────
// volume = interactions today; csat 0-100; aht = avg handle time (min);
// containment = % resolved without human; sentiment 0-100;
// trend = this week's 7-day volume; lastWeek = prior week for comparison.
const channels = [
  { key: "voice", name: "Voice", emoji: "telephone_receiver", volume: 4820, csat: 88, aht: 7.4, containment: 41, sentiment: 79, trend: [4300, 4510, 4680, 4590, 4820, 3110, 2740], lastWeek: [4100, 4180, 4260, 4310, 4400, 2980, 2610] },
  { key: "chat", name: "Chat", emoji: "speech_balloon", volume: 9130, csat: 91, aht: 3.1, containment: 68, sentiment: 82, trend: [8200, 8460, 8790, 8610, 9130, 6050, 5320], lastWeek: [7700, 7850, 8020, 8110, 8300, 5600, 4900] },
  { key: "email", name: "Email", emoji: "email", volume: 3670, csat: 85, aht: 12.6, containment: 33, sentiment: 74, trend: [3520, 3580, 3610, 3640, 3670, 2100, 1780], lastWeek: [3480, 3510, 3530, 3560, 3590, 2050, 1720] },
  { key: "sms", name: "SMS", emoji: "iphone", volume: 2110, csat: 87, aht: 2.4, containment: 72, sentiment: 80, trend: [1950, 2010, 2040, 2080, 2110, 1440, 1220], lastWeek: [1780, 1820, 1860, 1900, 1940, 1310, 1120] },
  { key: "social", name: "Social", emoji: "globe_with_meridians", volume: 1580, csat: 82, aht: 5.9, containment: 55, sentiment: 71, trend: [1490, 1520, 1610, 1560, 1580, 1180, 990], lastWeek: [1360, 1400, 1450, 1470, 1500, 1090, 920] },
];

// ── Interaction Journeys ────────────────────────────────────────────────────
const journeys = [
  {
    id: "claims",
    name: "Claims Intake",
    vertical: "Insurance",
    collabMode: COLLAB_MODES.AGENT_HUMAN,
    channels: ["chat", "voice", "email"],
    csat: 83,
    slaRisk: "High",
    summary: "First-notice-of-loss capture and triage across chat, voice, and email.",
  },
  {
    id: "billing",
    name: "Billing Dispute",
    vertical: "Banking",
    collabMode: COLLAB_MODES.HUMAN_AGENT,
    channels: ["voice", "chat"],
    csat: 86,
    slaRisk: "Medium",
    summary: "Transaction disputes and adjustments with human-in-the-loop review.",
  },
  {
    id: "onboarding",
    name: "Onboarding",
    vertical: "Retail",
    collabMode: COLLAB_MODES.AGENT_AGENT,
    channels: ["chat", "sms", "email"],
    csat: 90,
    slaRisk: "Low",
    summary: "New-customer activation and KYC verification, largely autonomous.",
  },
  {
    id: "cancellation",
    name: "Cancellation Save",
    vertical: "Travel",
    collabMode: COLLAB_MODES.AGENT_HUMAN,
    channels: ["voice", "chat", "social"],
    csat: 78,
    slaRisk: "High",
    summary: "Retention flow that hands high-value at-risk customers to senior CE.",
  },
  {
    id: "ordertracking",
    name: "Order Tracking",
    vertical: "Retail",
    collabMode: COLLAB_MODES.AGENT_AGENT,
    channels: ["chat", "sms"],
    csat: 92,
    slaRisk: "Low",
    summary: "Where's-my-order status lookups, handled almost entirely by AI.",
  },
];

// ── Conversation Intelligence signal types ─────────────────────────────────
const SIGNALS = {
  SLA: "Predictive SLA Tracking",
  ANOMALY: "Anomaly Detection",
  SENTIMENT: "Sentiment Analysis",
  SCORING: "Predictive Scoring",
};

// Distinct chart color per notification (signal) type.
const SIGNAL_COLORS = {
  [SIGNALS.SLA]: "rgb(124, 58, 237)", // violet
  [SIGNALS.ANOMALY]: "rgb(234, 88, 12)", // orange
  [SIGNALS.SENTIMENT]: "rgb(219, 39, 119)", // pink
  [SIGNALS.SCORING]: "rgb(13, 148, 136)", // teal
};

// Industry-specific emoji per vertical (for notification metadata rows).
const VERTICAL_EMOJI = {
  Banking: ":bank:",
  Insurance: ":shield:",
  Healthcare: ":hospital:",
  Retail: ":shopping_trolley:",
  Travel: ":airplane:",
};
function verticalEmoji(vertical) {
  return VERTICAL_EMOJI[vertical] || ":office:";
}

// Deep link to the alert's item in the TP web app (example domain for the demo).
const TP_BASE_URL = "https://app.tp.example.com";
function alertDashboardUrl(alert) {
  return `${TP_BASE_URL}/cx/alerts/${alert.id}`;
}

// ── Alerts / Notifications (interventions) ──────────────────────────────────
// Each alert anchors the in-thread "swarm" (Human-In-The-Loop) flow.
const alerts = [
  {
    id: "claims",
    severity: "Critical",
    journeyId: "claims",
    signal: SIGNALS.SLA,
    metricLabel: "Chat abandonment rate",
    title: "Predictive SLA breach risk on Claims Intake",
    summary:
      "Chat abandonment on the *Claims Intake* journey is up *34%* in the last 2 hours. TP Orchestrator predicts an SLA breach within *45 min* at the current arrival rate. Sentiment on abandoned chats is trending negative.",
    metricUnit: "%",
    series: [8, 9, 8, 11, 14, 19, 26],
    seriesLabels: ["12p", "1p", "2p", "3p", "4p", "5p", "now"],
    threshold: 15,
    thresholdLabel: "SLA threshold",
    actions: [
      { id: "alert_reroute", label: "Re-route to CE", style: "primary" },
      { id: "alert_deploy_macro", label: "Deploy macro" },
      { id: "alert_escalate_hitl", label: "Escalate to human" },
      { id: "alert_dismiss", label: "Dismiss", style: "danger" },
    ],
  },
  {
    id: "billing",
    severity: "High",
    journeyId: "billing",
    signal: SIGNALS.ANOMALY,
    metricLabel: "Repeat-contact rate",
    title: "Anomaly detected on Billing Dispute",
    summary:
      "Repeat-contact rate on *Billing Dispute* spiked to *2.3x* baseline this afternoon, concentrated on voice. Likely a knowledge-base gap after the new fee schedule. Recommend deploying an Assist macro and flagging for content review.",
    metricUnit: "x",
    series: [1.0, 1.1, 1.0, 1.2, 1.6, 2.0, 2.3],
    seriesLabels: ["12p", "1p", "2p", "3p", "4p", "5p", "now"],
    threshold: 1.5,
    thresholdLabel: "Anomaly threshold",
    actions: [
      { id: "alert_deploy_macro", label: "Deploy macro", style: "primary" },
      { id: "alert_reroute", label: "Re-route to CE" },
      { id: "alert_dismiss", label: "Dismiss", style: "danger" },
    ],
  },
  {
    id: "cancellation",
    severity: "High",
    journeyId: "cancellation",
    signal: SIGNALS.SENTIMENT,
    metricLabel: "Negative sentiment share",
    title: "Sentiment drop on Cancellation Save",
    summary:
      "Negative-sentiment share on *Cancellation Save* rose to *31%* over the last hour, with high-value customers over-represented. Predictive Scoring flags elevated churn risk. Recommend escalating at-risk sessions to Human-In-The-Loop.",
    metricUnit: "%",
    series: [12, 14, 15, 18, 22, 27, 31],
    seriesLabels: ["12p", "1p", "2p", "3p", "4p", "5p", "now"],
    threshold: 20,
    thresholdLabel: "Churn-risk threshold",
    actions: [
      { id: "alert_escalate_hitl", label: "Escalate to human", style: "primary" },
      { id: "alert_reroute", label: "Re-route to CE" },
      { id: "alert_dismiss", label: "Dismiss", style: "danger" },
    ],
  },
  {
    id: "onboarding",
    severity: "Medium",
    journeyId: "onboarding",
    signal: SIGNALS.SCORING,
    metricLabel: "Verification drop-off",
    title: "Verification drop-off on Onboarding",
    summary:
      "Verification drop-off on the *Onboarding* journey is *up 12%* week-over-week, mostly at the ID-upload step on mobile. Not yet SLA-impacting — recommend an Assist macro to nudge stalled users.",
    metricUnit: "%",
    series: [6, 7, 7, 8, 9, 10, 11],
    seriesLabels: ["12p", "1p", "2p", "3p", "4p", "5p", "now"],
    threshold: 12,
    thresholdLabel: "Watch threshold",
    actions: [
      { id: "alert_deploy_macro", label: "Deploy macro", style: "primary" },
      { id: "alert_dismiss", label: "Dismiss", style: "danger" },
    ],
  },
  {
    id: "ordertracking",
    severity: "Low",
    journeyId: "ordertracking",
    signal: SIGNALS.ANOMALY,
    metricLabel: "Deflection rate",
    title: "Minor deflection dip on Order Tracking",
    summary:
      "Self-service deflection on *Order Tracking* eased *2 points* to 90% this afternoon — well within normal range. Sharing for visibility; no action needed.",
    metricUnit: "%",
    series: [93, 93, 92, 92, 91, 91, 90],
    seriesLabels: ["12p", "1p", "2p", "3p", "4p", "5p", "now"],
    threshold: 85,
    thresholdLabel: "Target floor",
    actions: [
      { id: "alert_dismiss", label: "Dismiss", style: "danger" },
    ],
  },
];

// ── Agent roster (custom AI agents) ─────────────────────────────────────────
const SKILL_LEVELS = ["Basic", "Standard", "Advanced"];

const roster = [
  { name: "Aria", skill: "Advanced", collabMode: COLLAB_MODES.AGENT_HUMAN, channels: ["Voice", "Chat"] },
  { name: "Milo", skill: "Standard", collabMode: COLLAB_MODES.AGENT_AGENT, channels: ["Chat", "Email"] },
  { name: "Nova", skill: "Advanced", collabMode: COLLAB_MODES.HUMAN_AGENT, channels: ["Voice", "Chat", "Social"] },
];

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

function getChannel(key) {
  return channels.find((c) => c.key === key);
}

function getChannelMetrics() {
  return channels;
}

function getJourney(id) {
  return journeys.find((j) => j.id === id);
}

function getAlert(id) {
  return alerts.find((a) => a.id === id);
}

function totalVolume() {
  return channels.reduce((sum, c) => sum + c.volume, 0);
}

function avgCsat() {
  return Math.round(channels.reduce((sum, c) => sum + c.csat, 0) / channels.length);
}

function openAlertCount() {
  return alerts.length;
}

function highSlaRiskJourneys() {
  return journeys.filter((j) => j.slaRisk === "High");
}

// Format a volume series with day labels for the last 7 days.
function volumeTrendTotals() {
  const totals = DAY_LABELS.map((_, i) =>
    channels.reduce((sum, c) => sum + (c.trend[i] || 0), 0)
  );
  return { labels: DAY_LABELS, values: totals };
}

// Count of active journeys per Collaboration Mode → { labels, values } for a pie.
function collabModeMix() {
  const order = [COLLAB_MODES.AGENT_AGENT, COLLAB_MODES.AGENT_HUMAN, COLLAB_MODES.HUMAN_AGENT];
  const counts = order.map((mode) => journeys.filter((j) => j.collabMode === mode).length);
  // Drop modes with zero journeys so the pie stays clean.
  const labels = [];
  const values = [];
  order.forEach((mode, i) => {
    if (counts[i] > 0) {
      labels.push(mode);
      values.push(counts[i]);
    }
  });
  return { labels, values };
}

// Week-over-week volume change for a channel, as a signed % string.
function weekOverWeekPct(channel) {
  const thisSum = channel.trend.reduce((a, b) => a + b, 0);
  const lastSum = channel.lastWeek.reduce((a, b) => a + b, 0);
  const pct = Math.round(((thisSum - lastSum) / lastSum) * 100);
  return `${pct >= 0 ? "+" : ""}${pct}% WoW`;
}

// Chart spec for an alert: a two-series line (the metric trend + a flat
// threshold baseline). Two series → the native data_visualization block renders
// them in two distinct colors (Slack assigns the palette automatically).
function alertChartSpec(alert) {
  const datasets = [{ label: alert.metricLabel, values: alert.series }];
  if (alert.threshold !== undefined) {
    datasets.push({
      label: alert.thresholdLabel || "Threshold",
      values: alert.seriesLabels.map(() => alert.threshold),
    });
  }
  return { type: "line", label: alert.metricLabel, labels: alert.seriesLabels, unit: alert.metricUnit, datasets, showLegend: true };
}

// ---------------------------------------------------------------------------
// Scripted natural-language matcher for the conversational bot.
// Returns { text, channel?, journey?, chart } describing what to answer.
// chart: { type: 'line'|'bar', ... } | null — lets the caller build an image.
// ---------------------------------------------------------------------------
function answerQuestion(rawText, userId) {
  const text = (rawText || "").toLowerCase();

  // Alert deep-dives: "what's driving this / the billing alert"
  const alertMatch = alerts.find((a) => text.includes(a.id) || text.includes(getJourney(a.journeyId).name.toLowerCase()));
  if ((text.includes("driv") || text.includes("why") || text.includes("cause") || text.includes("root")) && alertMatch) {
    const j = getJourney(alertMatch.journeyId);
    return {
      kind: "alert_explain",
      text:
        `*${alertMatch.title}*\n\n${alertMatch.summary}\n\n` +
        `*Signal:* ${alertMatch.signal}\n*Journey:* ${j.name} (${j.vertical})\n*Collaboration Mode:* ${j.collabMode}`,
      chart: alertChartSpec(alertMatch),
    };
  }

  // Collaboration Mode breakdown (pie): "collaboration mode breakdown"
  if (text.includes("collaboration") || text.includes("collab mode") || (text.includes("mode") && text.includes("break"))) {
    const mix = collabModeMix();
    return {
      kind: "collab_mix",
      text: "Here's how active Interaction Journeys split across *Collaboration Modes*:",
      chart: { type: "pie", label: "Journeys by Collaboration Mode", labels: mix.labels, values: mix.values },
    };
  }

  // CSAT by channel (bar): "csat by channel", "compare csat"
  if (text.includes("csat") && (text.includes("channel") || text.includes("compare") || text.includes("by ") || text.includes("across"))) {
    return {
      kind: "csat_by_channel",
      text: "*CSAT by channel* (today):",
      chart: {
        type: "bar",
        label: "CSAT by channel",
        unit: "%",
        labels: channels.map((c) => c.name),
        values: channels.map((c) => c.csat),
      },
    };
  }

  // Per-channel metric questions: "csat for email", "chat volume today"
  const channel = channels.find((c) => text.includes(c.key) || text.includes(c.name.toLowerCase()));
  if (channel) {
    if (text.includes("csat") || text.includes("satisf")) {
      return { kind: "metric", text: `*${channel.name}* CSAT is currently *${channel.csat}%* (sentiment index ${channel.sentiment}/100).`, chart: null };
    }
    if (text.includes("sentiment")) {
      return { kind: "metric", text: `*${channel.name}* sentiment index is *${channel.sentiment}/100*, CSAT ${channel.csat}%.`, chart: null };
    }
    if (text.includes("handle") || text.includes("aht") || text.includes("time")) {
      return { kind: "metric", text: `*${channel.name}* average handle time is *${channel.aht} min*.`, chart: null };
    }
    if (text.includes("contain") || text.includes("deflect")) {
      return { kind: "metric", text: `*${channel.name}* containment rate is *${channel.containment}%* (resolved without a human).`, chart: null };
    }
    // Default to volume — this week vs. last week comparison.
    const wow = weekOverWeekPct(channel);
    return {
      kind: "metric",
      text: `*${channel.name}* volume today is *${channel.volume.toLocaleString()}* interactions (${wow}). Here's this week vs. last:`,
      chart: {
        type: "line",
        label: `${channel.name} volume`,
        labels: DAY_LABELS,
        unit: "",
        datasets: [
          { label: "This week", values: channel.trend },
          { label: "Last week", values: channel.lastWeek, dashed: true },
        ],
      },
    };
  }

  // Journey health / risk: "which journeys are at risk?", "journey health"
  if (text.includes("journey") || (text.includes("risk") && !text.includes("sla risk journeys"))) {
    const atRisk = journeys.filter((j) => j.slaRisk === "High").map((j) => j.name);
    const riskLine = atRisk.length
      ? `*${atRisk.length}* journeys are at *high SLA risk*: ${atRisk.join(", ")}.`
      : "No journeys are at high SLA risk right now.";
    return {
      kind: "journey_health",
      text: `${riskLine} Here's CSAT by interaction journey:`,
      chart: {
        type: "bar",
        label: "CSAT by journey",
        unit: "%",
        labels: journeys.map((j) => j.name),
        values: journeys.map((j) => j.csat),
      },
    };
  }

  // Whole-operation summary: "how are we doing", "overview", "summary"
  if (text.includes("overview") || text.includes("summary") || text.includes("how are we") || text.includes("today") || text.includes("volume")) {
    return {
      kind: "overview",
      text:
        `Across all channels today: *${totalVolume().toLocaleString()}* interactions, avg CSAT *${avgCsat()}%*, ` +
        `*${openAlertCount()}* open alerts. ${highSlaRiskJourneys().length} journeys at high SLA risk. Volume by channel over the last 7 days:`,
      chart: {
        type: "line",
        label: "Volume by channel",
        labels: DAY_LABELS,
        unit: "",
        showLegend: true,
        datasets: channels.map((c) => ({ label: c.name, values: c.trend })),
      },
    };
  }

  // Fallback
  const greeting = userId ? `:wave: Hi <@${userId}>! ` : ":wave: ";
  return {
    kind: "fallback",
    text:
      `${greeting}I'm your CX intelligence assistant. I draw on omnichannel interactions, ` +
      "conversation intelligence, and predictive SLA signals across your interaction journeys. " +
      "Here's what you can ask me:\n\n" +
      "*Channel metrics*\n" +
      "• \"chat volume today\"\n" +
      "• \"CSAT for email\"\n" +
      "• \"CSAT by channel\"\n\n" +
      "*Journeys & alerts*\n" +
      "• \"what's driving the claims alert?\"\n" +
      "• \"collaboration mode breakdown\"\n\n" +
      "*Big picture*\n" +
      "• \"give me an overview\"\n" +
      "• \"which journeys are at risk?\"",
    chart: null,
  };
}

module.exports = {
  COLLAB_MODES,
  SIGNALS,
  SIGNAL_COLORS,
  SKILL_LEVELS,
  DAY_LABELS,
  channels,
  journeys,
  alerts,
  roster,
  getChannel,
  getChannelMetrics,
  getJourney,
  getAlert,
  totalVolume,
  avgCsat,
  openAlertCount,
  highSlaRiskJourneys,
  volumeTrendTotals,
  weekOverWeekPct,
  collabModeMix,
  verticalEmoji,
  alertDashboardUrl,
  alertChartSpec,
  answerQuestion,
};
