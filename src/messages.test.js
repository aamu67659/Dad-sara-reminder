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

test("sends one message each day from October 13 through October 16, 2026", () => {
  assert.equal(Object.keys(messages).length, 4);
  for (let day = 13; day <= 16; day++) {
    const date = new Date(Date.UTC(2026, 9, day, 9));
    assert.equal(isReminderDay(date), true);
    assert.equal(typeof getMessageForDate(date), "string");
  }
});

test("celebrates Mum's healthy life at 71 without treating October 16 as her birthday", () => {
  assert.match(messages["2026-10-16"], /anniversary/i);
  assert.match(messages["2026-10-16"], /71/);
  for (const message of Object.values(messages)) {
    assert.doesNotMatch(message, /birthday|64th/i);
  }
});

test("does not send before or after the anniversary countdown", () => {
  for (const date of ["2026-10-12T09:00:00Z", "2026-10-17T09:00:00Z", "2027-10-13T09:00:00Z"]) {
    assert.equal(isReminderDay(new Date(date)), false);
    assert.equal(getMessageForDate(new Date(date)), null);
  }
});

test("uses the configured timezone at day boundaries", () => {
  const firstDay = new Date("2026-10-12T23:30:00Z");
  const dayAfter = new Date("2026-10-16T23:30:00Z");
  assert.equal(getDateKey(firstDay), "2026-10-13");
  assert.equal(isReminderDay(firstDay), true);
  assert.equal(getDateKey(dayAfter), "2026-10-17");
  assert.equal(isReminderDay(dayAfter), false);
});

test("server and scheduler modules load without starting WhatsApp", () => {
  assert.equal(typeof require("./server").start, "function");
  assert.equal(typeof require("./scheduler").start, "function");
  assert.equal(require("./config").anniversary, "2026-10-16");
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

test("dashboard reports an HTML gateway error instead of parsing it as JSON", async () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const elements = new Map();
  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, { value: "", hidden: false, addEventListener() {} });
      return elements.get(id);
    },
  };
  vm.runInNewContext(script, {
    document,
    fetch: async () => ({ status: 502, headers: { get: () => "text/html" } }),
    setInterval() {},
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(elements.get("connection-alert").textContent, /HTTP 502/);
  assert.equal(elements.get("wa-status").textContent, "Cannot reach the service");
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
  assert.deepEqual(await codeStatus.json(), { code: null, phase: "starting", ready: false, connectionError: null });
  const status = await (await fetch(`${url}/api/status`)).json();
  assert.equal(Object.hasOwn(status, "pairingCode"), false);
  assert.equal(Object.hasOwn(status, "contacts"), false);
  assert.equal((await fetch(`${url}/api/qr`)).status, 401);
  assert.equal((await fetch(`${url}/api/test-send`, { method: "POST" })).status, 401);
  assert.equal((await fetch(`${url}/api/run-reminder`, { method: "POST" })).status, 401);
  const invalidSend = await fetch(`${url}/api/test-send`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Pairing-Token": process.env.PAIRING_TOKEN },
    body: JSON.stringify({ number: 0 }),
  });
  assert.equal(invalidSend.status, 400);
  const missingRoute = await fetch(`${url}/api/missing`);
  assert.equal(missingRoute.status, 404);
  assert.equal((await missingRoute.json()).error, "API route not found");
  const invalidBody = await fetch(`${url}/api/pairing-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Pairing-Token": process.env.PAIRING_TOKEN },
    body: "{",
  });
  assert.equal(invalidBody.status, 400);
  assert.equal((await invalidBody.json()).error, "Invalid request body");
});

test("switches from QR to native phone pairing without keeping the old browser", async (t) => {
  const { EventEmitter } = require("node:events");
  const { WhatsAppService } = require("./whatsapp");
  const instances = [];
  class FakeClient extends EventEmitter {
    constructor(options) {
      super();
      this.options = options;
      this.destroyed = false;
      instances.push(this);
    }
    async initialize() {
      if (this.options.pairWithPhoneNumber) this.emit("code", "ABCDEFGH");
      else this.emit("qr", "qr-data");
    }
    async destroy() { this.destroyed = true; }
    async sendMessage(id, text) { this.lastMessage = { id, text }; }
  }
  class FakeAuth {}
  const service = new WhatsAppService({ ClientClass: FakeClient, AuthClass: FakeAuth, startupMs: 5000, retryMs: 10 });
  t.after(() => service.stop());
  service.start();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(service.getStatus().phase, "qr");
  assert.equal(service.getStatus().hasQr, true);
  await service.requestPairingCode("2348012345678");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(instances.length, 2);
  assert.equal(instances[0].destroyed, true);
  assert.equal(instances[1].options.pairWithPhoneNumber.phoneNumber, "2348012345678");
  assert.equal(service.getStatus().pairingCode, "ABCDEFGH");
  instances[0].emit("qr", "stale-qr");
  assert.equal(service.getStatus().hasQr, false);
  instances[1].emit("authenticated");
  assert.equal(service.getStatus().pairingCode, null);
  instances[1].emit("ready");
  assert.equal(service.getStatus().ready, true);
  await service.sendToSingle("2348012345678", "Hello");
  assert.deepEqual(instances[1].lastMessage, { id: "2348012345678@c.us", text: "Hello" });
  await assert.rejects(service.requestPairingCode("2348012345678"), /already linked/);
  instances[1].emit("disconnected", "test");
  assert.equal(service.getStatus().phase, "error");
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(instances[1].destroyed, true);
  assert.equal(instances[2].options.pairWithPhoneNumber, undefined);
  assert.equal(service.getStatus().phase, "qr");
});

test("sends reminder text before photos and reports photo failures separately", async (t) => {
  const { contacts } = require("./config");
  const { WhatsAppService } = require("./whatsapp");
  const previousContacts = [...contacts];
  contacts.splice(0, contacts.length, "2348012345678");
  t.after(() => contacts.splice(0, contacts.length, ...previousContacts));
  t.mock.method(console, "error", () => {});
  const photoOne = { name: "first" };
  const photoTwo = { name: "second" };
  const service = new WhatsAppService({ MediaClass: { fromFilePath: (file) => file === "first" ? photoOne : photoTwo } });
  service.phase = "ready";
  const sent = [];
  service.client = {
    async sendMessage(id, content) {
      sent.push({ id, content });
      if (content === photoOne) throw new Error("media failed");
    },
  };

  assert.deepEqual(await service.sendToAll("Reminder", ["first", "second"]), [
    { number: "2348012345678", success: true, photoError: "media failed" },
  ]);
  assert.deepEqual(sent.map(({ content }) => content), ["Reminder", photoOne]);
  assert.ok(sent.every(({ id }) => id === "2348012345678@c.us"));

  sent.length = 0;
  service.client.sendMessage = async (id, content) => { sent.push({ id, content }); };
  assert.deepEqual(await service.sendToAll("Reminder", ["first", "second"]), [
    { number: "2348012345678", success: true },
  ]);
  assert.deepEqual(sent.map(({ content }) => content), ["Reminder", photoOne, photoTwo]);

  sent.length = 0;
  service.client.sendMessage = async (id, content) => {
    sent.push({ id, content });
    if (content === "Reminder") throw new Error("text failed");
  };
  assert.deepEqual(await service.sendToAll("Reminder", ["first", "second"]), [
    { number: "2348012345678", success: false, error: "text failed" },
  ]);
  assert.deepEqual(sent.map(({ content }) => content), ["Reminder"]);
});
