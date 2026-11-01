// Template configuration. Never hard-code secrets in server code.
module.exports = {
  appId: "{{APP_ID}}",
  collectionPrefix: "xxx_",
  envId: process.env.TCB_ENV,
  payment: {
    tagGroup: "{{TAG_GROUP}}",
    productCode: "",
    // 商品表：价格/权益以数据库 {prefix}products 集合为准（对齐亲子仓，免发版调价）。
    // 此数组仅作 seed 源与 DB 未灌数据时的兜底；每项：
    //   { itemId, title, priceFen, grant, productId?, image?, goodsType?, tagGroupId? }
    // grant.type 三种入账写法（core/grant.js 预置）：
    //   "membership"  → 会员字段（activated/membershipActive/membershipName…，名称取 membership.name）
    //   "package"     → unlockedPackages 追加 grant.target（缺省取 itemId）
    //   "all_courses" → allCourses: true（单 SKU 全量解锁）
    // 价格服务端权威：products 集合 priceFen 优先，回退此表，再回退 core/pricing.js；禁止信前端传价。
    products: [],
    // 支付回调订单入口页（orderEntrySchema.path），默认订单壳页。
    orderEntryPath: "core/shell/orders/index",
    secretsDocId: "dy_payment",
  },
  membership: { name: "{{MEMBERSHIP_NAME}}" },
  collections: [
    { name: "profiles" },
    { name: "orders", indexes: [{ openid: 1, status: 1 }] },
    { name: "products", indexes: [{ itemId: 1, status: 1 }] },
    { name: "activation_codes" },
    { name: "app_config" },
    { name: "platform_secrets" }
  ]
};