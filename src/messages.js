const { anniversary, reminderStart, timezone } = require("./config");

const messages = {
  "2026-10-13":
    "Dear Mum and her two sons, as we count down to October 16, we celebrate a remarkable milestone: Mum's 40 years at the bar. Mum, your dedication to the law and the years of work behind your career deserve to be recognised. To your sons: ask her about a moment in her legal journey that she is especially proud of. Mum, may you know how deeply your family admires you, both for the lawyer you are and for the love you have given us.",
  "2026-10-14":
    "Dear Mum and her two sons, a career spanning 40 years at the bar is built day by day, with perseverance, learning, and care for the work. Mum, as a senior lawyer, you have earned a place that reflects years of commitment. To your sons: take time to thank her for the example she has set and for the ways she has stood beside you. Mum, we honour not only your professional journey but the person behind it.",
  "2026-10-15":
    "Dear Mum and her two sons, tomorrow we mark 40 years since Mum began her journey at the bar. Mum, you have given so much to your legal career while making room in your life for the people you love. To your sons: look at these pictures and share a memory of her that makes you proud. Mum, we hope you can rest tonight knowing that your hard work, your strength, and your warmth have not gone unnoticed.",
  "2026-10-16":
    "Dear Mum, today we celebrate your 40th anniversary at the bar and the career you have built as a senior lawyer. Forty years of dedication to the law is a milestone worth honouring. At 71, you continue to inspire your two sons and all of us with your strength, wisdom, and warmth. We remember Dad with love as we share this proud moment with you. To your sons: hold her close, listen to her stories, and tell her plainly how much her journey means to you. Mum, congratulations on 40 years at the bar; may the days ahead bring you peace, good health, and the joy of knowing how loved and respected you are.",
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
  return key >= reminderStart && key <= anniversary;
}

module.exports = { messages, getDateKey, getMessageForDate, isReminderDay };
