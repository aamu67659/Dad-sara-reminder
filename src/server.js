const express = require("express");
const path = require("path");
const fs = require("fs");
const { randomUUID, timingSafeEqual } = require("crypto");
const QRCode = require("qrcode");
const { getStatus, sendToAll, sendToSingle, getEvents } = require("./whatsapp");
const { runReminder } = require("./scheduler");
const { contacts, sendTime, timezone, port, photoDir } = require("./config");
const { getDateKey, getMessageForDate, isReminderDay, messages } = require("./messages");
const { getPhotoFiles } = require("./photos");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/health", (req, res) => {
  const { ready } = getStatus();
  res.json({ status: "ok", whatsappReady: ready });
});

app.get("/api/status", (req, res) => {
  const status = getStatus();
  const now = new Date();
  res.json({
    whatsappReady: status.ready,
    authenticating: status.authenticating,
    connectionError: status.connectionError,
    hasQr: status.hasQr,
    contacts,
    sendTime,
    timezone,
    today: getDateKey(now),
    isReminderDay: isReminderDay(now),
    todaysMessage: getMessageForDate(now),
    contactsConfigured: contacts.length,
    photosAvailable: getPhotoFiles().length,
  });
});

app.get("/api/qr", async (req, res) => {
  const { qrCode, hasQr } = getStatus();
  if (!hasQr) {
    return res.json({ qr: null });
  }
  try {
    const dataUrl = await QRCode.toDataURL(qrCode, { width: 300 });
    res.json({ qr: dataUrl });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate QR image" });
  }
});

app.get("/api/messages", (req, res) => {
  const list = Object.entries(messages).map(([key, text]) => {
    const [, month, day] = key.split("-").map(Number);
    return { date: key, month, day, text };
  });
  res.json(list);
});

app.post("/api/photos", (req, res, next) => {
  const token = process.env.PHOTO_UPLOAD_TOKEN;
  if (!token || token.length < 16) {
    return res.status(503).json({ error: "Set PHOTO_UPLOAD_TOKEN in Render to enable uploads" });
  }
  const provided = Buffer.from(req.get("X-Photo-Token") || "");
  const expected = Buffer.from(token);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return res.status(401).json({ error: "Invalid upload token" });
  }
  next();
}, express.raw({ type: ["image/jpeg", "image/png"], limit: "10mb" }), (req, res) => {
  const image = req.body;
  const isJpeg = req.is("image/jpeg") && Buffer.isBuffer(image) &&
    image.length >= 3 && image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff;
  const isPng = req.is("image/png") && Buffer.isBuffer(image) &&
    image.length >= 8 && image.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"));
  if (!isJpeg && !isPng) {
    return res.status(415).json({ error: "Upload a JPG or PNG photo" });
  }
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

app.post("/api/test-send", async (req, res) => {
  const { number, message } = req.body;
  const text = message || "Test message from Mom's Birthday Reminder app.";
  try {
    if (number) {
      const result = await sendToSingle(number, text);
      res.json({ success: true, result });
    } else {
      const results = await sendToAll(text);
      res.json({ success: true, results });
    }
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post("/api/run-reminder", async (req, res) => {
  try {
    await runReminder();
    res.json({ success: true, message: "Reminder run triggered. Check logs for details." });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

function start() {
  return app.listen(port, "0.0.0.0", () => {
    console.log(`[Server] Dashboard running on port ${port}`);
  });
}

module.exports = { start, app };
