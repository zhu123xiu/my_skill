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
const requiredFields = ["TCB_SECRET_ID", "TCB_SECRET_KEY", "TCB_ENV"];
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

  console.log("\n=== 创建集合 ===");
  const collections = config.collections || [];
  if (collections.length === 0) {
    console.log("警告: config.collections 为空");
    return;
  }

  for (const coll of collections) {
    const fullName = config.collectionPrefix + coll.name;
    try {
      await db.createCollection(fullName);
      console.log(`✔ 新建成功: ${fullName}`);
    } catch (error) {
      const message = String(error && (error.errMsg || error.message || error));
      if (/exist|already|COLLECTION_EXIST/i.test(message)) {
        console.log(`⏳ 已存在跳过: ${fullName}`);
      } else {
        console.error(`✘ 创建失败: ${fullName} - ${error.message}`);
      }
    }
  }

  console.log("\n=== 创建索引 ===");
  // IMPORTANT: The field name is `indexes` not `indices` - this is a common pitfall
  for (const coll of collections) {
    if (!coll.indexes || coll.indexes.length === 0) {
      continue;
    }

    const fullName = config.collectionPrefix + coll.name;
    console.log(`\n集合: ${fullName}`);

    for (const indexDef of coll.indexes) {
      try {
        // Build index keys array from object
        const keys = Object.entries(indexDef).map(([field, direction]) => ({
          field,
          direction: direction === 1 ? "asc" : "desc"
        }));

        // Use runCommands to create indexes
        // Note: TCB uses `indexes` field name, not `indices`
        await app.database().runCommand({
          createIndexes: fullName,
          indexes: [{
            keys,
            name: keys.map(k => `${k.field}_${k.direction}`).join("_")
          }]
        });

        console.log(`  ✔ 新建索引: ${JSON.stringify(indexDef)}`);
      } catch (error) {
        const message = String(error && (error.errMsg || error.message || error));
        if (/exist|already|duplicate/i.test(message)) {
          console.log(`  ⏳ 索引已存在跳过: ${JSON.stringify(indexDef)}`);
        } else {
          console.error(`  ✘ 索引创建失败: ${JSON.stringify(indexDef)} - ${error.message}`);
        }
      }
    }
  }

  console.log("\n✔ 集合和索引初始化完成");
}

main().catch(error => {
  console.error("执行失败:", error);
  process.exitCode = 1;
});
