const test = require("node:test");
const assert = require("node:assert/strict");

process.env.TZ = "Africa/Lagos";
const { messages, getDateKey, getMessageForDate, isReminderDay } = require("./messages");

test("sends one message each day from October 12 through October 16, 2026", () => {
  assert.equal(Object.keys(messages).length, 5);
  for (let day = 12; day <= 16; day++) {
    const date = new Date(Date.UTC(2026, 9, day, 9));
    assert.equal(isReminderDay(date), true);
    assert.equal(typeof getMessageForDate(date), "string");
  }
});

test("does not send before or after the birthday countdown", () => {
  for (const date of ["2026-10-11T09:00:00Z", "2026-10-17T09:00:00Z", "2027-10-12T09:00:00Z"]) {
    assert.equal(isReminderDay(new Date(date)), false);
    assert.equal(getMessageForDate(new Date(date)), null);
  }
});

test("uses the configured timezone at day boundaries", () => {
  const firstDay = new Date("2026-10-11T23:30:00Z");
  const dayAfter = new Date("2026-10-16T23:30:00Z");
  assert.equal(getDateKey(firstDay), "2026-10-12");
  assert.equal(isReminderDay(firstDay), true);
  assert.equal(getDateKey(dayAfter), "2026-10-17");
  assert.equal(isReminderDay(dayAfter), false);
});
