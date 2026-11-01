// 模板文件，零改动使用；业务值在 {prefix}app_config 的 global 文档与 {prefix}products 集合。
// 极简配置服务：
//   getGlobal   —— 端启动拉取 contact.channel / imId，云库改值不提审（R8-3）。
//   getProducts —— 端商品列表拉取在线商品（价格以 products 集合为准，DB 空则回退 config.payment.products[]）。
// 读档失败静默返回空/兜底，端用 template.config.js 兜底。
const cloud = require("../core/wx-compat");
const config = require("../template.config");

const db = cloud.database();
const P = config.collectionPrefix || "";
const CONFIG_COLLECTION = P + "app_config";
const PRODUCTS = P + "products";

async function getGlobal() {
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
}

// 商品列表：DB products 集合优先（含 priceFen/title/grant），空则回退 config 兜底。
async function getProducts() {
  let list = [];
  try {
    const res = await db.collection(PRODUCTS).where({ status: "online" }).limit(100).get();
    list = res && res.data;
  } catch (_error) {
    list = [];
  }
  if (!list || !list.length) {
    list = ((config.payment && config.payment.products) || []).map((p) =>
      Object.assign({ status: "online" }, p)
    );
  }
  // 只下发端需要展示的字段，价格随商品文档返回。
  const products = list.map((p) => ({
    itemId: p.itemId,
    title: p.title,
    priceFen: Number(p.priceFen) || 0,
    priceLabel: p.priceFen ? "¥" + (Number(p.priceFen) / 100).toFixed(2) : "",
    desc: p.desc || "",
  }));
  return { success: true, data: { products } };
}

exports.main = async (event) => {
  const action = (event && event.action) || "getGlobal";
  if (action === "getGlobal") return getGlobal();
  if (action === "getProducts") return getProducts();
  return { success: false, message: "未知 action: " + action };
};