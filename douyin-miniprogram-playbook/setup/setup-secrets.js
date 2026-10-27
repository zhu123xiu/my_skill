const fs = require("fs");
const path = require("path");
const config = require("../templates/server/template.config");
const file = path.join(__dirname, ".secrets.local.json");
if (!fs.existsSync(file)) throw new Error("missing setup/.secrets.local.json");
const secrets = JSON.parse(fs.readFileSync(file, "utf8"));
console.log(`ready to write ${Object.keys(secrets).length} secret fields to ${config.collectionPrefix}${config.collections.find((item) => item.name === "platform_secrets")?.name || "platform_secrets"}`);
console.log("No secret values are printed. Connect this script to the approved database environment before running it.");
