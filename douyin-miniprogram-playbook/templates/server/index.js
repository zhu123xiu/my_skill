const express = require("express");
const config = require("./template.config");
const cloud = require("./core/wx-compat");

const app = express();
app.use(express.json({ limit: "1mb" }));

function requesterOpenid(request) {
  return String(request.get("x-tt-openid") || request.body.openid || "").trim();
}

function loadService(name) {
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) return null;
  try { return require(`./services/${name}`); } catch (error) { return null; }
}

app.get("/health", (_request, response) => response.json({ ok: true }));
app.post("/api/:name", async (request, response) => {
  const service = loadService(request.params.name);
  if (!service || typeof service.main !== "function") return response.status(501).json({ error: "service_not_found" });
  const openid = requesterOpenid(request);
  try {
    const result = await cloud.runWithOpenid(openid, () => service.main(request.body || {}, {}));
    response.json(result || { success: true });
  } catch (error) {
    console.error("service error", request.params.name, error.message);
    response.status(500).json({ error: "internal_error" });
  }
});

const port = Number(process.env.PORT || 3000);
if (require.main === module) app.listen(port, () => console.log(`server listening on ${port}`));
module.exports = app;
