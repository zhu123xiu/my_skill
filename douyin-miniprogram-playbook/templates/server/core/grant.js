// 模板文件，零改动使用；业务值在 template.config.js
// grant 分发器（兑现 spec §6.3「三种 grant.type 入账写法预置在模板，config 驱动」）。
// 按订单携带的 grant.type 把已支付订单入账到 {prefix}profiles，机制层零业务耦合：
//   "membership"  → activated/membershipActive/membershipName/membershipPurchasedAt 等会员字段
//   "package"     → unlockedPackages 数组追加 grant.target（缺省取 order.itemId）
//   "all_courses" → allCourses: true（单 SKU 全量解锁，如社恐场景）
const cloud = require("./wx-compat");
const config = require("../template.config");
const { countUpdated } = require("./payment");

const db = cloud.database();
const P = config.collectionPrefix || "";
const PROFILES = P + "profiles";
const ORDERS = P + "orders";

async function getProfile(openid) {
  if (!openid) return {};
  const res = await db.collection(PROFILES).doc(openid).get().catch(() => null);
  return (res && res.data) || {};
}

// 写档前必读档（services/README.md 规则 3：全量 set 前必须先 get 成功，防清库）。
async function saveProfile(openid, patch) {
  const current = await getProfile(openid);
  const profile = Object.assign({}, current, patch, {
    createdAt: (current && current.createdAt) || db.serverDate(),
    updatedAt: db.serverDate(),
  });
  delete profile._id;
  delete profile._openid;
  await db.collection(PROFILES).doc(openid).set({ data: profile });
}

async function grantEntitlement(order) {
  const grant = order.grant || {};
  const type = grant.type;
  const openid = order.openid;
  const log = { outTradeNo: order.outTradeNo, openid, type };
  try {
    if (type === "membership") {
      await saveProfile(openid, {
        activated: true,
        membershipActive: true,
        membershipName: (config.membership && config.membership.name) || "",
        membershipPriceFen: order.goodsPrice,
        membershipPurchasedAt: db.serverDate(),
        lastOrderNo: order.outTradeNo,
      });
    } else if (type === "package") {
      const target = grant.target || order.itemId;
      const profile = await getProfile(openid);
      const unlockedPackages = Array.isArray(profile.unlockedPackages)
        ? profile.unlockedPackages.slice()
        : [];
      if (target && !unlockedPackages.includes(target)) unlockedPackages.push(target);
      await saveProfile(openid, { unlockedPackages, lastOrderNo: order.outTradeNo });
    } else if (type === "all_courses") {
      await saveProfile(openid, {
        allCourses: true,
        activated: true,
        lastOrderNo: order.outTradeNo,
      });
    } else {
      throw new Error("未知 grant.type: " + type);
    }
    console.error("[grant]", JSON.stringify({ ...log, success: true }));
  } catch (error) {
    console.error(
      "[grant]",
      JSON.stringify({ ...log, success: false, error: (error && error.message) || "unknown" })
    );
    throw error;
  }
}

// 结算骨架：金额二次校验 → where(outTradeNo, status=pending).update 原子幂等更新
//   （countUpdated !== 1 直接返回 true 幂等）→ 按 grant.type 分发入账。
// onGranted 仅在首次入账成功后触发一次（供支付成功通知挂点）；幂等重入不触发。
async function settlePaidOrder(order, { orderId = "", totalAmount, onGranted } = {}) {
  if (!order || order.status === "paid" || order.status === "delivered") return true;
  if (totalAmount !== undefined && Number(totalAmount) !== Number(order.goodsPrice)) {
    return false;
  }
  const upd = await db
    .collection(ORDERS)
    .where({ outTradeNo: order.outTradeNo, status: "pending" })
    .update({
      data: {
        status: "paid",
        paidAt: db.serverDate(),
        dyOrderId: orderId || "",
        updatedAt: db.serverDate(),
      },
    });
  if (countUpdated(upd) !== 1) return true;
  await grantEntitlement(order);
  if (typeof onGranted === "function") {
    try {
      onGranted(order);
    } catch (_) {}
  }
  return true;
}

module.exports = { grantEntitlement, settlePaidOrder, getProfile, saveProfile };