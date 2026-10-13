const { anniversary, reminderStart, timezone } = require("./config");

const messages = {
  "2026-10-13":
    "Dear Mum and her two sons, as we begin these days leading up to October 16, we give thanks for Mum's life and the good health she enjoys at 71. Mum, in ordinary moments and difficult ones, you have given your sons a place to feel safe, seen, and loved. Your care has shaped who they are in ways words can hardly capture. To her two sons: take time today to tell Mum one thing you carry in your heart because of her. Mum, may you feel that the love you have given so freely is coming home to you.",
  "2026-10-14":
    "Dear Mum and her two sons, some love is so constant that we forget how much strength it takes to keep giving it. Mum, through the years since Dad passed, you have carried grief and still made room for tenderness, hope, and your boys. We see the courage behind the quiet things you do. Sons, let us not wait for a special occasion to thank her for the ways she has stood beside you. Mum, you do not have to be strong every moment; you deserve to be held, cared for, and loved just as deeply as you have loved us.",
  "2026-10-15":
    "Dear Mum and her two sons, tomorrow we celebrate the anniversary of Mum's healthy life, but today we want you to know that you are more than everything you have done for us. You are a whole person with dreams, memories, and a heart that deserves gentleness and joy. To your sons: look at these pictures and remember the moments behind them; tell Mum what being her son has meant to you. Mum, thank you for every time you showed up, even when nobody saw what it cost. We hope you can rest tonight knowing how profoundly you are loved.",
  "2026-10-16":
    "Dear Mum, on this special anniversary celebrating your healthy life, your two sons and all of us give thanks for you. At 71, your health, your laughter, your warmth, and your love are gifts we cherish through every season of our lives. We remember Dad with love, and we honour the strength it has taken to keep going through the years without him. To your sons: hold her close, listen to her stories, and tell her plainly how much she means to you. Mum, may the days ahead bring you peace, continued good health, unhurried joy, and the same unwavering love you have always given us.",
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
