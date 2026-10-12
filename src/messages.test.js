const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { once } = require("node:events");
const vm = require("node:vm");

process.env.TZ = "Africa/Lagos";
const uploadDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "mom-uploads-"));
process.env.PHOTO_DIR = uploadDirectory;
test.after(() => fs.rmSync(uploadDirectory, { recursive: true, force: true }));
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

test("dashboard upload script parses", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");
  const script = html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(script);
  assert.doesNotThrow(() => new vm.Script(script[1]));
});

test("photo uploads require a token and save only valid images", async (t) => {
  const previousToken = process.env.PHOTO_UPLOAD_TOKEN;
  t.after(() => {
    if (previousToken === undefined) delete process.env.PHOTO_UPLOAD_TOKEN;
    else process.env.PHOTO_UPLOAD_TOKEN = previousToken;
  });
  const server = require("./server").app.listen(0, "127.0.0.1");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await once(server, "listening");
  const url = `http://127.0.0.1:${server.address().port}`;
  const image = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
  const send = (body, token, type = "image/jpeg") => fetch(`${url}/api/photos`, {
    method: "POST",
    headers: { "Content-Type": type, ...(token ? { "X-Photo-Token": token } : {}) },
    body,
  });

  delete process.env.PHOTO_UPLOAD_TOKEN;
  assert.equal((await send(image)).status, 503);
  process.env.PHOTO_UPLOAD_TOKEN = "long-test-token-for-uploads";
  assert.equal((await send(image)).status, 401);
  assert.equal((await send(image, "incorrect-token-value")).status, 401);
  assert.equal((await send(Buffer.from("not an image"), process.env.PHOTO_UPLOAD_TOKEN)).status, 415);
  assert.equal((await send(image, process.env.PHOTO_UPLOAD_TOKEN, "text/plain")).status, 415);
  const result = await send(image, process.env.PHOTO_UPLOAD_TOKEN);
  assert.equal(result.status, 200);
  assert.equal((await result.json()).photosAvailable, 1);
  assert.equal(getPhotoFiles(uploadDirectory).length, 1);
  const status = await fetch(`${url}/api/status`);
  const data = await status.json();
  assert.equal(data.photosAvailable, 1);
  assert.equal(data.authenticating, false);
  assert.equal(data.connectionError, null);
});

test("phone pairing requires a token and validates the number", async (t) => {
  const previousToken = process.env.PAIRING_TOKEN;
  t.after(() => {
    if (previousToken === undefined) delete process.env.PAIRING_TOKEN;
    else process.env.PAIRING_TOKEN = previousToken;
  });
  const server = require("./server").app.listen(0, "127.0.0.1");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await once(server, "listening");
  const url = `http://127.0.0.1:${server.address().port}`;
  const send = (number, token) => fetch(`${url}/api/pairing-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { "X-Pairing-Token": token } : {}) },
    body: JSON.stringify({ phoneNumber: number }),
  });

  delete process.env.PAIRING_TOKEN;
  assert.equal((await send("2348012345678")).status, 503);
  process.env.PAIRING_TOKEN = "long-test-token-for-pairing";
  assert.equal((await send("2348012345678")).status, 401);
  assert.equal((await send("2348012345678", "incorrect-token-value")).status, 401);
  assert.equal((await fetch(`${url}/api/pairing-code`)).status, 401);
  assert.equal((await send("+2348012345678", process.env.PAIRING_TOKEN)).status, 400);
  assert.equal((await send("1234567", process.env.PAIRING_TOKEN)).status, 400);
  const codeStatus = await fetch(`${url}/api/pairing-code`, {
    headers: { "X-Pairing-Token": process.env.PAIRING_TOKEN },
  });
  assert.equal(codeStatus.status, 200);
  assert.equal(codeStatus.headers.get("cache-control"), "no-store");
  assert.deepEqual(await codeStatus.json(), { code: null, ready: false, authenticating: false });
  const status = await (await fetch(`${url}/api/status`)).json();
  assert.equal(Object.hasOwn(status, "pairingCode"), false);
});
