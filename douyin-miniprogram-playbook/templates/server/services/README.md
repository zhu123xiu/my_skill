# Service Handler 编写规范

> `server/services/` 目录下的每个文件就是一个 service handler。文件名即服务名，`index.js` 启动时自动扫描注册。

---

## 基本结构

```js
// services/myService.js
// 模板文件，零改动使用；业务值在 template.config.js
const cloud = require("../core/wx-compat");
const config = require("../template.config");

const db = cloud.database();
const { getOpenid } = cloud;

// 集合名一律用前缀拼接
const MY_COLLECTION = config.collectionPrefix + "my_collection";

exports.main = async (event) => {
  const openid = getOpenid();
  const action = event.action || "";

  switch (action) {
    case "getList":
      return await handleGetList(openid, event);
    case "create":
      return await handleCreate(openid, event);
    default:
      return { success: false, message: `未知 action: ${action}` };
  }
};

async function handleGetList(openid, event) {
  // ...
  return { success: true, data: [] };
}

async function handleCreate(openid, event) {
  // ...
  return { success: true };
}
```

---

## 关键规则

### 1. openid 获取

从 wx-compat 的 `getOpenid()` 获取（基于 AsyncLocalStorage 隔离），**不要**从 event 里取。

```js
const { getOpenid } = require("../core/wx-compat");
const openid = getOpenid();
```

### 2. 集合名用前缀

```js
// 正确
const collection = config.collectionPrefix + "orders";

// 错误（硬编码）
const collection = "myapp_orders";
```

### 3. 写档前必读档（防清库）

**全量 `set()` 写档前必须先 `get()` 读档成功**，否则读档失败会清库（真实事故）。

```js
// 正确：先读后写
const current = await db.collection(col).doc(id).get().catch(() => null);
const data = { ...(current && current.data), ...patch };
await db.collection(col).doc(id).set({ data });

// 错误：直接 set 可能清库
await db.collection(col).doc(id).set({ data: patch });
```

### 4. update 静默 no-op 防御

`doc(id).update()` 对不存在的文档静默返回 `{updated: 0}`，不抛错。如果配了 `.catch(()=>{})` 吞错，写入无声丢失（真实事故）。

```js
// 正确：update 后判 updated === 0 再 set 兜底
const result = await db.collection(col).where({ id }).update({ data: patch });
if (countUpdated(result) === 0) {
  await db.collection(col).doc(id).set({ data: { id, ...patch } });
}

// 或用 countUpdated 兼容函数
function countUpdated(result) {
  if (!result) return 0;
  if (typeof result.updated === "number") return result.updated;
  if (result.stats && typeof result.stats.updated === "number") return result.stats.updated;
  return 0;
}
```

### 5. 裸对象 vs {data} 包装

- **server 端**（通过 wx-compat）：收 `{data: {...}}` 包装
- **本地运维脚本**（直接用 @cloudbase/node-sdk）：收裸对象
- 写脚本时注意区分，否则会写出嵌套 `"data"` 字段（真实事故）

### 6. set 禁带 _id

`set()` 的 payload 禁止包含 `_id` 字段，否则报参数错误。wx-compat 已自动剥离，但直接操作 db 时需手动 `delete doc._id`。

---

## 常见模式

### 保存用户数据

```js
async function saveProfile(openid, patch) {
  const col = config.collectionPrefix + "profiles";
  const current = await db.collection(col).doc(openid).get().catch(() => null);
  const profile = {
    ...(current && current.data),
    ...patch,
    createdAt: (current && current.data && current.data.createdAt) || db.serverDate(),
    updatedAt: db.serverDate(),
  };
  delete profile._id;
  await db.collection(col).doc(openid).set({ data: profile });
}
```

### 幂等订单状态更新

```js
async function settleOrder(outTradeNo, orderId, totalAmount) {
  const col = config.collectionPrefix + "orders";
  const order = await getOrderByOutTradeNo(outTradeNo);
  if (!order || order.status === "paid") return true;

  if (totalAmount !== undefined && Number(totalAmount) !== Number(order.goodsPrice)) {
    return false;
  }

  const result = await db.collection(col)
    .where({ outTradeNo, status: "pending" })
    .update({ data: { status: "paid", paidAt: db.serverDate(), dyOrderId: orderId } });

  return countUpdated(result) === 1;
}
```

---

## 参考

- node-sdk 五大坑：`references/node-sdk-pitfalls.md`
- 支付机制：`references/payment-protocol.md`
- 配置 schema：`templates/server/template.config.js`
