// 模板文件，零改动使用。客服接入组件：三形态（float/menu-row/button）+ 双通道（byteHi/im）。
// 通道与 imId 走「云库配置 + 代码兜底」：props 留空时读 globalData.contact（app.js 云库拉取覆盖），
// 再兜底 template.config.js。换通道、换客服号均不提审。
const config = require("../../../template.config");

Component({
  properties: {
    channel: { type: String, value: "" }, // "byteHi" | "im"，缺省读全局配置
    imId: { type: String, value: "" }, // channel=im 时生效，缺省读 globalData.imId
    shape: { type: String, value: "button" }, // "float" | "menu-row" | "button"
    text: { type: String, value: "联系客服" },
    desc: { type: String, value: "咨询与售后问题，点此即时沟通" },
  },

  data: { effChannel: "byteHi", effImId: "" },

  lifetimes: {
    attached() {
      this.resolveChannel();
    },
  },

  pageLifetimes: {
    show() {
      this.resolveChannel();
    },
  },

  methods: {
    resolveChannel() {
      const app = typeof getApp === "function" ? getApp() : null;
      const gd = (app && app.globalData) || {};
      const contact = gd.contact || config.contact || {};
      const channel = this.data.channel || contact.channel || "byteHi";
      const imId = this.data.imId || gd.imId || contact.imId || config.imId || "";
      if (channel !== this.data.effChannel || imId !== this.data.effImId) {
        this.setData({ effChannel: channel, effImId: imId });
      }
    },

    // 统一降级 handler（两种通道共用）：errNo ≠ 0 → 引导意见反馈。
    onContact(event) {
      const detail = (event && event.detail) || {};
      if (detail.errNo === undefined || Number(detail.errNo) === 0) return;
      const api = typeof tt !== "undefined" ? tt : wx;
      api.showModal({
        title: "客服暂不可用",
        content: "请通过「意见反馈」留言，我们会尽快处理。",
        showCancel: false,
        confirmText: "去反馈",
        success: () => {
          api.navigateTo({ url: "/core/shell/feedback/index" });
        },
      });
    },
  },
});