// 模板文件，零改动使用；业务值在 {prefix}app_config 的 global 文档。
// 极简全局配置服务：端启动拉取 contact.channel / imId，云库改值不提审（R8-3）。
// 读档失败静默返回空，端用 template.config.js 兜底。
const cloud = require("../core/wx-compat");
const config = require("../template.config");

const db = cloud.database();
const P = config.collectionPrefix || "";
const CONFIG_COLLECTION = P + "app_config";

exports.main = async (event) => {
  const action = (event && event.action) || "getGlobal";
  if (action !== "getGlobal") {
    return { success: false, message: "未知 action: " + action };
  }
  let data = {};
  try {
    const res = await db.collection(CONFIG_COLLECTION).doc("global").get();
    data = (res && res.data) || {};
  } catch (_error) {
    data = {};
  }
  // 只下发非敏感的前端配置字段。
  const contact = data.contact || {};
  return {
    success: true,
    data: { contact: { channel: contact.channel || "", imId: contact.imId || "" } },
  };
};