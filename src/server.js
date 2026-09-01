const express = require("express");
const path = require("path");
const QRCode = require("qrcode");
const { getStatus, sendToAll, sendToSingle, getEvents } = require("./whatsapp");
const { runReminder } = require("./scheduler");
const { contacts, sendTime, timezone, port } = require("./config");
const { getMessageForDate, isReminderDay, messages } = require("./messages");

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
    hasQr: status.hasQr,
    contacts,
    sendTime,
    timezone,
    today: now.toDateString(),
    isReminderDay: isReminderDay(now),
    todaysMessage: getMessageForDate(now),
    contactsConfigured: contacts.length,
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
    const [month, day] = key.split("-").map(Number);
    return { date: key, month, day, text };
  });
  res.json(list);
});

app.post("/api/test-send", async (req, res) => {
  const { number, message } = req.body;
  const text = message || "Test message from Dad's Remembrance Reminder app.";
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

module.exports = { start };
