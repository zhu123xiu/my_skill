---
name: douyin-miniprogram-playbook
description: >-
  Douyin (TikTok China) mini-program playbook: build from day zero to launch,
  payment integration (trade_basic), dev/prod environments, review submission,
  promotion cold start, refunds and operations. Use when developing a new Douyin
  mini-program, migrating a WeChat mini-program, integrating Douyin payment,
  debugging wrong-environment/no-traffic issues, handling refunds, submitting
  for review, or setting up promotion/mounting capabilities.
descriptionZh: >-
  抖音小程序全流程手册与可复用模板包：从第 0 天搭建到上线、支付接入（trade_basic）、dev/prod 双环境、
  提审、推广冷启动、退款运维。当用户要新开发抖音小程序、从微信迁移小程序、接入抖音支付、排查环境/流量
  问题、处理退款售后、提审上线或开通挂载推广能力时使用。含模板代码包（core/business 分层）、平台事务
  代办指南（platform-tasks）、值获取地图（value-map）、setup 脚本与五大血泪点速查。
---

# Douyin Miniprogram Playbook

Build, migrate, test, launch, and promote a Douyin mini app from a reusable template.

> 抖音小程序从第 0 天搭建到上线、支付接入、推广冷启动的全流程手册 + 可 copy 的模板代码包 + 平台事务自动办理能力。

---

## 核心设计原则

1. **机制代码零改动，业务值全部进配置**。模板文件 copy 即用；新项目只改 `template.config.js`（非敏感值）+ `setup/.secrets.local.json`（敏感值，gitignore）。
2. **AI 为主动方，用户只在真正的卡点出现**。值能自己抓的绝不问用户；申请能代办的绝不让用户自己办；主体资料能自取的绝不找用户要。
3. **发起先行，并行开发，最后收割**。需审核的平台事项第一时间全部提交（审核要墙钟时间，并行等待），随后立刻转入代码开发，审核通过的随时收割回写。
4. **数据灌入一律走脚本**。密钥、集合、索引、初始数据全部由 `setup/` 脚本完成，禁止让用户去控制台手动操作数据库。
5. **集合名统一前缀**。所有集合名由 `collectionPrefix` 拼接生成，禁止散落硬编码。
6. **core 只读，业务隔离**。`core/` 目录来自模板、整体覆盖升级，AI 只读不写；所有业务代码只许写在 `business/` 和 `server/services/`。
7. **需求先落文档再动代码**。用户口述需求 → AI 先更新 `docs/product-spec.md` → 用户确认 → 才改代码。

---

## Operating rules

- Treat `templates/miniprogram/core/` and `templates/server/core/` as read-only mechanism code. Put project-specific code in `business/` and `server/services/`.
- Keep non-sensitive project values in the two `template.config.js` files. Keep secrets in `setup/.secrets.local.json`, which must never be committed.
- Translate every new requirement into `templates/docs/product-spec.md` first. Ask for confirmation before changing business code.
- Never place real identity documents, private keys, openids, phone numbers, or payment credentials in this skill or a project repository.
- Start platform reviews early, then develop in parallel. Collect user-only actions (scan, verification code, face check, agreement signature, payment) into one blocking checklist.
- 主体资料（尤其身份证、执照）禁止写入 skill 目录、任何项目仓库；下载动作只许落 `~/subject-profile/`。

---

## 值获取四层分级模型

每个需要的值/事项归入一层，AI 按层处理：

| 层 | 定义 | AI 动作 |
|---|---|---|
| **L0** | AI 自己定（collectionPrefix、homePage、商品表） | 不问用户，定了写进配置 |
| **L1** | AI 自动去平台抓（appId、envId、密钥、商户号等） | 用户给一次控制台链接，浏览器自动化逐页抓回 |
| **L2** | AI 代办申请/开通（进件、密钥生成、类目添加等） | 浏览器自动化填表，提交前给用户确认摘要 |
| **L3** | 用户必须本人（扫码、验证码、人脸、协议签署、缴费） | **打包成一次性卡点清单**，禁止一次次打断 |

**卡点合并原则**：doctor 跑完 → L1 抓完 → L2 能办的先办 → 所有 L3 卡点合并为一张清单一次性给用户。

详见 `references/value-map.md`。

---

## 主流程编排

```
第 0 步：用户给「控制台链接」（或仅 appId）
  主体资料包由 AI 在 ~/subject-profile/ 自建，只向用户要身份证
  ↓
发起阶段：doctor 初检 → L1 自动抓取全部可抓值
  → 遍历 platform-tasks.md 待开通列表
  → 需审核项优先提交（进件 1-3 天、机构号 ~1 天、类目审核…并行等待）
  → 即时生效项随手开通（挂载能力、余额预警…）
  → 输出「等待清单」：待审核项 + 预计时长 + 查询入口 URL
  ↓
并行开发期：copy 模板包 → 写 services/ 业务 handler → 页面开发
  → e2e 冒烟（假 db）→ dev 环境联调
  → 配置占位符空着不阻塞
  ↓
收割阶段：审核通过的项 → AI 抓回产出值（密钥/商户号/能力状态）
  → 回写 config / secrets / platform_secrets
  → doctor 复检
  ↓
提审门禁：doctor 全量全绿（含备案、保证金、客服在线）
  + git 无 TODO 临时改动残留
```

### 业务开发期协作模型

- **第 0 天**：用户大白话描述"要做什么"，AI 翻译成 `docs/product-spec.md` 产品规格书，用户确认后成为需求锚点。
- **壳先行**：规格书确认后，AI 先把 core + 壳页搭成可运行的空壳小程序，第一天即可扫码预览。
- **迭代中**：用户随时提需求，铁律是 AI 先把口述翻译成规格书增量更新 → 用户确认 → 才动代码。

---

## Route by user scenario

1. **「我要新开发一个抖音小程序」**→ 主流程：要控制台链接（或仅 appId）→ AI 在 ~/subject-profile/ 自建主体资料包 → 发起阶段 → 并行开发 → 收割 → 提审门禁。参考 `templates/docs/product-spec.md`、`references/value-map.md`、`references/platform-tasks.md`、setup 脚本。
2. **「我要从微信搬代码到抖音」**→ `templates/server/core/wx-compat.js` 使用说明 + 整文件搬运原则 + `references/node-sdk-pitfalls.md`。
3. **「我要接支付」**→ `references/payment-protocol.md` + 支付模板说明 + 进件/MCC 注意事项 + `setup/doctor.js` 支付分组。
4. **「环境/流量不对」**（prod 没流量、10401、envType 路由）→ `templates/miniprogram/core/config/cloud.js` 注释（getEnvInfoSync 环境路由）+ `checklists/launch-checklist.md` 部署铁律。判断流量去向要**双环境日志对照**。
5. **「我要退款 / 处理售后」**→ `references/payment-protocol.md` 退款节 + `scripts/refund-order.js` 运维脚本模板。
6. **「我要提审上线」**→ `checklists/launch-checklist.md`。
7. **「我要推广/挂载」**→ `checklists/promotion-setup.md` + `references/platform-tasks.md` 对应卡片（10-15）。
8. **「报错了」**→ `references/node-sdk-pitfalls.md` + `references/payment-protocol.md` 报错对照。
9. **「接着上次的继续」**→ 先跑 `node setup/doctor.js` + 核对等待清单，收割已完成审核项。

---

## First run

1. Copy `templates/miniprogram/` into the new app's `miniprogram/` directory.
2. Copy `templates/server/` into `douyin-cloud/server/`.
3. Edit only the two config files and create `setup/.secrets.local.json` from its example.
4. Run the setup scripts in this order: `doctor.js`, `setup-secrets.js`, `init-collections.js`, and `import-data.js` when seed data is ready.
5. Run `scripts/e2e-smoke.js` with a mock database before real credentials are available.

---

## Subject profile boundary

`templates/subject-profile/` contains only a directory skeleton + README checklist. Real files belong outside every Git repository at `~/subject-profile/`, split into the five documented folders:

```
~/subject-profile/
├── 01-主体资质/        (营业执照图片等)
├── 02-法人证件/        (身份证正反面 - 用户手动放入)
├── 03-银行账户/        (结算银行卡照片等)
├── 04-业务材料/        (logo、ICP备案回执等)
└── 05-其他平台回执/    (审核通过凭证归档)
```

**三原则**：
1. **AI 自取优先**：凡平台能抓的（执照、文字信息、商户号、结算卡号）不打扰用户；身份证等平台不回取的才让用户放入。
2. **本地缓存 + 权威路径双记**：抓到的文件下载到 `~/subject-profile/`，同时记录权威获取路径（菜单 + URL 模板），任何后续 AI 会话都能重新自取。
3. **绝不入库**：主体资料禁止写入 skill 目录、任何项目仓库。

Platform pages may be read only after the user supplies an authorized console entry and completes any required login or verification. Do not guess or request credentials in chat.

---

## 五个血泪点（必须醒目）

1. **node-sdk 坑**：`where().update()` 无 stats 包装（用 `countUpdated`）；`doc().get()` 返回数组；set/update 收裸对象不收 `{data}` 包装（server wx-compat 层 vs 本地脚本双写法）；set 禁带 `_id`；doc 不存在不抛错；`doc().update()` 对不存在文档静默 no-op。详见 `references/node-sdk-pitfalls.md`。
2. **签名纯值排序**：提取全部字段值 + SALT 作为数组元素 sort 后拼接，不是 key=value 拼接。此坑导致过 "invalid sign"。
3. **部署铁律**：后端先发布 prod → 验证 → 前端切环境 → 再提审。反了就是 callContainer fail 10401。
4. **getEnvInfoSync 环境路由坑**：`production`→prod，其余→dev。**禁用 `getAccountInfoSync().miniProgram.envVersion`**——那是微信取值体系，抖音运行时不可靠（真实事故：正式版恒返回非 release）。体验版 envType=`preview` 应落 dev。
5. **退款实操参数**：`order_id` 必须是 motb 前缀交易订单号（不是 MECPN 支付单号）；必传 `item_order_detail`；`refund_reason` 是 int64 枚举（101/102/103/999，传字符串报错）；响应是受理式（成功 ≠ 到账）。

---

## Acceptance gate

Before committing, verify:

1. 模板包 copy 到空目录后，只改两个 config + 填 secrets + 跑三个 setup 脚本，doctor 应走到"等业务 handler"阶段。
2. `grep -r "communication\|亲子\|话题" templates/server/` 无结果。
3. 每个场景路由都能指到具体文件。
4. 五个血泪点都在文档中出现且标醒目。
5. `references/value-map.md` 中每个 L1/L2 值都有"去哪抓"的 URL 模板或菜单路径。
6. `references/platform-tasks.md` 每张卡片都标注审核时长和前置依赖。
7. `core/` 内文件不含业务词；壳页 mine 的菜单完全由 `business/menus.js` 驱动（空数组时页面不崩）。
8. 含 `templates/docs/product-spec.md` 模板，且 SKILL.md 明确要求"需求先落规格书再动代码"。
9. 扫描 `{{` 占位符残留、真实凭据、TODO 临时改动。
10. `core/` 代码未被修改。
