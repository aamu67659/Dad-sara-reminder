const whatsapp = require("./whatsapp");
const scheduler = require("./scheduler");
const server = require("./server");
const { contacts, port } = require("./config");

process.on("uncaughtExceptionMonitor", (error) => {
  console.error("[Process] Fatal error:", error);
});
process.on("unhandledRejection", (error) => {
  console.error("[Process] Unhandled rejection:", error);
  whatsapp.recover(error);
});

console.log("=== Mom's Anniversary Reminder ===");
console.log(`Contacts configured: ${contacts.length}`);
console.log(`Dashboard port: ${port}`);

const httpServer = server.start();
scheduler.start();
whatsapp.start();

async function shutdown() {
  scheduler.stop();
  const deadline = setTimeout(() => process.exit(1), 10000);
  deadline.unref();
  try {
    await whatsapp.stop();
    await new Promise((resolve) => httpServer.close(resolve));
  } finally {
    clearTimeout(deadline);
  }
}

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
