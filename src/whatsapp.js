const { Client, LocalAuth } = require("whatsapp-web.js");
const EventEmitter = require("events");
const path = require("path");

const events = new EventEmitter();
let qrCode = null;
let ready = false;
let authenticating = false;
let client = null;

const authDataPath = process.env.AUTH_DATA_PATH
  ? path.resolve(process.env.AUTH_DATA_PATH)
  : path.join(__dirname, "..");

function getClient() {
  if (!client) {
    client = new Client({
      authStrategy: new LocalAuth({ dataPath: authDataPath }),
      puppeteer: {
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--single-process",
          "--disable-gpu",
          "--disable-extensions",
          "--disable-background-networking",
          "--disable-background-timer-throttling",
          "--disable-backgrounding-occluded-windows",
          "--disable-breakpad",
          "--disable-default-apps",
          "--disable-sync",
          "--disable-translate",
          "--metrics-recording-only",
          "--no-default-browser-check",
          "--mute-audio",
          "--disable-features=site-per-process,NetworkService",
        ],
      },
    });

    client.on("qr", (qr) => {
      qrCode = qr;
      ready = false;
      authenticating = false;
      events.emit("qr", qr);
      console.log("[WhatsApp] QR code generated - scan it in the dashboard");
    });

    client.on("ready", () => {
      ready = true;
      authenticating = false;
      qrCode = null;
      events.emit("ready");
      console.log("[WhatsApp] Client is ready and connected");
    });

    client.on("authenticated", () => {
      authenticating = true;
      qrCode = null;
      events.emit("authenticated");
      console.log("[WhatsApp] Authenticated successfully - loading...");
    });

    client.on("auth_failure", (msg) => {
      ready = false;
      events.emit("auth_failure", msg);
      console.error("[WhatsApp] Authentication failure:", msg);
    });

    client.on("disconnected", (reason) => {
      ready = false;
      authenticating = false;
      qrCode = null;
      client = null;
      events.emit("disconnected", reason);
      console.log("[WhatsApp] Client disconnected:", reason, "- will reinitialize in 5s");
      setTimeout(() => getClient(), 5000);
    });

    client.initialize();
  }
  return client;
}

async function sendToAll(message) {
  const { contacts } = require("./config");
  if (!ready) throw new Error("WhatsApp client is not ready yet");
  if (contacts.length === 0) throw new Error("No contacts configured");

  const results = [];
  for (const number of contacts) {
    const chatId = number.includes("@c.us") ? number : `${number}@c.us`;
    try {
      await client.sendMessage(chatId, message);
      results.push({ number, success: true });
      console.log(`[WhatsApp] Message sent to ${number}`);
    } catch (err) {
      results.push({ number, success: false, error: err.message });
      console.error(`[WhatsApp] Failed to send to ${number}:`, err.message);
    }
  }
  return results;
}

async function sendToSingle(number, message) {
  if (!ready) throw new Error("WhatsApp client is not ready yet");
  const chatId = number.includes("@c.us") ? number : `${number}@c.us`;
  await client.sendMessage(chatId, message);
  return { number, success: true };
}

function getStatus() {
  return { ready, authenticating, hasQr: !!qrCode, qrCode };
}

function getEvents() {
  return events;
}

module.exports = {
  getClient,
  sendToAll,
  sendToSingle,
  getStatus,
  getEvents,
};
