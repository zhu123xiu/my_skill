const menus = require("../../../business/menus");
const config = require("../../../template.config");

Page({
  data: {
    menus: Array.isArray(menus) ? menus : [],
    appName: config.appName || "",
    imId: config.imId || "",
  },

  onShow() {
    this.setData({ imId: config.imId || "" });
  },

  onMenuTap(event) {
    const item = event.currentTarget.dataset.item;
    if (!item) return;
    if (item.action === "customer_service") return;
    if (item.url) {
      wx.navigateTo({ url: item.url });
      return;
    }
    const routeMap = {
      orders: "/core/shell/orders/index",
      feedback: "/core/shell/feedback/index",
      about: "/core/shell/protocol/index",
      purchase_terms: "/core/shell/purchase-terms/index",
    };
    const url = routeMap[item.action];
    if (url) {
      wx.navigateTo({ url });
    } else {
      wx.showToast({ title: item.label || "", icon: "none" });
    }
  },

  onByteHiContact(event) {
    const detail = (event && event.detail) || {};
    if (detail.errNo === undefined || Number(detail.errNo) === 0) {
      return;
    }
    wx.showModal({
      title: "客服暂不可用",
      content: "请通过「意见反馈」留言，我们会尽快处理。",
      showCancel: false,
      confirmText: "去反馈",
      success: () => {
        wx.navigateTo({ url: "/core/shell/feedback/index" });
      },
    });
  },
});
