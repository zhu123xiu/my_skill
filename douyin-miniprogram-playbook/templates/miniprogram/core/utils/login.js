// Template file, zero-change mechanism code.
function getLoginCode() {
  const api = typeof tt !== "undefined" ? tt : typeof wx !== "undefined" ? wx : null;
  if (!api || typeof api.login !== "function") return Promise.reject(new Error("login unavailable"));
  return new Promise((resolve, reject) => api.login({ success: resolve, fail: reject }));
}
module.exports = { getLoginCode };
