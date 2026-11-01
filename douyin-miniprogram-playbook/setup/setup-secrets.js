// 灌 dy_payment 密钥文档到 {prefix}platform_secrets 集合。
// 字段口径与 core/payment.js 的 loadDySecret() 消费严格对齐：
//   appId / appSecret        —— 开放平台，进件前可预填
//   privateKeyPem            —— 进件产出：商户 RSA 私钥（对下单参数签名）
//   keyVersion               —— 进件产出：密钥版本
//   platformPublicKeyPem     —— 进件产出：平台公钥（验支付回调签名）
//   tagGroup                 —— 进件产出：标签组 ID（createOrder 组装 skuParams.tagGroupId）
// 设计目标：进件完成后只更新本文档，不改仓库、不重新构建镜像。
// 安全：全程只打印字段名，绝不打印任何密钥值。
const fs = require("fs");
const path = require("path");

const config = require("../templates/server/template.config");
const secretsPath = path.join(__dirname, ".secrets.local.json");

if (!fs.existsSync(secretsPath)) {
  console.error("错误: 缺少 .secrets.local.json");
  console.error("请复制 .secrets.local.json.example 为 .secrets.local.json 并填写密钥字段");
  process.exit(1);
}

let secrets;
try {
  secrets = JSON.parse(fs.readFileSync(secretsPath, "utf8"));
} catch (error) {
  console.error("错误: .secrets.local.json 格式不正确");
  console.error(error.message);
  process.exit(1);
}

// 仅要求 TCB 连接三要素；进件产出值（privateKeyPem/keyVersion/platformPublicKeyPem/tagGroup）
// 允许进件前为空——本脚本可在进件前先建好空壳，进件后重跑更新同一文档（set 幂等覆盖）。
const requiredFields = ["TCB_SECRET_ID", "TCB_SECRET_KEY", "TCB_ENV"];
const missingFields = requiredFields.filter((field) => !secrets[field] || !secrets[field].trim());
if (missingFields.length > 0) {
  console.error("错误: 缺少必填字段:", missingFields.join(", "));
  process.exit(1);
}

// dy_payment 文档字段：从 secrets.local.json 同名键取值，缺失写空串以稳定文档结构。
const DY_PAYMENT_FIELDS = [
  "appId",
  "appSecret",
  "privateKeyPem",
  "keyVersion",
  "platformPublicKeyPem",
  "tagGroup",
];

async function main() {
  let tcb;
  try {
    tcb = require("@cloudbase/node-sdk");
  } catch (error) {
    console.error("错误: 无法加载 @cloudbase/node-sdk");
    console.error("请先运行: npm install @cloudbase/node-sdk");
    process.exit(1);
  }

  console.log("初始化 TCB 连接...");
  // 与 import-data.js / init-collections.js 一致：AK/SK 直连用 {env, secretId, secretKey}。
  // （envId + credentials.private_key 是证书式，不适用于 AK/SK——旧写法会导致连接失败。）
  const app = tcb.init({
    env: secrets.TCB_ENV,
    secretId: secrets.TCB_SECRET_ID,
    secretKey: secrets.TCB_SECRET_KEY,
  });

  const db = app.database();
  const collectionName = config.collectionPrefix + "platform_secrets";
  const docId = config.payment.secretsDocId || "dy_payment";

  console.log(`准备写入集合: ${collectionName}`);
  console.log(`文档 ID: ${docId}`);

  const docData = {};
  const filled = [];
  const pending = [];
  for (const field of DY_PAYMENT_FIELDS) {
    const value = secrets[field];
    if (value && String(value).trim()) {
      docData[field] = value;
      filled.push(field);
    } else {
      docData[field] = "";
      pending.push(field);
    }
  }
  docData.updatedAt = new Date();

  try {
    // node-sdk 直连：set() 收「裸对象」，不能包 {data}（那是 wx-server-sdk 约定）。幂等覆盖。
    await db.collection(collectionName).doc(docId).set(docData);

    console.log(`✔ 已写入 ${DY_PAYMENT_FIELDS.length} 个字段（幂等覆盖）`);
    console.log(`  已填充: ${filled.length ? filled.join(", ") : "（无）"}`);
    if (pending.length) {
      console.log(`  进件前留空，进件后更新: ${pending.join(", ")}`);
    }
    console.log("注意: 未打印任何密钥值");
  } catch (error) {
    console.error("错误: 写入失败");
    console.error(error.message);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("执行失败:", error);
  process.exitCode = 1;
});
