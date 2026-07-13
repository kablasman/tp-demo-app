// ---------------------------------------------------------------------------
// Interactive components — suggested actions, menu buttons
// ---------------------------------------------------------------------------

const data = require("../data");
const blocks = require("../blocks");

// Human-readable labels for the suggested-action buttons.
const ACTION_LABELS = {
  alert_reroute: "Re-routed to CE",
  alert_deploy_macro: "Deployed macro",
  alert_escalate_hitl: "Escalated to human",
};

function register(app) {
  // ── Suggested actions on an alert (reroute / macro / escalate) ────────────
  // These update the original alert message in place to show the outcome.
  Object.keys(ACTION_LABELS).forEach((actionId) => {
    app.action(actionId, async ({ ack, body, action, respond, logger }) => {
      await ack();
      try {
        const alert = data.getAlert(action.value);
        if (!alert) return;
        await respond({
          replace_original: true,
          blocks: blocks.alertResolvedBlocks(alert, ACTION_LABELS[actionId], body.user.id),
          text: `${ACTION_LABELS[actionId]} — ${alert.title}`,
        });
      } catch (error) {
        logger.error("alert action failed:", error);
      }
    });
  });

  // ── Dismiss an alert ──────────────────────────────────────────────────────
  app.action("alert_dismiss", async ({ ack, body, respond }) => {
    await ack();
    await respond({
      replace_original: true,
      text: `:heavy_multiplication_x: Alert dismissed by <@${body.user.id}>. Logged in TP dashboard`,
    });
  });

  // ── "View" an alert from the Home tab → DM the alert to the user ──────────
  app.action(/^home_view_alert_(.+)$/, async ({ ack, body, action, client, context, logger }) => {
    await ack();
    try {
      // Alert id comes from the action_id suffix (carousel card buttons carry no value).
      const alertId = (action.action_id || "").replace("home_view_alert_", "") || action.value;
      const alert = data.getAlert(alertId);
      if (!alert) return;
      await client.chat.postMessage({
        channel: body.user.id,
        blocks: blocks.alertBlocks(alert, context.botUserId),
        text: `${alert.severity} Alert — ${alert.title}`,
      });
    } catch (error) {
      logger.error("home_view_alert failed:", error);
    }
  });

  // ── "Send to channel" from a Home alert card → open channel picker modal ──
  app.action(/^home_send_alert_(.+)$/, async ({ ack, body, action, client, logger }) => {
    await ack();
    try {
      const alertId = (action.action_id || "").replace("home_send_alert_", "");
      const alert = data.getAlert(alertId);
      if (!alert) return;
      await client.views.open({ trigger_id: body.trigger_id, view: blocks.sendAlertModal(alert) });
    } catch (error) {
      logger.error("home_send_alert failed:", error);
    }
  });

  // Modal submit → post the alert (plus optional note) to the chosen channel.
  app.view("send_alert_submit", async ({ ack, view, body, client, context, logger }) => {
    const alert = data.getAlert(view.private_metadata);
    const channel = view.state.values.send_channel.send_channel_select.selected_channel;
    // rich_text_input returns a rich_text block object (not a plain string).
    const noteRich = view.state.values.send_note.send_note_input.rich_text_value;
    const hasNote = noteRich && (noteRich.elements || []).some((el) => (el.elements || []).length);

    if (!channel) {
      await ack({ response_action: "errors", errors: { send_channel: "Pick a channel to send this alert to." } });
      return;
    }
    await ack();

    try {
      if (hasNote) {
        // Post the sender's rich-text note, prefixed with who shared it.
        await client.chat.postMessage({
          channel,
          text: `<@${body.user.id}> shared a CX alert`,
          blocks: [
            { type: "section", text: { type: "mrkdwn", text: `<@${body.user.id}> shared a CX alert:` } },
            noteRich,
          ],
        });
      }
      await client.chat.postMessage({
        channel,
        blocks: blocks.alertBlocks(alert, context.botUserId),
        text: `${alert.severity} Alert — ${alert.title}`,
      });
    } catch (error) {
      // Bot likely isn't in the target channel — let the sender know via DM.
      logger.error("send_alert_submit post failed:", error);
      await client.chat.postMessage({
        channel: body.user.id,
        text: `:warning: I couldn't post to <#${channel}> — invite me there (\`/invite @TP Agent\`) and try again.`,
      });
    }
  });
}

module.exports = { register };
