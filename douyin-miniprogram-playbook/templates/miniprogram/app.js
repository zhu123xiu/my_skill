// Template file, zero-change mechanism code; business values come from config.
const config = require("./template.config");
const { initCloud } = require("./core/utils/cloud");
const { reportError } = require("./core/utils/error-report");

App({
  onError(message) { reportError("app.onError", message); },
  onUnhandledRejection(result) {
    reportError("unhandledRejection", result && result.reason ? result.reason : "unknown");
  },
  onPageNotFound(result) {
    reportError("pageNotFound", result && result.path ? result.path : "");
    const api = typeof tt !== "undefined" ? tt : typeof wx !== "undefined" ? wx : null;
    if (api && typeof api.reLaunch === "function") api.reLaunch({ url: config.homePage });
  },
  globalData: { config, mockMode: false },
  onLaunch() {
    if (typeof tt !== "undefined" && typeof wx === "undefined") globalThis.wx = tt;
    initCloud().catch((error) => console.warn("cloud init skipped", error));
  },
});
