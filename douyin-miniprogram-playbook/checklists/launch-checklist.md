# 上线前打勾清单

> 按阶段分组。第 0 天就要启动的事项标注「早期」。

---

## 早期启动（第 0 天）

- [ ] **类目准入确认**：目标类目支付能力是「可开放」还是「邀约开放」（查 trade 文档 `references/docs-links.md`）
- [ ] **ICP 备案**：约 20 工作日，阻塞版本提交（不阻塞开发）
- [ ] **支付商户进件**：MCC 避开特殊行业（否则要网络出版许可证等补充资质）
- [ ] **小程序推广计划**：零粉丝冷启动主推，尽早申请

---

## 架构与开发

- [ ] **双环境路由就位**：`getEnvInfoSync().microapp.envType` → `production` 落 prod，其余落 dev
  - 体验版真机验证 `envType=preview` 正确落 dev（**阻断级**）
  - **禁用 `getAccountInfoSync().miniProgram.envVersion`**——微信取值体系，抖音不可靠
- [ ] **node-sdk 坑已对照检查**（`references/node-sdk-pitfalls.md`）：
  - `where().update()` 返回值无 stats 包装（用 `countUpdated`）
  - `doc().get()` 返回数组（wx-compat 已处理）
  - set/update 收裸对象不收 `{data}` 包装
  - set 禁带 `_id`
  - doc 不存在不抛错
  - `doc().update()` 对不存在文档静默 no-op
- [ ] **e2e 冒烟通过**：`node scripts/e2e-smoke.js` 全 PASS
- [ ] **涉及交易必接客服**（byteHi 或 IM 客服）
  - 提审期间客服账号保持在线（审核员会验证）
  - IM 客服需绑客服主管抖音号并在客服服务平台设「在线」

---

## 部署顺序铁律

> 反了就是 callContainer fail 10401

- [ ] **后端先发布 prod** → 验证健康检查通过
- [ ] **前端切环境** → 验证流量正确
- [ ] **再提审**
- [ ] 提审前 `git status` 确认 TODO 临时改动已全部回滚

---

## 费用与合规

- [ ] **余额预警已开**（阈值 5 元——抖音云无免费期，欠费延停极短即停服）
- [ ] **保证金已缴**（就高原则；逾期 7 天限制发版/支付/提现；月 GMV<5 万浮动保证金为 0）
- [ ] **隐私协议最小化申报**

---

## 提审门禁（doctor 全量全绿）

```bash
node setup/doctor.js   # 全量全绿
git status              # 无 TODO 残留
```

- [ ] doctor 输出中所有分组（开发就绪 / 支付可联调 / 数据就绪 / 平台事项）全绿
- [ ] 备案已通过
- [ ] 保证金已缴
- [ ] 客服在线
- [ ] git 无 TODO 临时改动残留
