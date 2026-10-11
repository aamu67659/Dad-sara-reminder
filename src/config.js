require("dotenv").config();

const contacts = (process.env.FAMILY_CONTACTS || "")
  .split(",")
  .map((c) => c.trim())
  .filter(Boolean);

const sendTime = process.env.SEND_TIME || "0 9";
const timezone = process.env.TZ || "Africa/Lagos";
const port = parseInt(process.env.PORT || "3000", 10);

const birthday = "2026-10-16";
const reminderStart = "2026-10-12";

module.exports = {
  contacts,
  sendTime,
  timezone,
  port,
  birthday,
  reminderStart,
};
