// Template configuration. Keep mechanism code unchanged; put business values here.
module.exports = {
  appId: "{{APP_ID}}",
  appName: "{{APP_NAME}}",
  collectionPrefix: "{{COLLECTION_PREFIX}}",
  imId: "{{IM_ID}}",
  // 客服通道：★ 首发 byteHi（飞鸽，平台托管、无需 imId、无接待端在线要求）；
  // 上线后改 "im"（配合云库 app_config/global 配置可不提审切换）。imId 为云库拉取失败时的兜底值。
  contact: {
    channel: "byteHi",
    imId: "",
  },
  homePage: "/business/pages/index/index",
  douyin: {
    envIdDev: "{{ENV_ID_DEV}}",
    envIdProd: "{{ENV_ID_PROD}}",
    resourceEnv: "{{RESOURCE_ENV}}",
    serviceId: "{{SERVICE_ID}}",
    serviceName: "api",
  },
  wechat: { functionEnv: "" },
};
