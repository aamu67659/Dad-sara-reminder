const { birthday, reminderStart, timezone } = require("./config");

const messages = {
  "2026-10-12":
    "To our dear Mom and her two sons: Your birthday week begins today! 'A mother's love is a light her children carry wherever they go.' Mom, yours has been a steady light for your boys. May you feel that love coming back to you today.",
  "2026-10-13":
    "A little thought for Mom and her boys: 'Love is not measured by how easy the journey was, but by how faithfully we walked it together.' Mom, you have been there for your sons through every season. Three days until we celebrate you!",
  "2026-10-14":
    "To Mom and her sons: 'The strongest hearts are often the gentlest.' For 21 years since Dad passed, you have kept showing up with love, courage, and care, just as you did before. Two days until your birthday, Mom; you deserve to be cherished.",
  "2026-10-15":
    "Tomorrow is Mom's birthday! 'The best gift we can give someone is to let them know how deeply they are loved.' To her two sons: tell her what her love and sacrifices have meant to you. Mom, everything you have poured into your boys has made a beautiful difference.",
  "2026-10-16":
    "Happy 64th birthday, Mom! 'A life of love leaves a legacy in every heart it touches.' You raised two sons with strength and tenderness, including through the 21 years since Dad's passing. Today we celebrate you. May this new year bring you joy, rest, good health, and all the love you deserve.",
};

function getDateKey(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function getMessageForDate(date) {
  return messages[getDateKey(date)] || null;
}

function isReminderDay(date) {
  const key = getDateKey(date);
  return key >= reminderStart && key <= birthday;
}

module.exports = { messages, getDateKey, getMessageForDate, isReminderDay };
