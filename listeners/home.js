// ---------------------------------------------------------------------------
// App Home — publishes the CX intelligence dashboard on open
// ---------------------------------------------------------------------------

const blocks = require("../blocks");

function register(app) {
  app.event("app_home_opened", async ({ event, client, logger }) => {
    try {
      // Pass the user ID so the view can render a real <@USERID> mention.
      await client.views.publish({ user_id: event.user, view: blocks.homeTab(event.user) });
    } catch (error) {
      logger.error("Failed to publish App Home:", error);
    }
  });
}

module.exports = { register };
