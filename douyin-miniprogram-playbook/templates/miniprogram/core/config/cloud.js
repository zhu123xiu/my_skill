// Template file, zero-change mechanism code. Values live in ../template.config.js.
const config = require("../../template.config");

function resolveEnvType() {
  try {
    if (typeof tt !== "undefined" && typeof tt.getEnvInfoSync === "function") {
      const info = tt.getEnvInfoSync();
      return info && info.microapp && info.microapp.envType;
    }
  } catch (error) {}
  return "development";
}

function resolveEnvId() {
  return resolveEnvType() === "production"
    ? config.douyin.envIdProd
    : config.douyin.envIdDev;
}

module.exports = {
  useSharedCloud: false,
  resourceEnv: config.douyin.resourceEnv,
  douyin: {
    envId: resolveEnvId(),
    serviceId: config.douyin.serviceId,
    serviceName: config.douyin.serviceName,
  },
  mockOnly: false,
};
