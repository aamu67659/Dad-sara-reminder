const { anniversary, reminderStart } = require("./config");

const messages = {
  "9-2":
    "Hi family, just over a month to go until Dad's remembrance on October 4th. Mark your calendars and start planning to be there. We'll honor him together.",
  "9-3":
    "Good morning everyone. One month until Dad's remembrance on October 4th. Please start thinking about your travel and schedule arrangements.",
  "9-4":
    "30 days to go until we remember Dad on October 4th. Take a moment today to reflect on the legacy he left us.",
  "9-5":
    "29 days until Dad's remembrance. If you need help with travel plans, please let me know early so we can coordinate.",
  "9-6":
    "Good morning family. 28 days to go. Let's keep Dad in our hearts as we prepare to gather on October 4th.",
  "9-7":
    "27 days until October 4th. Dad's remembrance is coming up - please confirm you'll be there if you haven't yet.",
  "9-8":
    "26 days to go, family. Dad's remembrance on October 4th is approaching. Reach out if you need anything sorted.",
  "9-9":
    "Good morning. 25 days until we honor Dad's memory on October 4th. Let's stay connected and support each other.",
  "9-10":
    "24 days to go. As we count down to Dad's remembrance on October 4th, let's cherish the memories we shared with him.",
  "9-11":
    "23 days until October 4th. Please start finalizing your plans to attend Dad's remembrance. Looking forward to seeing everyone.",
  "9-12":
    "Good morning family. 22 days to go. If anyone needs accommodation or transport help for October 4th, please speak up soon.",
  "9-13":
    "21 days - three weeks until Dad's remembrance on October 4th. Let's use this time to prepare well.",
  "9-14":
    "20 days to go, family. Dad's remembrance is on October 4th. Keep him in your thoughts today.",
  "9-15":
    "Good morning. 19 days until we gather to remember Dad on October 4th. Let's keep each other in our prayers.",
  "9-16":
    "18 days to go. Dad's remembrance on October 4th is getting closer. Please make sure your travel plans are coming along.",
  "9-17":
    "17 days until October 4th. Take a moment today to remember Dad and the values he taught us.",
  "9-18":
    "Good morning family. 16 days to go until Dad's remembrance. Please confirm your attendance if you haven't already.",
  "9-19":
    "15 days - just over two weeks until we honor Dad on October 4th. Let's start making concrete arrangements.",
  "9-20":
    "14 days, two weeks to go! Dad's remembrance is on October 4th. Please finalize your travel and accommodation plans this week.",
  "9-21":
    "Good morning. 13 days until Dad's remembrance on October 4th. Reach out if you need help with any arrangements.",
  "9-22":
    "12 days to go, family. As we approach October 4th, let's reflect on Dad's life and the love he gave us.",
  "9-23":
    "11 days until Dad's remembrance on October 4th. Please make sure everything is in order for the day.",
  "9-24":
    "Good morning. 10 days to go until we remember Dad on October 4th. Almost there - please confirm your plans are set.",
  "9-25":
    "Hi everyone, just a gentle reminder that our Dad's remembrance is on October 4th - 9 days from now. Please start making arrangements to be there. Let's honor him together.",
  "9-26":
    "Good morning family. 8 days to go until Dad's remembrance on October 4th. If you haven't already, please confirm your attendance. Love you all.",
  "9-27":
    "One week to go! Dad's remembrance is on October 4th. Let's use this week to prepare and support each other. Please reach out if you need help with anything.",
  "9-28":
    "6 days until we gather to remember Dad on October 4th. Take a moment today to think about him and the memories we shared. See you soon.",
  "9-29":
    "5 days to go, family. Dad's remembrance is on October 4th. Let's keep each other in our thoughts and prayers as we prepare to honor his memory.",
  "9-30":
    "4 days until October 4th - the day we remember Dad. Please let me know if you need directions or help with arrangements. Looking forward to seeing everyone.",
  "10-1":
    "3 days to go. Dad's remembrance is on October 4th. Let's start finalizing our plans. If anyone needs accommodation or transport help, speak up now.",
  "10-2":
    "Just 2 days until Dad's remembrance on October 4th. Almost time to come together as a family. Please make sure your travel plans are set.",
  "10-3":
    "Tomorrow is the day - Dad's remembrance on October 4th. Let's rest well tonight and come ready to honor him together. See you all tomorrow.",
  "10-4":
    "Today is October 4th - the day we remember our Dad. Let's come together with love and gratitude to honor his memory. May he rest in peace.",
};

function getMessageForDate(date) {
  const key = `${date.getMonth() + 1}-${date.getDate()}`;
  return messages[key] || null;
}

function isReminderDay(date) {
  const month = date.getMonth() + 1;
  const day = date.getDate();

  if (month < reminderStart.month || month > anniversary.month) return false;
  if (month === reminderStart.month && day < reminderStart.day) return false;
  if (month === anniversary.month && day > anniversary.day) return false;
  return true;
}

function daysUntilAnniversary(date) {
  const year = date.getFullYear();
  const ann = new Date(year, anniversary.month - 1, anniversary.day);
  const diff = ann - date;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

module.exports = { messages, getMessageForDate, isReminderDay, daysUntilAnniversary };
