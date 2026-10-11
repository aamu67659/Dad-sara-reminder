const { getClient } = require("./whatsapp");
const { start: startScheduler } = require("./scheduler");
const { start: startServer } = require("./server");
const { contacts, port } = require("./config");

console.log("=== Mom's Birthday Reminder ===");
console.log(`Contacts configured: ${contacts.length}`);
console.log(`Dashboard port: ${port}`);

getClient();

startScheduler();

startServer();
