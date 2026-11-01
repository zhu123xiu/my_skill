# 客服接入包（已实装组件）

> 交易类小程序提审硬性要求。组件 `core/components/im-contact/` 已落地：三形态 + 双通道可切换。

---

## 用法

页面 json 注册：

```json
{ "usingComponents": { "im-contact": "../../components/im-contact/index" } }
```

（路径按页面深度调整：壳页 `../../components/...`，business 页 `../../../core/components/...`）

wxml 按形态引用，**通道属性留空走全局配置**：

```xml
<im-contact shape="float" text="客服" />        <!-- 首页悬浮 -->
<im-contact shape="menu-row" />                  <!-- 我的页菜单行 -->
<im-contact shape="button" text="申请售后" />    <!-- 订单页内嵌按钮 -->
```

### props

| prop | 说明 | 缺省 |
|------|------|------|
| `channel` | `"byteHi"` \| `"im"` | 读 `globalData.contact.channel` → `template.config.contact.channel` |
| `imId` | channel=im 时生效 | 读 `globalData.imId` → `contact.imId` → `config.imId` |
| `shape` | `"float"` \| `"menu-row"` \| `"button"` | `"button"` |
| `text` | 按钮文案（menu-row 形态为标题） | `"联系客服"` |
| `desc` | menu-row 形态描述行 | `"咨询与售后问题，点此即时沟通"` |

---

## 双通道模式

### byteHi（飞鸽客服）—— ★ 首发默认

```xml
<button open-type="byteHi" bindbytehi="onContact">联系客服</button>
```

- 平台托管，**无需 imId、无接待端在线要求**
- 用户在抖音内直接发起对话，客服在飞鸽工作台接待

### IM 客服 —— 上线后切换

```xml
<button open-type="im" data-im-id="{{imId}}" bindim="onContact">联系客服</button>
```

- 需绑客服主管抖音号
- 必须在「抖音客服服务平台」(life-im.douyin.com) 设「在线」，否则用户消息不投递
- imId 走「云库配置 + 代码兜底」（改号不提审）

### 统一降级 handler

两种通道共用 `onContact`：回调 `errNo ≠ 0` → modal 引导「意见反馈」页（`core/shell/feedback`）。

---

## 通道/imId 云库配置 + 代码兜底（不提审切换）

1. `template.config.js` 前端配置：

```js
contact: { channel: "byteHi", imId: "" },  // 首发飞鸽；上线后改 "im"
```

2. `app.js onLaunch` → `fetchGlobalConfig()` 调服务端 `config` 服务（`getGlobal`），
   读 `{prefix}app_config` 的 `global` 文档的 `contact.channel` / `contact.imId`，
   拉到则覆盖 `globalData.contact` / `globalData.imId`，失败静默用 config 兜底。
3. 组件 `attached` / 页面 `show` 时重新解析通道——**云库改 imId/通道，端上无需重启即可生效，不提审**。

服务端 `app_config/global` 文档示例：

```json
{ "contact": { "channel": "im", "imId": "客服主管抖音号" } }
```

---

## 三入口布局

| 入口 | 位置 | 形态 |
|------|------|------|
| 首页悬浮 | 右下角 fixed | `float` |
| 我的页菜单 | 菜单列表中 | `menu-row` |
| 订单页售后 | 订单卡片内 | `button` |

---

## 平台约束

- 预览版/体验版对客服按钮有平台侧限制（可能无法正常打开）
- 提审期间客服账号必须保持在线（审核员会验证客服会话）
- 用户侧历史会话在「抖音消息 → 第三方客服消息」聚合入口（不是普通私信列表）
- 无消息推送 webhook，桥接外部 IM 只能走 byteHi「消息推送客服」板块