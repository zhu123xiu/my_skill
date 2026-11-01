// Template file, zero-change mechanism code; business values come from config.
const config = require("./template.config");
const { initCloud, callFunction } = require("./core/utils/cloud");
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
  globalData: {
    config,
    mockMode: false,
    // 客服通道/imId：云库拉取覆盖，失败用 template.config 兜底（换通道/换号不提审）。
    contact: config.contact || { channel: "byteHi", imId: "" },
    imId: config.imId || "",
  },
  onLaunch() {
    if (typeof tt !== "undefined" && typeof wx === "undefined") globalThis.wx = tt;
    initCloud()
      .then(() => this.fetchGlobalConfig())
      .catch((error) => console.warn("cloud init skipped", error));
  },
  // 拉取服务端全局配置（services/config.js getGlobal → {prefix}app_config/global）。
  fetchGlobalConfig() {
    return callFunction({ name: "config", data: { action: "getGlobal" } })
      .then((res) => {
        const contact = res && res.result && res.result.data && res.result.data.contact;
        if (!contact) return;
        const next = Object.assign({}, this.globalData.contact);
        if (contact.channel) next.channel = contact.channel;
        if (contact.imId) next.imId = contact.imId;
        this.globalData.contact = next;
        if (contact.imId) this.globalData.imId = contact.imId;
      })
      .catch(() => {});
  },
});