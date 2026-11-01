const menus = require("../../../business/menus");
const config = require("../../../template.config");

Page({
  data: {
    menus: Array.isArray(menus) ? menus : [],
    appName: config.appName || "",
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
});