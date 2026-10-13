const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const path = require("path");
const { contacts } = require("./config");

const authDataPath = process.env.AUTH_DATA_PATH
  ? path.resolve(process.env.AUTH_DATA_PATH)
  : path.join(__dirname, "..");

class WhatsAppService {
  constructor({ ClientClass = Client, AuthClass = LocalAuth, MediaClass = MessageMedia, retryMs = 15000, startupMs = 90000 } = {}) {
    this.ClientClass = ClientClass;
    this.AuthClass = AuthClass;
    this.MediaClass = MediaClass;
    this.retryMs = retryMs;
    this.startupMs = startupMs;
    this.client = null;
    this.phase = "starting";
    this.error = null;
    this.qrCode = null;
    this.pairingCode = null;
    this.pairingNumber = null;
    this.retryTimer = null;
    this.watchdog = null;
    this.switching = null;
    this.restarting = null;
    this.stopped = false;
  }

  getStatus() {
    return {
      phase: this.phase,
      ready: this.phase === "ready",
      authenticating: this.phase === "authenticated",
      connectionError: this.error,
      hasQr: !!this.qrCode,
      qrCode: this.qrCode,
      pairingCode: this.pairingCode,
    };
  }

  start() {
    this.stopped = false;
    if (!this.client && !this.retryTimer && !this.switching) this.launch();
  }

  launch() {
    if (this.stopped || this.client) return;
    this.phase = "starting";
    this.qrCode = null;
    this.pairingCode = null;
    const options = {
      authStrategy: new this.AuthClass({ dataPath: authDataPath }),
      puppeteer: {
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--no-first-run", "--disable-gpu"],
      },
    };
    if (this.pairingNumber) {
      options.pairWithPhoneNumber = { phoneNumber: this.pairingNumber, showNotification: true, intervalMs: 180000 };
    }
    let current;
    try {
      current = new this.ClientClass(options);
    } catch (err) {
      console.error("[WhatsApp] Could not create browser client:", err);
      this.phase = "error";
      this.error = "Could not create WhatsApp browser; retrying";
      this.pairingNumber = null;
      this.retryTimer = setTimeout(() => {
        this.retryTimer = null;
        this.launch();
      }, this.retryMs);
      return;
    }
    this.client = current;
    const active = () => this.client === current && !this.stopped;

    current.on("qr", (qr) => {
      if (!active()) return;
      this.phase = "qr";
      this.error = null;
      this.qrCode = qr;
      console.log("[WhatsApp] QR code generated");
      this.clearWatchdog();
    });
    current.on("code", (code) => {
      if (!active()) return;
      this.phase = "pairing";
      this.error = null;
      this.qrCode = null;
      this.pairingCode = code;
      this.clearWatchdog();
      console.log("[WhatsApp] Phone pairing code generated");
    });
    current.on("authenticated", () => {
      if (!active()) return;
      this.phase = "authenticated";
      this.error = null;
      this.qrCode = null;
      this.pairingCode = null;
      this.armWatchdog(current);
      console.log("[WhatsApp] Authenticated, waiting for chat sync");
    });
    current.on("ready", () => {
      if (!active()) return;
      this.phase = "ready";
      this.error = null;
      this.qrCode = null;
      this.pairingCode = null;
      this.pairingNumber = null;
      this.clearWatchdog();
      console.log("[WhatsApp] Client is ready and connected");
    });
    current.on("auth_failure", (reason) => {
      if (!active()) return;
      console.error("[WhatsApp] Authentication failed:", reason);
      this.fail(current, "Authentication failed; reconnecting in QR mode");
    });
    current.on("disconnected", (reason) => {
      if (!active()) return;
      console.error("[WhatsApp] Disconnected:", reason);
      this.fail(current, "WhatsApp disconnected; reconnecting");
    });

    this.armWatchdog(current);
    Promise.resolve().then(() => current.initialize()).catch((err) => {
      if (active()) this.fail(current, "Browser failed to start; retrying", err);
    });
  }

  clearWatchdog() {
    clearTimeout(this.watchdog);
    this.watchdog = null;
  }

  armWatchdog(current) {
    this.clearWatchdog();
    this.watchdog = setTimeout(() => {
      if (this.client === current) this.fail(current, "WhatsApp loading timed out; retrying");
    }, this.startupMs);
  }

  async release() {
    const current = this.client;
    this.client = null;
    this.clearWatchdog();
    if (current) {
      try {
        await current.destroy();
      } catch (err) {
        console.error("[WhatsApp] Could not close browser:", err);
      }
    }
  }

  fail(current, message, err) {
    if (this.client !== current || this.stopped) return;
    if (err) console.error("[WhatsApp]", message, err);
    this.error = message;
    this.phase = "error";
    this.qrCode = null;
    this.pairingCode = null;
    this.pairingNumber = null;
    if (this.retryTimer) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.restarting = this.release().then(() => {
        if (!this.switching) this.launch();
      }).finally(() => {
        this.restarting = null;
      });
    }, this.retryMs);
  }

  async requestPairingCode(phoneNumber) {
    if (!/^\d{8,15}$/.test(phoneNumber)) throw new Error("Enter an international phone number (digits only)");
    if (this.getStatus().ready || this.phase === "authenticated") throw new Error("WhatsApp is already linked");
    if (this.switching) throw new Error("Phone pairing is already starting");
    this.switching = (async () => {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
      this.pairingNumber = phoneNumber;
      this.error = null;
      this.phase = "starting";
      this.qrCode = null;
      this.pairingCode = null;
      if (this.restarting) await this.restarting;
      await this.release();
      this.launch();
    })();
    try {
      await this.switching;
    } finally {
      this.switching = null;
    }
  }

  recover(reason) {
    if (this.client) this.fail(this.client, "WhatsApp browser error; reconnecting", reason);
  }

  async stop() {
    this.stopped = true;
    clearTimeout(this.retryTimer);
    this.retryTimer = null;
    if (this.restarting) await this.restarting;
    await this.release();
  }

  async sendToAll(message, photoPaths = []) {
    if (!this.getStatus().ready) throw new Error("WhatsApp client is not ready yet");
    if (!contacts.length) throw new Error("No contacts configured");
    if (photoPaths.length !== 0 && photoPaths.length !== 2) throw new Error("Exactly two photos must be provided");
    const photos = photoPaths.map((file) => this.MediaClass.fromFilePath(file));
    const results = [];
    for (const number of contacts) {
      const chatId = `${number}@c.us`;
      try {
        await this.client.sendMessage(chatId, message);
      } catch (err) {
        console.error("[WhatsApp] Message failed:", err);
        results.push({ number, success: false, error: err.message });
        continue;
      }
      let photoError;
      try {
        for (const photo of photos) await this.client.sendMessage(chatId, photo);
      } catch (err) {
        console.error("[WhatsApp] Photo failed:", err);
        photoError = err.message;
      }
      results.push({ number, success: true, ...(photoError ? { photoError } : {}) });
    }
    return results;
  }

  async sendToSingle(number, message) {
    if (!this.getStatus().ready) throw new Error("WhatsApp client is not ready yet");
    if (!/^\d{8,15}$/.test(number)) throw new Error("Enter an international phone number (digits only)");
    await this.client.sendMessage(`${number}@c.us`, message);
    return { number, success: true };
  }
}

const whatsapp = new WhatsAppService();
module.exports = {
  WhatsAppService,
  start: () => whatsapp.start(),
  stop: () => whatsapp.stop(),
  recover: (reason) => whatsapp.recover(reason),
  getStatus: () => whatsapp.getStatus(),
  requestPairingCode: (number) => whatsapp.requestPairingCode(number),
  sendToAll: (message, photos) => whatsapp.sendToAll(message, photos),
  sendToSingle: (number, message) => whatsapp.sendToSingle(number, message),
};
