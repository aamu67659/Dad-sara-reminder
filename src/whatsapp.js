const { Client, LocalAuth } = require("whatsapp-web.js");
const EventEmitter = require("events");

const events = new EventEmitter();
let qrCode = null;
let ready = false;
let client = null;

function getClient() {
  if (!client) {
    client = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: {
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--single-process",
          "--disable-gpu",
        ],
      },
    });

    client.on("qr", (qr) => {
      qrCode = qr;
      ready = false;
      events.emit("qr", qr);
      console.log("[WhatsApp] QR code generated - scan it in the dashboard");
    });

    client.on("ready", () => {
      ready = true;
      qrCode = null;
      events.emit("ready");
      console.log("[WhatsApp] Client is ready and connected");
    });

    client.on("authenticated", () => {
      console.log("[WhatsApp] Authenticated successfully");
    });

    client.on("auth_failure", (msg) => {
      ready = false;
      events.emit("auth_failure", msg);
      console.error("[WhatsApp] Authentication failure:", msg);
    });

    client.on("disconnected", (reason) => {
      ready = false;
      events.emit("disconnected", reason);
      console.log("[WhatsApp] Client disconnected:", reason);
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
  return { ready, hasQr: !!qrCode, qrCode };
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
