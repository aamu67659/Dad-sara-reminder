const cron = require("node-cron");
const { sendToAll, getStatus } = require("./whatsapp");
const { getMessageForDate, isReminderDay } = require("./messages");
const { sendTime, timezone, contacts } = require("./config");

let scheduledTask = null;

async function runReminder() {
  const now = new Date();
  if (!isReminderDay(now)) {
    console.log(`[Scheduler] Today (${now.toDateString()}) is not a reminder day. Skipping.`);
    return;
  }

  const message = getMessageForDate(now);
  if (!message) {
    console.log("[Scheduler] No message configured for today. Skipping.");
    return;
  }

  const { ready } = getStatus();
  if (!ready) {
    console.error("[Scheduler] WhatsApp is not connected. Cannot send reminders.");
    return;
  }

  console.log(`[Scheduler] Sending reminder for ${now.toDateString()}...`);
  try {
    const results = await sendToAll(message);
    const sent = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    console.log(`[Scheduler] Done. Sent: ${sent}, Failed: ${failed}`);
  } catch (err) {
    console.error("[Scheduler] Error sending reminders:", err.message);
  }
}

function start() {
  if (scheduledTask) {
    scheduledTask.stop();
  }

  const cronExpression = `${sendTime} * * *`;
  if (!cron.validate(cronExpression)) {
    console.error(`[Scheduler] Invalid cron expression: ${cronExpression}`);
    return;
  }

  scheduledTask = cron.schedule(
    cronExpression,
    runReminder,
    { timezone }
  );

  console.log(`[Scheduler] Scheduled daily at "${sendTime}" (${timezone})`);
  console.log(`[Scheduler] Contacts: ${contacts.length} configured`);
}

function stop() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }
}

module.exports = { start, stop, runReminder };
