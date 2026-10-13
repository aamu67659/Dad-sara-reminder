const fs = require("fs");
const path = require("path");

const marker = "        // Bot's won't reply if canonicalUrl is set (linking)";
const anchor = `            ...extraOptions,\n        };\n\n${marker}`;
const fix = "        delete message.__x_id;";

function patchSource(source) {
  if (source.includes(fix)) return source;
  if (!source.includes(anchor)) throw new Error("whatsapp-web.js media send code has changed; review the media ID patch");
  return source.replace(anchor, `            ...extraOptions,\n        };\n\n${fix}\n\n${marker}`);
}

function applyPatch() {
  const packageDirectory = path.dirname(require.resolve("whatsapp-web.js/package.json"));
  const file = path.join(packageDirectory, "src", "util", "Injected", "Utils.js");
  const source = fs.readFileSync(file, "utf8");
  const patched = patchSource(source);
  if (patched !== source) fs.writeFileSync(file, patched);
}

if (require.main === module) applyPatch();

module.exports = { patchSource };
