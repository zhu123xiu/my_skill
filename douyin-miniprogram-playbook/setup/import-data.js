const fs = require("fs");
const path = require("path");

const config = require("../templates/server/template.config");
const secretsPath = path.join(__dirname, ".secrets.local.json");
const dataDir = path.resolve(process.argv[2] || path.join(__dirname, "data"));

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

if (!fs.existsSync(dataDir)) {
  console.log(`数据目录不存在: ${dataDir}`);
  console.log("没有数据需要导入");
  process.exit(0);
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
  // @cloudbase/node-sdk 用 AK/SK 直连：env + secretId + secretKey（与 server/core/db.js 一致）
  const app = tcb.init({
    env: secrets.TCB_ENV,
    secretId: secrets.TCB_SECRET_ID,
    secretKey: secrets.TCB_SECRET_KEY
  });

  const db = app.database();

  // Find all JSON files (excluding schema files)
  const jsonFiles = fs.readdirSync(dataDir).filter(name => 
    name.endsWith(".json") && !name.endsWith(".schema.json")
  );

  if (jsonFiles.length === 0) {
    console.log("没有找到数据文件");
    return;
  }

  console.log(`\n找到 ${jsonFiles.length} 个数据文件`);

  for (const fileName of jsonFiles) {
    const filePath = path.join(dataDir, fileName);
    const collectionName = fileName.replace(/\.json$/, "");
    const fullCollectionName = config.collectionPrefix + collectionName;

    console.log(`\n=== 导入: ${fileName} → ${fullCollectionName} ===`);

    let records;
    try {
      records = JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (error) {
      console.error(`  ✘ 读取失败: ${error.message}`);
      continue;
    }

    if (!Array.isArray(records)) {
      console.error(`  ✘ 数据格式错误: 必须是数组`);
      continue;
    }

    console.log(`  共 ${records.length} 条记录`);

    // Batch import (100 per batch)
    const BATCH_SIZE = 100;
    let imported = 0;
    let errors = 0;

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      
      for (const record of batch) {
        try {
          if (!record._id) {
            console.error(`  ✘ 记录缺少 _id，跳过`);
            errors++;
            continue;
          }

          const { _id: docId, ...docData } = record;

          // Use set() for idempotent upsert.
          // 本地脚本直连 @cloudbase/node-sdk，set() 收「裸对象」，
          // 不能包 {data}（那是 wx-server-sdk 约定，见 services/README 坑#5）。
          await db.collection(fullCollectionName).doc(docId).set(docData);

          imported++;
        } catch (error) {
          console.error(`  ✘ 导入失败 (ID: ${record._id}): ${error.message}`);
          errors++;
          // Continue with error tolerance for resume capability
        }
      }

      console.log(`  进度: ${Math.min(i + BATCH_SIZE, records.length)}/${records.length}`);
    }

    console.log(`  ✔ 已导入 ${imported}/${records.length} 条`);
    if (errors > 0) {
      console.log(`  ⚠ ${errors} 条记录导入失败`);
    }
  }

  console.log("\n✔ 数据导入完成");
}

main().catch(error => {
  console.error("执行失败:", error);
  process.exitCode = 1;
});
