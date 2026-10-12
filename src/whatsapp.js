const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const EventEmitter = require("events");
const path = require("path");

const events = new EventEmitter();
let qrCode = null;
let ready = false;
let authenticating = false;
let connectionError = null;
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
          "--disable-gpu",
        ],
      },
    });

    client.on("qr", (qr) => {
      qrCode = qr;
      ready = false;
      authenticating = false;
      connectionError = null;
      events.emit("qr", qr);
      console.log("[WhatsApp] QR code generated - scan it in the dashboard");
    });

    client.on("ready", async () => {
      ready = true;
      authenticating = false;
      connectionError = null;
      qrCode = null;
      events.emit("ready");
      console.log("[WhatsApp] Client is ready and connected");
      try {
        await client.setDisplayName("Mom's Birthday Reminders");
        console.log("[WhatsApp] Display name set");
      } catch (err) {
        console.warn("[WhatsApp] Could not set display name:", err.message);
      }
    });

    client.on("authenticated", () => {
      authenticating = true;
      connectionError = null;
      qrCode = null;
      events.emit("authenticated");
      console.log("[WhatsApp] Authenticated successfully - loading...");
    });

    client.on("auth_failure", (msg) => {
      ready = false;
      authenticating = false;
      qrCode = null;
      connectionError = "WhatsApp authentication failed. Check server logs.";
      events.emit("auth_failure", msg);
      console.error("[WhatsApp] Authentication failure:", msg);
    });

    client.on("disconnected", (reason) => {
      ready = false;
      authenticating = false;
      qrCode = null;
      connectionError = "WhatsApp disconnected. Reconnecting...";
      client = null;
      events.emit("disconnected", reason);
      console.log("[WhatsApp] Client disconnected:", reason, "- will reinitialize in 5s");
      setTimeout(() => getClient(), 5000);
    });

    client.initialize().catch((err) => {
      ready = false;
      authenticating = false;
      qrCode = null;
      connectionError = "WhatsApp Web failed to start. Check server logs; retrying...";
      client = null;
      console.error("[WhatsApp] Browser failed to start:", err);
      setTimeout(() => getClient(), 30000);
    });
  }
  return client;
}

async function sendToAll(message, photoPaths = []) {
  const { contacts } = require("./config");
  if (!ready) throw new Error("WhatsApp client is not ready yet");
  if (contacts.length === 0) throw new Error("No contacts configured");
  if (photoPaths.length !== 0 && photoPaths.length !== 2) {
    throw new Error("Exactly two photos must be provided");
  }
  const photos = photoPaths.map((photoPath) => MessageMedia.fromFilePath(photoPath));

  const results = [];
  for (const number of contacts) {
    const chatId = number.includes("@c.us") ? number : `${number}@c.us`;
    try {
      if (photos.length) {
        await client.sendMessage(chatId, photos[0], { caption: message });
        await client.sendMessage(chatId, photos[1]);
      } else {
        await client.sendMessage(chatId, message);
      }
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
  return { ready, authenticating, connectionError, hasQr: !!qrCode, qrCode };
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
