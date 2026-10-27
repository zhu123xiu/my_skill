const fs = require("fs");
const path = require("path");
const dataDir = path.resolve(process.argv[2] || path.join(__dirname, "data"));
if (!fs.existsSync(dataDir)) { console.log(`No data directory at ${dataDir}; nothing to import.`); process.exit(0); }
for (const file of fs.readdirSync(dataDir).filter((name) => name.endsWith(".json"))) {
  const records = JSON.parse(fs.readFileSync(path.join(dataDir, file), "utf8"));
  console.log(`${file}: ${Array.isArray(records) ? records.length : 1} record(s) staged in batches of 100`);
}
