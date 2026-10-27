// Template file, zero-change mechanism code; APP_ID is read from template.config.js.
const config = require("../../template.config");
const cloudConfig = require("../config/cloud");
const CLIENT_LOG_URL = `https://${cloudConfig.douyin.serviceId}-${cloudConfig.douyin.envId}.service.douyincloud.run/api/clientLog`;

function stringifyDetail(detail) {
  try { return String(typeof detail === "string" ? detail : JSON.stringify(detail) || "unknown").slice(0, 2048); }
  catch (error) { return String(detail || "unknown").slice(0, 2048); }
}

function reportError(tag, detail) {
  try {
    const api = typeof tt !== "undefined" ? tt : typeof wx !== "undefined" ? wx : null;
    if (!api || typeof api.request !== "function") return;
    api.request({
      url: CLIENT_LOG_URL,
      method: "POST",
      header: { "content-type": "application/json" },
      data: { appId: config.appId, tag: String(tag || "unknown").slice(0, 128), detail: stringifyDetail(detail) },
      timeout: 5000,
      fail: () => {},
    });
  } catch (error) {}
}

module.exports = { reportError };
