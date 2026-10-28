# 客服接入包

> 交易类小程序提审硬性要求。三种形态 + 双通道支持。

---

## 双通道模式

### byteHi（飞鸽客服）

```xml
<button open-type="byteHi">联系客服</button>
```

- 平台托管的客服通道
- 用户在抖音内直接发起对话
- 客服在飞鸽工作台接待

### IM 客服

```xml
<button open-type="im" data-im-id="{{imId}}" bindim="onContact">联系客服</button>
```

- 需要绑客服主管抖音号
- 在「抖音客服服务平台」设「在线」状态（不在线则用户消息不投递）
- imId 走「云库配置表 + 代码默认值兜底」模式（改号不提审）

---

## 三种形态

### 1. 悬浮按钮（fixed 定位）

适合首页。固定在右下角，用户随时可点击。

```xml
<view class="im-float-btn">
  <button open-type="im" data-im-id="{{imId}}" bindim="onContact">
    客服
  </button>
</view>
```

### 2. 菜单行（透明 button 覆盖整行）

适合「我的」页。整行可点击，透明 button 覆盖 hack。

```xml
<view class="menu-item menu-item--im">
  <button class="menu-item__im-btn" open-type="im" data-im-id="{{imId}}" bindim="onContact"></button>
  <view class="menu-item__icon">客</view>
  <view class="menu-item__text">联系客服</view>
  <view class="chevron">›</view>
</view>
```

### 3. 统一降级 handler

客服不可用时降级到意见反馈。

```js
onContact(event) {
  const detail = (event && event.detail) || {};
  if (detail.errNo === undefined || Number(detail.errNo) === 0) {
    return; // 正常打开客服
  }
  // 降级：引导到意见反馈
  wx.showModal({
    title: "客服暂不可用",
    content: "请通过「意见反馈」留言，我们会尽快处理。",
    showCancel: false,
    confirmText: "去反馈",
    success: () => this.openFeedback(),
  });
}
```

---

## 三入口布局建议

| 入口 | 位置 | 形态 |
|------|------|------|
| 首页悬浮 | 右下角 fixed | 悬浮按钮 |
| 我的页菜单 | 菜单列表中 | 菜单行 |
| 订单页售后 | 订单卡片内 | 申请售后按钮 |

---

## imId 配置

采用「云库配置表 + 代码默认值兜底」模式：

1. 代码中写一个默认 imId（template.config.js 或 globalData）
2. 启动时从云端配置表拉取最新 imId
3. 拉取成功则更新，失败则用默认值
4. 好处：改客服号不需要提审

```js
// app.js onLaunch
initCloud().then(() => {
  fetchGlobalConfig().then((config) => {
    if (config && config.imId) {
      this.globalData.imId = config.imId;
    }
  }).catch(() => {});
});
```

---

## 平台约束

- 预览版/体验版对客服按钮有平台侧限制（可能无法正常打开）
- 提审期间客服账号必须保持在线（审核员会验证客服会话）
- 用户侧历史会话在「抖音消息 → 第三方客服消息」聚合入口（不是普通私信列表）
- 无消息推送 webhook，桥接外部 IM 只能走 byteHi「消息推送客服」板块
