// 模板文件，零改动使用；业务值在 template.config.js
const config = require("../../../template.config");

Page({
  data: {
    appName: "",
    appDescription: "",
  },

  onLoad() {
    this.setData({
      appName: config.appName || "小程序",
      appDescription: config.appDescription || "请在此填写应用简介。",
    });
  },
});
