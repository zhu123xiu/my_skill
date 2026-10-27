// Template file, zero-change mechanism code.
function setCachedValue(key, value, ttlMs) { wx.setStorageSync(`cache:${key}`, { value, expiresAt: Date.now() + ttlMs }); }
function getCachedValue(key, fallback = null) {
  try { const item = wx.getStorageSync(`cache:${key}`); return item && item.expiresAt > Date.now() ? item.value : fallback; }
  catch (error) { return fallback; }
}
module.exports = { setCachedValue, getCachedValue };
