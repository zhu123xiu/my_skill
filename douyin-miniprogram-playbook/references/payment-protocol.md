# Payment protocol notes

- Use the `trade_basic` flow and compare order amounts with the configured product table.
- For the legacy sign payload described by the platform, sort the field values plus SALT as one value array and concatenate them; do not build a `key=value` string.
- The platform authorization string uses `SHA256-RSA2048 appid=...,nonce_str=...,timestamp=...,key_version=...,signature=...`.
- Cache client tokens for roughly two hours, renew five minutes early, and force-refresh once after a 401.
- Verify callbacks, reject timestamps older than ten minutes, and make settlement idempotent. Because callbacks can be delayed, keep an active order-query fallback.
- Keep PEM keys and salts in the prefixed `platform_secrets` collection, never in environment variables or source control.
- For refunds, first call `order_query` to obtain the `motb...` transaction order id. The `MECPN...` value shown in some console lists is a payment id and cannot be sent as `order_id`.
- Send `item_order_detail` with the returned item order id and refund amount. `refund_reason` is an integer enum (101, 102, 103, or 999), not a string. The endpoint is `refund_query/`, and the response is an accepted request that must be polled or confirmed by callback.

## 端上购买链路范式

模板已预置服务端 `services/pay.js`（createOrder/redeemActivationCode/settleOrder/findOrderByTradeNo）
与前端 `core/utils/pay.js`（requestPay/canPurchase/getPaymentEnv），业务零编码即可走通：

```
业务页 → canPurchase() 拦截（iOS 引导激活码）
  → core/utils/pay.js requestPay(await api('pay', { action:'createOrder', itemId }))
  → 成功 → entitlement-refresh.js 启动 2 分钟权益刷新窗口 → 刷新页面权益态
  → 失败/取消 → toast，订单保持 pending（靠 syncOrderStatus 兜底）
```

- **价格存数据库、服务端权威（对齐亲子仓）**：商品与价格以 `{prefix}products` 集合文档为准
  （每条 `{_id, itemId, title, priceFen, grant, status:"online"}`），`createOrder` 的 `findProduct`
  **DB 优先**、`config.payment.products[]` 仅作 seed 源与 DB 未灌数据时的兜底，再回退 `core/pricing.js`。
  端上列表价取 `config` 服务 `getProducts`（同样 DB 优先、回退 config）。前端只展示、不传价、不做价格决策；
  `core/utils/pay.js` 不硬编码商品表。**免发版调价 = 改 `products` 集合文档。**
- **进件产出值入库（零仓库改动）**：`tagGroup`（平台分配的标签组 ID）与 RSA 密钥同类，是进件产出值，
  统一存 `{prefix}platform_secrets` 集合的 `dy_payment` 文档（字段 `tagGroup`），`createOrder` 经
  `loadDySecret()` 读取，`config.payment.tagGroup` 仅作本地联调兜底。仓库 `template.config.js` **不放**
  `tagGroup`/`productCode`（`productCode` 全仓无消费点，是死配置，一并删除）。进件完成后只更新 `dy_payment`
  文档 + 配 `PAY_NOTIFY_URL` + 重启一次容器（`loadDySecret` 永久缓存、无 TTL），**不改代码、不重新构建镜像**。
- **购买/兑换壳页**：`core/shell/purchase/index` 预置「列商品（DB 价）→ createOrder → requestPay →
  syncOrderStatus 兜底」+「激活码输入 → redeemActivationCode」双通路，iOS 或支付不可用时走激活码；
  业务侧把付费墙/入口 `navigateTo` 到该壳页即可，无需自写购买页。
- **入账 config 驱动**：`grant.type` 三种（membership/package/all_courses）由 `core/grant.js` 预置分发，
  结算走 `where(outTradeNo, status=pending).update` 原子幂等（countUpdated!==1 直接返回 true）。
- **订单入口对齐**：createOrder 返回的 `orderEntrySchema.path` 取自 `config.payment.orderEntryPath`，
  模板默认 `core/shell/orders/index`（订单壳页）。改业务订单页时同步改此配置，保证支付回跳落在正确页面。
- **激活码**：`redeemActivationCode` 对 `{prefix}activation_codes` where+update 原子抢占
  （countUpdated 判 1 防并发），grant 走同一分发器；`gen-seed` 可灌演示码，真实发放走运营/后台；iOS 拦截后引导此路径。

## 支付事件钉钉通知（可选，默认静默关闭）

`core/notify.js` 预置 `notifyDingTalk`，三个挂点 fire-and-forget：
💳 用户发起支付（createOrder 落库后）、💰 支付成功（首次 settle 入账后，幂等只发一条）、
↩️ 退款成功（payNotify `type==="refund"` 分支，core 只留 `onRefund` 注入点，由 services/pay.js 传入）。

- 仅当容器环境变量 `DINGTALK_TOKEN` / `DINGTALK_SECRET` 都配置时启用；任一缺失整体静默关闭，
  **支付/退款/权益链路行为与配置前完全一致**。
- 发送失败绝不重试、绝不阻塞、绝不抛出——支付可用性优先于通知可达性。
- 密钥只走容器环境变量，严禁入码/入库/入文档正文/入 git 历史；泄露处置 = 机器人「重置」后更新环境变量。
