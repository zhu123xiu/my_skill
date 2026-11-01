// 模板文件，零改动使用。端上支付机制（抽取自亲子 miniprogram/config/payment.js，去业务化）。
// 商品价格一律以服务端为准（server core/pricing.js / payment.products），前端只展示。
// 本文件不硬编码商品表（PAYMENT_PRODUCTS 不进 core）；价格从 /api/pay createOrder 返回
// 或服务端配置接口拉取，端上不做任何价格决策。
const FORCE_SANDBOX_FOR_DEBUG = false;

function isIos() {
  try {
    const api = typeof tt !== "undefined" ? tt : wx;
    return api.getSystemInfoSync().platform === "ios";
  } catch (error) {
    return false;
  }
}

// iOS 拦截：苹果侧虚拟支付限制，引导用户改用激活码。
// 原因文案见 templates/snippets/compliance-texts.md（提审前按平台最新要求核对）。
function canPurchase() {
  const ios = isIos();
  return { allowed: !ios, reason: ios ? "iOS 暂不支持购买，请使用激活码" : "" };
}

// 调起支付：tt.requestOrder（预下单）→ tt.getOrderPayment（轮询支付结果）。
// preorderResult 来自服务端 /api/pay { action: "createOrder" } 的 { data, byteAuthorization }。
function requestPay(preorderResult) {
  if (typeof tt === "undefined" || typeof tt.requestOrder !== "function") {
    return Promise.reject(new Error("当前抖音版本暂不支持交易系统支付"));
  }
  return new Promise((resolve, reject) => {
    tt.requestOrder({
      data: preorderResult.data,
      byteAuthorization: preorderResult.byteAuthorization,
      success(result) {
        tt.getOrderPayment({
          orderId: result.orderId,
          success: resolve,
          fail: (error) => reject(new Error((error && error.errMsg) || "支付未完成")),
        });
      },
      fail: (error) =>
        reject(new Error((error && (error.errMsg || error.err_tips)) || "预下单失败")),
    });
  });
}

// 沙箱判断：抖音运行时恒为 0（正式）；仅微信调试且开关开启时 develop 落沙箱 1。
function getPaymentEnv() {
  if (typeof tt !== "undefined") return 0;
  if (FORCE_SANDBOX_FOR_DEBUG) {
    try {
      const accountInfo = wx.getAccountInfoSync();
      if (accountInfo.miniProgram.envVersion === "develop") return 1;
    } catch (error) {}
  }
  return 0;
}

module.exports = { canPurchase, getPaymentEnv, requestPay };