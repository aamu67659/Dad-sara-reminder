const express = require("express");
const path = require("path");
const fs = require("fs");
const { randomUUID, timingSafeEqual } = require("crypto");
const QRCode = require("qrcode");
const { getStatus, sendToAll, sendToSingle, requestPairingCode } = require("./whatsapp");
const { runReminder } = require("./scheduler");
const { contacts, sendTime, timezone, port, photoDir } = require("./config");
const { getDateKey, getMessageForDate, isReminderDay, messages } = require("./messages");
const { getPhotoFiles } = require("./photos");

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "16kb" }));
app.use(express.static(path.join(__dirname, "..", "public"), { maxAge: 0 }));

function requireToken(name, header) {
  return (req, res, next) => {
    const token = process.env[name];
    if (!token || token.length < 16) {
      return res.status(503).json({ error: `Set ${name} in Render to enable this action` });
    }
    const supplied = Buffer.from(req.get(header) || "");
    const expected = Buffer.from(token);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      return res.status(401).json({ error: "Invalid access token" });
    }
    res.set("Cache-Control", "no-store");
    next();
  };
}

const requireAccess = requireToken("PAIRING_TOKEN", "X-Pairing-Token");
const requirePhotoAccess = requireToken("PHOTO_UPLOAD_TOKEN", "X-Photo-Token");

app.get("/health", (req, res) => {
  res.json({ status: "ok", whatsappReady: getStatus().ready });
});

app.get("/api/status", (req, res) => {
  const status = getStatus();
  const now = new Date();
  res.set("Cache-Control", "no-store");
  res.json({
    whatsappReady: status.ready,
    authenticating: status.authenticating,
    phase: status.phase,
    connectionError: status.connectionError,
    hasQr: status.hasQr,
    sendTime,
    timezone,
    today: getDateKey(now),
    isReminderDay: isReminderDay(now),
    todaysMessage: getMessageForDate(now),
    contactsConfigured: contacts.length,
    photosAvailable: getPhotoFiles().length,
  });
});

app.get("/api/qr", requireAccess, async (req, res) => {
  const { qrCode } = getStatus();
  if (!qrCode) return res.json({ qr: null });
  try {
    res.json({ qr: await QRCode.toDataURL(qrCode, { width: 300 }) });
  } catch (err) {
    console.error("[Server] QR generation failed:", err);
    res.status(500).json({ error: "Could not display the QR code" });
  }
});

app.post("/api/pairing-code", requireAccess, async (req, res) => {
  const number = req.body?.phoneNumber;
  if (typeof number !== "string" || !/^\d{8,15}$/.test(number)) {
    return res.status(400).json({ error: "Enter an international phone number (digits only)" });
  }
  try {
    await requestPairingCode(number);
    res.status(202).json({ pending: true });
  } catch (err) {
    console.error("[WhatsApp] Phone pairing failed:", err);
    res.status(409).json({ error: err.message });
  }
});

app.get("/api/pairing-code", requireAccess, (req, res) => {
  const { pairingCode, phase, ready, connectionError } = getStatus();
  res.json({ code: pairingCode, phase, ready, connectionError });
});

app.get("/api/messages", (req, res) => {
  res.json(Object.entries(messages).map(([key, text]) => {
    const [, month, day] = key.split("-").map(Number);
    return { date: key, month, day, text };
  }));
});

app.post("/api/photos", requirePhotoAccess, express.raw({ type: ["image/jpeg", "image/png"], limit: "10mb" }), (req, res) => {
  const image = req.body;
  const isJpeg = req.is("image/jpeg") && Buffer.isBuffer(image) &&
    image.length >= 3 && image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff;
  const isPng = req.is("image/png") && Buffer.isBuffer(image) &&
    image.length >= 8 && image.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"));
  if (!isJpeg && !isPng) return res.status(415).json({ error: "Upload a JPG or PNG photo" });
  try {
    fs.mkdirSync(photoDir, { recursive: true, mode: 0o700 });
    fs.writeFileSync(path.join(photoDir, `${randomUUID()}.${isJpeg ? "jpg" : "png"}`), image, {
      flag: "wx",
      mode: 0o600,
    });
    res.json({ success: true, photosAvailable: getPhotoFiles().length });
  } catch (err) {
    console.error("[Photos] Upload failed:", err);
    res.status(500).json({ error: "Could not save photo" });
  }
});

app.post("/api/test-send", requireAccess, async (req, res) => {
  const number = req.body?.number;
  const hasNumber = number !== undefined && number !== "";
  const suppliedMessage = req.body?.message;
  const message = suppliedMessage === undefined || suppliedMessage === ""
    ? "Test message from Mom's Birthday Reminder app."
    : suppliedMessage;
  if ((hasNumber && (typeof number !== "string" || !/^\d{8,15}$/.test(number))) ||
    typeof message !== "string" || message.length > 1000) {
    return res.status(400).json({ error: "Enter a valid number and message (1000 characters maximum)" });
  }
  try {
    const result = hasNumber ? await sendToSingle(number, message) : await sendToAll(message);
    res.json({ success: true, result });
  } catch (err) {
    res.status(409).json({ error: err.message });
  }
});

app.post("/api/run-reminder", requireAccess, async (req, res) => {
  try {
    res.json({ success: true, result: await runReminder() });
  } catch (err) {
    console.error("[Scheduler] Manual reminder failed:", err);
    res.status(409).json({ error: err.message });
  }
});

app.use("/api", (req, res) => res.status(404).json({ error: "API route not found" }));
app.use((err, req, res, next) => {
  if (err.status !== 400) console.error("[Server] Request failed:", err);
  res.status(err.status || 500).json({ error: err.status === 400 ? "Invalid request body" : "Request failed" });
});

function start() {
  return app.listen(port, "0.0.0.0", () => {
    console.log(`[Server] Dashboard running on port ${port}`);
  });
}

module.exports = { start, app };
