const fs = require("fs");
const path = require("path");

const config = require("../templates/server/template.config");
const secretsPath = path.join(__dirname, ".secrets.local.json");

if (!fs.existsSync(secretsPath)) {
  console.error("错误: 缺少 .secrets.local.json");
  console.error("请复制 .secrets.local.json.example 为 .secrets.local.json 并填写所有密钥字段");
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

// Validate required fields
const requiredFields = ["TCB_SECRET_ID", "TCB_SECRET_KEY", "TCB_ENV", "privateKey", "publicKey", "salt"];
const missingFields = requiredFields.filter(field => !secrets[field] || !secrets[field].trim());
if (missingFields.length > 0) {
  console.error("错误: 缺少必填字段:", missingFields.join(", "));
  process.exit(1);
}

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
  const app = tcb.init({
    envId: secrets.TCB_ENV,
    credentials: {
      private_key_id: secrets.TCB_SECRET_ID,
      private_key: secrets.TCB_SECRET_KEY
    }
  });

  const db = app.database();
  const secretsCollection = config.collectionPrefix + "platform_secrets";
  const secretsDocId = config.payment.secretsDocId || "dy_payment";

  console.log(`准备写入集合: ${secretsCollection}`);
  console.log(`文档 ID: ${secretsDocId}`);

  // Prepare document data
  const docData = {
    privateKey: secrets.privateKey,
    publicKey: secrets.publicKey,
    salt: secrets.salt,
    updatedAt: new Date()
  };

  // Include subjectProfile if present
  if (secrets.subjectProfile && Object.keys(secrets.subjectProfile).length > 0) {
    docData.subjectProfile = secrets.subjectProfile;
  }

  try {
    // Use set() for idempotent overwrite
    await db.collection(secretsCollection).doc(secretsDocId).set({
      data: docData
    });

    const keyCount = Object.keys(docData).length;
    console.log(`✔ 已写入 ${keyCount} 个键`);
    console.log("注意: 未打印任何密钥值");
  } catch (error) {
    console.error("错误: 写入失败");
    console.error(error.message);
    process.exit(1);
  }
}

main().catch(error => {
  console.error("执行失败:", error);
  process.exitCode = 1;
});
