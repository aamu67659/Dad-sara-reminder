require("dotenv").config();
const path = require("path");

const configuredContacts = (process.env.FAMILY_CONTACTS || "")
  .split(",")
  .map((number) => number.trim())
  .filter(Boolean);
const contacts = configuredContacts.filter((number) => /^\d{8,15}$/.test(number));
if (contacts.length !== configuredContacts.length) {
  console.warn("[Config] Ignoring invalid family phone numbers; use country code and digits only");
}

const sendTime = process.env.SEND_TIME || "0 9";
const timezone = process.env.TZ || "Africa/Lagos";
const port = parseInt(process.env.PORT || "3000", 10);
const photoDir = path.resolve(
  process.env.PHOTO_DIR || path.join(process.env.AUTH_DATA_PATH || path.join(__dirname, ".."), "mom-photos")
);

const anniversary = "2026-10-16";
const reminderStart = "2026-10-13";

module.exports = {
  contacts,
  sendTime,
  timezone,
  port,
  photoDir,
  anniversary,
  reminderStart,
};
