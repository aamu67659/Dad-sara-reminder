require("dotenv").config();

const contacts = (process.env.FAMILY_CONTACTS || "")
  .split(",")
  .map((c) => c.trim())
  .filter(Boolean);

const sendTime = process.env.SEND_TIME || "0 9";
const timezone = process.env.TZ || "Africa/Lagos";
const port = parseInt(process.env.PORT || "3000", 10);

const anniversary = { month: 9, day: 4 };

const reminderStart = { month: 9, day: 2 };

module.exports = {
  contacts,
  sendTime,
  timezone,
  port,
  anniversary,
  reminderStart,
};
