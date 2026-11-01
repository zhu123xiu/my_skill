# 新项目上手清单

> 按顺序执行。每一步都有验收标准，通过后再进入下一步。

---

## 第 1 步：复制模板包

将以下目录复制到新项目根目录：

```
templates/miniprogram/  →  新项目的 miniprogram/
templates/server/       →  新项目的 douyin-cloud/server/
setup/                  →  新项目的 setup/
scripts/                →  新项目的 scripts/
```

**验收**：目录结构完整，`miniprogram/` 和 `server/` 下均有 `template.config.js`。

---

## 第 2 步：修改配置文件

### 前端 `miniprogram/template.config.js`

| 字段 | 说明 | 示例 |
|------|------|------|
| `appId` | 抖音小程序 AppID | `tt` 开头 16 位 |
| `homePage` | 首页路径（onPageNotFound 兜底跳转） | `/business/pages/index/index` |
| `douyin.envIdDev` | 开发环境 ID | `env-` 开头 |
| `douyin.envIdProd` | 生产环境 ID | `env-` 开头 |
| `douyin.resourceEnv` | 资源环境 ID | `cloudbase-` 开头 |
| `douyin.serviceId` | 云服务 ID | 字符串 |
| `contact.channel` | 客服通道：`byteHi`（首发）/ `im`（上线后切换） | 默认 `byteHi` |
| `contact.imId` | IM 客服开通后回填（云库拉取失败兜底） | 空 |

### 服务端 `server/template.config.js`

| 字段 | 说明 | 示例 |
|------|------|------|
| `appId` | 同上 | `tt` 开头 16 位 |
| `collectionPrefix` | **★ 只改这一个，所有集合名由它拼出** | `myapp_` |
| `payment.secretsDocId` | 支付密钥文档 id（`{prefix}platform_secrets` 集合内） | 默认 `dy_payment` |
| ~~`payment.tagGroup`~~ | **不在仓库配置**：进件产出的标签组 ID 写入 `dy_payment` 文档的 `tagGroup` 字段，`createOrder` 从 `loadDySecret()` 读取，进件后零仓库改动（见 launch-checklist SOP） | — |
| `payment.products` | 商品表 seed 源与 DB 兜底（itemId / title / priceFen / grant.type）；**运行时价格以 `{prefix}products` 集合为准** | 灌入 products 集合，改价免发版 |
| `payment.orderEntryPath` | 支付回跳订单页路径 | 默认 `core/shell/orders/index` |
| `membership.name` | 会员名称 | 自定义 |

> **支付/客服模板默认可用**：`services/pay.js`、`core/grant.js`、`core/notify.js`、`services/config.js`
> 与前端 `core/utils/pay.js`、`core/shell/purchase/`、`core/components/im-contact/` 已预置，
> 业务只灌 `{prefix}products` 集合（商品/价格/权益**存数据库**，改价免发版，`config.payment.products[]` 仅 seed/兜底）
> 与 `activation_codes` 集合，**无需在 services 补 createOrder / 激活码 / 购买页**。`collections` 已含 `products`、`activation_codes`、`app_config`。

**验收**：两个 config 文件中无 `{{` 残留占位符。

---

## 第 3 步：配置密钥文件

```bash
cp setup/.secrets.local.json.example setup/.secrets.local.json
```

填写以下字段（此文件已被 `.gitignore` 排除）：

| 字段 | 来源 |
|------|------|
| `TCB_SECRET_ID` | 云开发 → 密钥管理 |
| `TCB_SECRET_KEY` | 同上 |
| `TCB_ENV` | 云开发环境 ID |
| `privateKey` | 商户平台 → 密钥管理 |
| `publicKey` | 同上 |
| `salt` | 同上 |
| `appSecret` | 开发者平台 |
| `subjectProfile.*` | 主体资料包 |

**验收**：`node setup/doctor.js` 的「密钥文件」分组全绿。

---

## 第 4 步：写产品规格书

在 `docs/product-spec.md` 中描述：

1. 产品名称、目标用户、核心价值
2. 功能清单（页面地图）
3. 数据模型（集合设计）
4. 商品表（itemId / 价格 / 权益类型）

**铁律**：用户确认规格书后才动代码。规格书是单一事实源。

**验收**：规格书已确认，商品表与 `template.config.js` 的 `products` 一致。

---

## 第 5 步：运行 setup 脚本

按顺序执行：

```bash
node setup/doctor.js          # 一键体检，按里程碑分组输出
node setup/setup-secrets.js   # 密钥写入 platform_secrets 集合
node setup/init-collections.js # 幂等创建集合 + 索引
```

**验收**：`doctor.js` 输出中「开发就绪」和「支付可联调」分组全绿。

---

## 第 6 步：运行冒烟测试

```bash
node scripts/e2e-smoke.js
```

用内存 mock db 验证服务端模板能正常启动、路由可达、handler 结构正确。

**验收**：全部 PASS，exit 0。

---

## 第 7 步：开发业务代码

**工作区**：只写 `miniprogram/business/` 和 `server/services/`。

**纪律**：
- `core/` 目录只读，不修改
- 新增 service handler：在 `server/services/` 下新建文件，文件名即服务名（自动扫描注册）
- 新增页面：在 `miniprogram/business/pages/` 下创建，并在 `app.json` 注册
- 集合名一律用 `config.collectionPrefix + 名称`，禁止硬编码

**验收**：`grep -r "communication\|亲子\|话题" core/` 无结果。

---

## 第 8 步：提审前门禁

```bash
node setup/doctor.js   # 全量全绿
git status              # 无 TODO 临时改动残留
```

**验收**：
- doctor 全量全绿（含备案、保证金、客服在线）
- git 无 TODO 临时改动残留
- 部署顺序：后端先发布 prod → 验证 → 前端切环境 → 再提审

---

## 快速参考

| 场景 | 看哪个文件 |
|------|-----------|
| 新开发小程序 | SKILL.md → 场景 1 |
| 从微信搬代码 | SKILL.md → 场景 2 + wx-compat.js |
| 接支付 | SKILL.md → 场景 3 + payment-protocol.md |
| 环境/流量不对 | SKILL.md → 场景 4 + cloud.js 注释 |
| 退款/售后 | SKILL.md → 场景 5 + refund-order.js |
| 提审上线 | SKILL.md → 场景 6 + launch-checklist.md |
| 推广/挂载 | SKILL.md → 场景 7 + promotion-setup.md |
| 报错了 | SKILL.md → 场景 8 + node-sdk-pitfalls.md |
| 接着上次继续 | SKILL.md → 场景 9 + doctor.js |
