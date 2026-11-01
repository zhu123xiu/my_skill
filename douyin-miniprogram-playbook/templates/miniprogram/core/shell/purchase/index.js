// 模板文件，零改动使用。通用购买 + 激活码兑换壳页（去业务化）。
// 商品与价格来自服务端 /api/config getProducts（DB products 集合为准）；端不做价格决策。
// 安卓走 createOrder → requestPay；iOS 或支付不可用时引导激活码兑换。
const { callFunction } = require("../../utils/cloud");
const pay = require("../../utils/pay");

function unwrap(res) {
  const result = res && res.result;
  if (!result || result.success === false) {
    throw new Error((result && result.message) || "服务返回异常");
  }
  return result;
}

async function call(name, data) {
  const res = await callFunction({ name, data });
  return unwrap(res);
}

Page({
  data: {
    loading: true,
    products: [],
    canBuy: true,
    buyReason: "",
    code: "",
    busy: false,
  },

  onLoad() {
    const gate = pay.canPurchase();
    this.setData({ canBuy: gate.allowed, buyReason: gate.reason });
    this.loadProducts();
  },

  async loadProducts() {
    this.setData({ loading: true });
    try {
      const res = await call("config", { action: "getProducts" });
      const products = (res.data && res.data.products) || [];
      this.setData({ products, loading: false });
    } catch (error) {
      this.setData({ loading: false });
      wx.showToast({ title: error.message || "商品加载失败", icon: "none" });
    }
  },

  onInputCode(e) {
    this.setData({ code: (e.detail && e.detail.value) || "" });
  },

  // 购买：createOrder → requestPay → 成功后查单兜底并提示。
  async onBuy(e) {
    if (this.data.busy) return;
    const itemId = e.currentTarget.dataset.id;
    if (!this.data.canBuy) {
      wx.showModal({
        title: "暂不支持购买",
        content: this.data.buyReason || "请使用激活码兑换",
        showCancel: false,
      });
      return;
    }
    this.setData({ busy: true });
    try {
      const order = await call("pay", {
        action: "createOrder",
        itemId,
        env: pay.getPaymentEnv(),
      });
      if (order.alreadyPurchased) {
        wx.showToast({ title: "你已拥有该权益", icon: "none" });
        return;
      }
      await pay.requestPay(order);
      // 支付结果以服务端为准：主动查单一次兜底（回调可能稍后到达）。
      try {
        await call("pay", { action: "syncOrderStatus", outOrderNo: order.outTradeNo });
      } catch (_e) {
        /* 查单失败不阻断，回调会补发 */
      }
      wx.showToast({ title: "支付成功", icon: "success" });
      setTimeout(() => this.loadProducts(), 800);
    } catch (error) {
      wx.showModal({
        title: "支付未完成",
        content: (error && error.message) || "请稍后重试或使用激活码",
        showCancel: false,
      });
    } finally {
      this.setData({ busy: false });
    }
  },

  // 激活码兑换：redeemActivationCode → grant 走服务端分发器。
  async onRedeem() {
    if (this.data.busy) return;
    const code = (this.data.code || "").trim();
    if (!code) {
      wx.showToast({ title: "请输入激活码", icon: "none" });
      return;
    }
    this.setData({ busy: true });
    try {
      await call("pay", { action: "redeemActivationCode", code });
      this.setData({ code: "" });
      wx.showToast({ title: "兑换成功", icon: "success" });
      setTimeout(() => this.loadProducts(), 800);
    } catch (error) {
      wx.showModal({
        title: "兑换失败",
        content: (error && error.message) || "激活码无效或已使用",
        showCancel: false,
      });
    } finally {
      this.setData({ busy: false });
    }
  },

  goOrders() {
    wx.navigateTo({ url: "/core/shell/orders/index" });
  },
});
