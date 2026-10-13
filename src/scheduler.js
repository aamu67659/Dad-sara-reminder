const cron = require("node-cron");
const { sendToAll, getStatus } = require("./whatsapp");
const { getDateKey, getMessageForDate, isReminderDay } = require("./messages");
const { sendTime, timezone, contacts } = require("./config");
const { selectRandomPhotos } = require("./photos");

let scheduledTask = null;
let sending = false;

async function runReminder() {
  if (sending) throw new Error("A reminder is already being sent");
  const now = new Date();
  if (!isReminderDay(now)) return { skipped: `Today (${getDateKey(now)}) is not a reminder day` };
  const message = getMessageForDate(now);
  if (!message) return { skipped: "No message is configured for today" };
  if (!getStatus().ready) throw new Error("WhatsApp is not connected yet");

  sending = true;
  try {
    const photos = selectRandomPhotos();
    const results = await sendToAll(message, photos);
    const sent = results.filter((result) => result.success).length;
    const failed = results.length - sent;
    const photoFailed = results.filter((result) => result.photoError).length;
    console.log(`[Scheduler] ${getDateKey(now)}: sent ${sent}, failed ${failed}, photos failed ${photoFailed}`);
    return { sent, failed, photoFailed };
  } finally {
    sending = false;
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
    () => runReminder().catch((err) => console.error("[Scheduler] Reminder failed:", err)),
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
