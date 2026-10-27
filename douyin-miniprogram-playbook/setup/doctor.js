const fs = require("fs");
const path = require("path");
const config = require("../templates/server/template.config");

const root = path.resolve(__dirname, "..");
const secretsPath = path.join(__dirname, ".secrets.local.json");
const checks = [];
function check(name, ok, hint) { checks.push({ name, ok, hint }); }

check("server config has no unresolved placeholders", !JSON.stringify(config).includes("{{"), "edit template.config.js");
check("secrets file exists", fs.existsSync(secretsPath), "copy .secrets.local.json.example");
if (fs.existsSync(secretsPath)) {
  try {
    const secrets = JSON.parse(fs.readFileSync(secretsPath, "utf8"));
    for (const key of ["TCB_SECRET_ID", "TCB_SECRET_KEY", "TCB_ENV"]) check(`secret ${key}`, Boolean(secrets[key]), `fill ${key} without printing it`);
  } catch (error) { check("secrets JSON parses", false, "fix JSON syntax"); }
}
for (const item of checks) console.log(`${item.ok ? "✔" : "✘"} ${item.name}${item.ok ? "" : ` — ${item.hint}`}`);
process.exitCode = checks.every((item) => item.ok) ? 0 : 1;
