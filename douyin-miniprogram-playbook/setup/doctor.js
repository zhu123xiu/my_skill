const fs = require("fs");
const path = require("path");

const config = require("../templates/server/template.config");
const secretsPath = path.join(__dirname, ".secrets.local.json");

const milestones = {
  dev: [],
  payment: [],
  data: [],
  platform: []
};

function check(milestone, name, ok, hint) {
  const item = { name, ok, hint };
  milestones[milestone].push(item);
}

async function main() {
  // Milestone 1: 配置完整性
  console.log("=== 1. 配置完整性 ===");
  const configStr = JSON.stringify(config, null, 2);
  const hasPlaceholders = /\{\{[^}]+\}\}/.test(configStr);
  check("dev", "配置无未解析占位符", !hasPlaceholders, "编辑 template.config.js 替换所有 {{...}}");

  const appIdValid = /^tt[a-z0-9]{16}$/.test(config.appId || "");
  check("dev", "appId 格式正确 (tt + 16位小写字母数字)", appIdValid, "在 template.config.js 设置正确的 appId");

  const envIdValid = typeof config.envId === "string" && config.envId.startsWith("env-");
  check("dev", "envId 格式正确 (env- 开头)", envIdValid, "设置环境变量 TCB_ENV 或在 template.config.js 硬编码 envId");

  const prefixSet = typeof config.collectionPrefix === "string" && config.collectionPrefix.length > 0 && config.collectionPrefix !== "xxx_";
  check("dev", "collectionPrefix 已设置", prefixSet, "在 template.config.js 设置实际的 collectionPrefix");

  // Milestone 2: 密钥文件
  console.log("\n=== 2. 密钥文件 ===");
  const secretsExist = fs.existsSync(secretsPath);
  check("dev", ".secrets.local.json 存在", secretsExist, "复制 .secrets.local.json.example 为 .secrets.local.json 并填写");

  let secrets = {};
  if (secretsExist) {
    try {
      secrets = JSON.parse(fs.readFileSync(secretsPath, "utf8"));
      const requiredFields = ["TCB_SECRET_ID", "TCB_SECRET_KEY", "TCB_ENV", "privateKey", "publicKey", "salt", "appSecret"];
      for (const field of requiredFields) {
        const hasValue = typeof secrets[field] === "string" && secrets[field].trim().length > 0;
        check("dev", `密钥字段 ${field} 已填写`, hasValue, `在 .secrets.local.json 填写 ${field}`);
      }
    } catch (error) {
      check("dev", "密钥文件 JSON 格式正确", false, "修复 .secrets.local.json 的 JSON 语法");
    }
  }

  // Milestone 3: TCB 连通性
  console.log("\n=== 3. TCB 连通性 ===");
  let tcb = null;
  let tcbConnected = false;
  if (secretsExist && secrets.TCB_SECRET_ID && secrets.TCB_SECRET_KEY && secrets.TCB_ENV) {
    try {
      tcb = require("@cloudbase/node-sdk");
      const app = tcb.init({
        envId: secrets.TCB_ENV,
        credentials: {
          private_key_id: secrets.TCB_SECRET_ID,
          private_key: secrets.TCB_SECRET_KEY
        }
      });
      const db = app.database();
      // Test connection by listing collections
      await db.listCollections();
      tcbConnected = true;
      check("dev", "TCB 连接成功", true, "");
    } catch (error) {
      check("dev", "TCB 连接失败", false, `检查 AK/SK/ENV 是否正确: ${error.message}`);
    }
  } else {
    check("dev", "TCB 连接跳过", false, "缺少 TCB_SECRET_ID/TCB_SECRET_KEY/TCB_ENV");
  }

  // Milestone 4: 密钥文档
  console.log("\n=== 4. 密钥文档 ===");
  if (tcbConnected) {
    try {
      const db = tcb.database();
      const secretsCollection = config.collectionPrefix + "platform_secrets";
      const secretsDocId = config.payment.secretsDocId || "dy_payment";

      // Check collection exists
      const collections = await db.listCollections();
      const collectionExists = collections.data.some(c => c.name === secretsCollection);
      check("payment", `集合 ${secretsCollection} 存在`, collectionExists, `运行 node setup/init-collections.js`);

      if (collectionExists) {
        // Check document exists
        try {
          const doc = await db.collection(secretsCollection).doc(secretsDocId).get();
          const docExists = doc.data && Object.keys(doc.data).length > 0;
          check("payment", `文档 ${secretsDocId} 存在`, docExists, `运行 node setup/setup-secrets.js`);

          if (docExists) {
            const data = doc.data;
            const hasPrivateKey = typeof data.privateKey === "string" && data.privateKey.length > 0;
            const hasSalt = typeof data.salt === "string" && data.salt.length > 0;
            const hasPublicKey = typeof data.publicKey === "string" && data.publicKey.length > 0;
            check("payment", "密钥文档包含 privateKey", hasPrivateKey, "运行 node setup/setup-secrets.js");
            check("payment", "密钥文档包含 salt", hasSalt, "运行 node setup/setup-secrets.js");
            check("payment", "密钥文档包含 publicKey", hasPublicKey, "运行 node setup/setup-secrets.js");
          }
        } catch (error) {
          check("payment", `文档 ${secretsDocId} 不存在`, false, `运行 node setup/setup-secrets.js`);
        }
      }
    } catch (error) {
      check("payment", "密钥文档检查失败", false, error.message);
    }
  } else {
    check("payment", "密钥文档检查跳过", false, "TCB 未连接");
  }

  // Milestone 5: 私钥可用性
  console.log("\n=== 5. 私钥可用性 ===");
  if (secrets.privateKey && secrets.publicKey && secrets.salt) {
    try {
      const crypto = require("crypto");
      const testData = "test-data-" + Date.now();
      const sign = crypto.createSign("RSA-SHA256");
      sign.update(testData);
      const signature = sign.sign(secrets.privateKey, "base64");

      const verify = crypto.createVerify("RSA-SHA256");
      verify.update(testData);
      const verified = verify.verify(secrets.publicKey, signature, "base64");

      check("payment", "本地签名验签自洽", verified, "检查 privateKey 和 publicKey 是否匹配");
    } catch (error) {
      check("payment", "签名验签失败", false, error.message);
    }
  } else {
    check("payment", "签名验签跳过", false, "缺少 privateKey/publicKey/salt");
  }

  // Milestone 6: client_token 获取
  console.log("\n=== 6. client_token 获取 ===");
  if (config.appId && secrets.appSecret && !hasPlaceholders) {
    try {
      const https = require("https");
      const postData = JSON.stringify({
        appid: config.appId,
        secret: secrets.appSecret
      });

      const options = {
        hostname: "developer.toutiao.com",
        port: 443,
        path: "/api/apps/v2/token",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData)
        }
      };

      const tokenResult = await new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
          let data = "";
          res.on("data", chunk => data += chunk);
          res.on("end", () => {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              reject(new Error("解析响应失败"));
            }
          });
        });
        req.on("error", reject);
        req.write(postData);
        req.end();
      });

      const tokenOk = tokenResult.data && tokenResult.data.access_token;
      check("payment", "client_token 获取成功", tokenOk, tokenResult.err_msg || "检查 appId 和 appSecret");
    } catch (error) {
      check("payment", "client_token 请求失败", false, error.message);
    }
  } else {
    check("payment", "client_token 跳过", false, "缺少 appId 或 appSecret 或配置有占位符");
  }

  // Milestone 7: 集合/索引
  console.log("\n=== 7. 集合/索引 ===");
  if (tcbConnected) {
    try {
      const db = tcb.database();
      const collections = await db.listCollections();
      const collectionNames = collections.data.map(c => c.name);

      for (const coll of config.collections || []) {
        const fullName = config.collectionPrefix + coll.name;
        const exists = collectionNames.includes(fullName);
        check("data", `集合 ${fullName} 存在`, exists, `运行 node setup/init-collections.js`);
      }

      // Note: Index checking requires more complex logic, skip for now
      check("data", "索引检查", false, "手动在 TCB 控制台验证索引");
    } catch (error) {
      check("data", "集合检查失败", false, error.message);
    }
  } else {
    check("data", "集合检查跳过", false, "TCB 未连接");
  }

  // Milestone 8: 平台事项状态
  console.log("\n=== 8. 平台事项状态 ===");
  const platformTasksPath = path.join(__dirname, "..", "references", "platform-tasks.md");
  if (fs.existsSync(platformTasksPath)) {
    check("platform", "platform-tasks.md 存在", true, "");
    check("platform", "服务类目", false, "在平台完成服务类目申请");
    check("platform", "ICP 备案", false, "在备案平台完成 ICP 备案");
    check("platform", "商户入驻", false, "在平台完成商户入驻");
    check("platform", "支付密钥", false, "在平台获取支付密钥并运行 setup-secrets.js");
    check("platform", "客服配置", false, "在平台配置客服");
    check("platform", "企业账号", false, "在平台开通企业账号");
  } else {
    check("platform", "platform-tasks.md 缺失", false, "创建 references/platform-tasks.md");
  }

  // Output summary
  console.log("\n" + "=".repeat(50));
  console.log("🚀 开发就绪 (Dev Ready)");
  console.log("=".repeat(50));
  for (const item of milestones.dev) {
    console.log(`${item.ok ? "✔" : "✘"} ${item.name}${item.ok ? "" : " — " + item.hint}`);
  }

  console.log("\n" + "=".repeat(50));
  console.log("💳 支付可联调 (Payment Ready)");
  console.log("=".repeat(50));
  for (const item of milestones.payment) {
    console.log(`${item.ok ? "✔" : "✘"} ${item.name}${item.ok ? "" : " — " + item.hint}`);
  }

  console.log("\n" + "=".repeat(50));
  console.log("📦 数据就绪 (Data Ready)");
  console.log("=".repeat(50));
  for (const item of milestones.data) {
    console.log(`${item.ok ? "✔" : "✘"} ${item.name}${item.ok ? "" : " — " + item.hint}`);
  }

  console.log("\n" + "=".repeat(50));
  console.log("🌐 平台事项 (Platform Tasks)");
  console.log("=".repeat(50));
  for (const item of milestones.platform) {
    console.log(`${item.ok ? "✔" : "⏳"} ${item.name}${item.ok ? "" : " — " + item.hint}`);
  }

  const allItems = [...milestones.dev, ...milestones.payment, ...milestones.data];
  const allOk = allItems.every(item => item.ok);
  console.log("\n" + "=".repeat(50));
  console.log(allOk ? "✔ 所有检查通过" : "⏳ 部分检查未通过");
  console.log("=".repeat(50));

  process.exitCode = allOk ? 0 : 1;
}

main().catch(error => {
  console.error("执行失败:", error);
  process.exitCode = 1;
});
