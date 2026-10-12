const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

process.env.TZ = "Africa/Lagos";
const { messages, getDateKey, getMessageForDate, isReminderDay } = require("./messages");
const { getPhotoFiles, selectRandomPhotos } = require("./photos");

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

test("server and scheduler modules load without starting WhatsApp", () => {
  assert.equal(typeof require("./server").start, "function");
  assert.equal(typeof require("./scheduler").start, "function");
  assert.equal(require("./config").birthday, "2026-10-16");
});

test("selects two different photos and ignores other files", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "mom-photos-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  for (const name of ["mom-a.jpg", "mom-b.PNG", "mom-c.jpeg", "notes.txt"]) {
    fs.writeFileSync(path.join(directory, name), "test");
  }
  fs.mkdirSync(path.join(directory, "other.jpg"));
  assert.equal(getPhotoFiles(directory).length, 3);
  const selected = selectRandomPhotos(directory, () => 0);
  assert.equal(selected.length, 2);
  assert.notEqual(selected[0], selected[1]);
  assert.deepEqual(selected.map((file) => path.basename(file)), ["mom-a.jpg", "mom-b.PNG"]);
});

test("does not select photos if fewer than two are available", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "mom-photos-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  assert.throws(() => selectRandomPhotos(directory), /At least two/);
  fs.writeFileSync(path.join(directory, "mom.jpg"), "test");
  assert.throws(() => selectRandomPhotos(directory), /At least two/);
  assert.equal(getPhotoFiles(path.join(directory, "missing")).length, 0);
});
