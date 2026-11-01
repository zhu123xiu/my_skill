// 模板文件，零改动使用。默认可用的支付服务（createOrder/grant/激活码模板预置）。
// 商品与价格以数据库 products 集合为准（对齐亲子仓：商品文档携带 priceFen/grant），
// template.config.js 的 payment.products 仅作 seed 源与 DB 未灌数据时的兜底。
//   action: createOrder / redeemActivationCode / syncOrderStatus
// 导出 settleOrder / findOrderByTradeNo / onRefund 供 index.js 的
//   /api/pay/notify、/api/pay/syncOrderStatus 注入（index.js 已有委托逻辑）。
const cloud = require("../core/wx-compat");
const config = require("../template.config");
const payment = require("../core/payment");
const grant = require("../core/grant");
const notify = require("../core/notify");
const { getPricing } = require("../core/pricing");

const db = cloud.database();
const P = config.collectionPrefix || "";
const ORDERS = P + "orders";
const ACTIVATIONS = P + "activation_codes";
const PRODUCTS = P + "products";

function openid() {
  return cloud.getWXContext().OPENID || "";
}

function ok(data) {
  return Object.assign({ success: true }, data || {});
}

function fail(message, statusCode) {
  const error = new Error(message);
  if (statusCode) error.statusCode = statusCode;
  return error;
}

function products() {
  return (config.payment && config.payment.products) || [];
}

// 商品解析：数据库 products 集合优先（价格/权益入库，免发版调价，对齐亲子仓）；
// DB 未灌数据时回退 config.payment.products[]，保证模板开箱可用。
async function findProduct(itemId) {
  if (!itemId) return null;
  try {
    const res = await db.collection(PRODUCTS).where({ itemId, status: "online" }).limit(1).get();
    const doc = (res && res.data && res.data[0]) || null;
    if (doc) return Object.assign({ itemId }, doc);
  } catch (_error) {
    // 集合不存在/查询失败不抛，走 config 兜底
  }
  return products().find((p) => p.itemId === itemId) || null;
}

// 已购判定：按 grant.type 对应权益位；allCourses 视为覆盖一切单品。
function alreadyPurchased(profile, product) {
  const type = (product.grant && product.grant.type) || "";
  if (type === "all_courses") {
    return Boolean(profile.allCourses || profile.membershipActive || profile.activated);
  }
  if (type === "membership") {
    return Boolean(profile.membershipActive || profile.activated || profile.allCourses);
  }
  if (type === "package") {
    const target = (product.grant && product.grant.target) || product.itemId;
    return Boolean(profile.allCourses || (profile.unlockedPackages || []).includes(target));
  }
  return false;
}

// 商品标题清洗：去控制字符、压空白、限 256 字节（平台 sku.title 上限）。
function cleanTitle(value) {
  const text = String(value || "商品")
    .replace(/[\\\r\n]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  let result = "";
  for (const character of text) {
    const next = result + character;
    if (Buffer.byteLength(next, "utf8") > 256) break;
    result = next;
  }
  return result || "商品";
}

async function createOrder(event) {
  const uid = openid();
  if (!uid) throw fail("缺少抖音用户身份", 401);

  const itemId = event.itemId;
  const product = await findProduct(itemId);
  if (!product) throw fail("商品 itemId 非法", 400);

  const [profile, pricing] = await Promise.all([grant.getProfile(uid), getPricing()]);
  if (alreadyPurchased(profile, product)) return ok({ alreadyPurchased: true });

  // 金额服务端权威：商品表 priceFen 优先，回退 core/pricing.js；禁止信前端传价。
  const grantType = (product.grant && product.grant.type) || "";
  const amountFen =
    Number(product.priceFen) > 0
      ? Number(product.priceFen)
      : grantType === "package"
      ? pricing.packagePriceFen
      : pricing.membershipPriceFen;
  if (!(amountFen > 0)) throw fail("商品未配置价格（products 集合 priceFen 或 config.payment.products[]）", 400);

  // 标签组 ID 是进件产出值（平台分配，与 RSA 私钥同类），以 DB dy_payment 文档为准；
  // 仓库 payment 表仅作本地联调兜底。载入密钥：文档缺失视同未进件，
  // 交由下方校验给出干净的配置级 400（而非"无法签名"崩溃）。
  let secret = {};
  try { secret = await payment.loadDySecret(); } catch (_e) { secret = {}; }
  const tagGroup = secret.tagGroup || (config.payment && config.payment.tagGroup) || "";
  if (!tagGroup) throw fail("支付进件未完成（dy_payment.tagGroup 未配置）", 400);

  const outTradeNo = `DY${Date.now()}${Math.floor(Math.random() * 1000000)
    .toString()
    .padStart(6, "0")}`;
  const productName = product.title || itemId;
  const order = {
    outTradeNo,
    openid: uid,
    itemId,
    productName,
    goodsPrice: amountFen,
    grant: product.grant || {},
    paymentMode: "trade_basic",
    platform: "douyin",
    channel: "trade_basic",
    status: "pending",
    createdAt: db.serverDate(),
    updatedAt: db.serverDate(),
  };
  await db.collection(ORDERS).doc(outTradeNo).set({ data: order });

  // 💳 用户发起支付（订单落库后，fire-and-forget）
  notify.notifyDingTalk(
    "💳 用户发起支付",
    [
      `**商品**：${productName}`,
      `**金额**：${notify.fenToYuan(amountFen)}`,
      `**订单号**：${outTradeNo}`,
      `**时间**：${notify.nowText()}`,
    ].join("\n\n")
  );

  // 组装 skuParams（spec §6.2 源实现），签名走 core/payment.js。
  // secret（appId/appSecret/privateKeyPem/keyVersion + tagGroup）已在进件校验处载入，此处直接复用。
  const skuParams = {
    skuList: [
      {
        skuId: product.productId || itemId,
        price: amountFen,
        quantity: 1,
        title: cleanTitle(productName),
        imageList: product.image ? [product.image] : [],
        type: product.goodsType || 402,
        tagGroupId: product.tagGroupId || tagGroup,
      },
    ],
    outOrderNo: outTradeNo,
    totalAmount: amountFen,
    payExpireSeconds: 300,
    orderEntrySchema: {
      path: (config.payment && config.payment.orderEntryPath) || "core/shell/orders/index",
      params: "",
    },
    payNotifyUrl: process.env.PAY_NOTIFY_URL || "",
    limitPayWayList: [],
  };
  const preorder = payment.buildDyOrderParams(skuParams, {
    appId: secret.appId || config.appId || process.env.DOUYIN_APP_ID,
    privateKeyPem: secret.privateKeyPem,
    keyVersion: secret.keyVersion,
  });
  return ok({
    outTradeNo,
    data: preorder.data,
    byteAuthorization: preorder.byteAuthorization,
  });
}

// 激活码兑换：where+update 原子抢占（countUpdated 判 1 防并发），grant 走 R2 分发器。
async function resolveActivationGrant(activation) {
  if (activation.grant) return activation.grant;
  const product = activation.itemId ? await findProduct(activation.itemId) : null;
  if (product) return product.grant || {};
  const list = products();
  if (list.length === 1) return list[0].grant || {};
  return { type: "membership" };
}

async function redeemActivationCode(event) {
  const uid = openid();
  if (!uid) throw fail("缺少抖音用户身份", 401);
  const code = String(event.code || "").trim().toUpperCase();
  if (!code) throw fail("请输入激活码", 400);

  let activation = null;
  try {
    const res = await db.collection(ACTIVATIONS).doc(code).get();
    activation = res && res.data;
  } catch (_error) {
    activation = null;
  }
  if (!activation || activation.status !== "unused") {
    throw fail("激活码无效或已兑换", 400);
  }
  const claim = await db
    .collection(ACTIVATIONS)
    .where({ _id: code, status: "unused" })
    .update({
      data: { status: "redeemed", redeemedBy: uid, redeemedAt: db.serverDate() },
    });
  if (payment.countUpdated(claim) !== 1) throw fail("激活码无效或已兑换", 400);

  const pricing = await getPricing();
  const grantSpec = await resolveActivationGrant(activation);
  await grant.grantEntitlement({
    openid: uid,
    outTradeNo: `ACTIVATION-${code}`,
    itemId: activation.itemId || "",
    goodsPrice: activation.priceFen || pricing.membershipPriceFen,
    grant: grantSpec,
  });
  return ok({ status: "activated", grant: grantSpec });
}

// 按 outTradeNo 查订单，零业务逻辑（供 notify/sync 注入）。
async function findOrderByTradeNo(outTradeNo) {
  if (!outTradeNo) return null;
  const res = await db.collection(ORDERS).where({ outTradeNo }).limit(1).get();
  return (res.data && res.data[0]) || null;
}

// 结算 + 💰 支付成功通知（仅首次入账触发，幂等靠 pending→paid 条件更新）。
async function settleOrder(order, opts = {}) {
  return grant.settlePaidOrder(
    order,
    Object.assign({}, opts, {
      onGranted: (paidOrder) => {
        const tail = String(paidOrder.openid || "").slice(-6);
        notify.notifyDingTalk(
          "💰 支付成功",
          [
            `**商品**：${paidOrder.productName || paidOrder.itemId || ""}`,
            `**金额**：${notify.fenToYuan(paidOrder.goodsPrice)}`,
            `**订单号**：${paidOrder.outTradeNo}`,
            `**用户**：…${tail}`,
            `**时间**：${notify.nowText()}`,
          ].join("\n\n")
        );
      },
    })
  );
}

// ↩️ 退款成功通知挂点（core/payment.js payNotifyHandler 的 onRefund 注入）。
// 退款字段未实证，附回调原文 JSON 截断 500 字符兜底，供首单核对。
function onRefund(message, rawBody) {
  try {
    const m = message || {};
    const outOrderNo = m.out_order_no || m.outOrderNo || "";
    const refundNo = m.refund_order_no || m.refundOrderNo || m.order_id || "";
    const amount = m.refund_amount !== undefined ? m.refund_amount : m.total_amount;
    const raw = JSON.stringify(rawBody || m).slice(0, 500);
    notify.notifyDingTalk(
      "↩️ 退款成功",
      [
        `**订单号**：${outOrderNo}`,
        `**退款单号**：${refundNo}`,
        `**金额**：${amount !== undefined ? notify.fenToYuan(amount) : "未知"}`,
        `**时间**：${notify.nowText()}`,
        `**回调原文**：${raw}`,
      ].join("\n\n")
    );
  } catch (_) {}
}

exports.main = async (event) => {
  const action = (event && (event.action || event.type)) || "";
  switch (action) {
    case "createOrder":
      return createOrder(event || {});
    case "redeemActivationCode":
      return redeemActivationCode(event || {});
    case "syncOrderStatus": {
      const outOrderNo = String((event && event.outOrderNo) || "").trim();
      const result = await payment.syncOrderStatusHandler(outOrderNo, {
        settleOrder,
        findOrderByTradeNo,
      });
      return ok(result);
    }
    default:
      throw fail("未知支付操作: " + action, 400);
  }
};

exports.settleOrder = settleOrder;
exports.findOrderByTradeNo = findOrderByTradeNo;
exports.onRefund = onRefund;