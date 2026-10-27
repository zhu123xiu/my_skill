// Template configuration. Never hard-code secrets in server code.
module.exports = {
  appId: "{{APP_ID}}",
  collectionPrefix: "xxx_",
  envId: process.env.TCB_ENV,
  payment: { tagGroup: "{{TAG_GROUP}}", productCode: "", products: [], secretsDocId: "dy_payment" },
  membership: { name: "{{MEMBERSHIP_NAME}}" },
  collections: [
    { name: "profiles" },
    { name: "orders", indexes: [{ openid: 1, status: 1 }] },
    { name: "platform_secrets" }
  ]
};
