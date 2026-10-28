# Setup Scripts - Implementation Summary

All four setup scripts have been fully implemented and are ready to use.

## Scripts Overview

### 1. doctor.js (Most Important)
**Purpose**: Comprehensive environment check with milestone-based output

**Checks by milestone**:

**🚀 开发就绪 (Dev Ready)**:
- Configuration completeness (no unresolved `{{` placeholders)
- appId format validation (regex: `^tt[a-z0-9]{16}$`)
- envId format validation (starts with `env-`)
- collectionPrefix is set
- .secrets.local.json exists
- All required secret fields are filled (TCB_SECRET_ID, TCB_SECRET_KEY, TCB_ENV, privateKey, publicKey, salt, appSecret)
- TCB connectivity test using @cloudbase/node-sdk

**💳 支付可联调 (Payment Ready)**:
- platform_secrets collection exists
- Secrets document exists (using config.payment.secretsDocId)
- Document contains privateKey, salt, publicKey
- Local sign + verify self-consistency check
- client_token acquisition test via Douyin API

**📦 数据就绪 (Data Ready)**:
- All collections from config.collections exist
- Index existence check (manual verification noted)

**🌐 平台事项 (Platform Tasks)**:
- References platform-tasks.md
- Lists platform tasks that need manual completion

**Output format**: ✔/✘/⏳ with fix guidance for each failed check

### 2. setup-secrets.js
**Purpose**: Upload secrets to database

**Functionality**:
- Reads .secrets.local.json
- Validates required fields
- Initializes @cloudbase/node-sdk with AK/SK/ENV
- Writes to `{prefix}platform_secrets` collection
- Document ID: config.payment.secretsDocId (default: "dy_payment")
- Uses `set()` for idempotent overwrite
- Includes subjectProfile fields if present
- Never prints secret values
- Output: "已写入 N 个键"

### 3. init-collections.js
**Purpose**: Create collections and indexes

**Functionality**:
- Reads config.collections from template.config.js
- Initializes @cloudbase/node-sdk
- For each collection: creates `{prefix}{name}`
- Idempotent: catches "already exists" errors
- For each indexes array: uses `runCommands({ createIndexes: ... })`
- **IMPORTANT**: Field name is `indexes` not `indices` (comment added)
- Output: "已存在跳过 / 新建成功" for each collection and index

### 4. import-data.js
**Purpose**: Import data from JSON files

**Functionality**:
- Reads `./data/*.json` files (excludes .schema.json)
- Maps filename to collection name (adds prefix from config)
- Batch processing: 100 records per batch
- Error tolerance: continues on individual record failures (resume capability)
- Uses `set()` for idempotent upsert
- References source logic from `cloudfunctions/importData/index.js`
- Uses TCB direct write (not cloud function)
- Output: "已导入 X/Y 条" with progress updates

## Common Features

All scripts:
- Use `require("../templates/server/template.config")` for config
- Use `require("./.secrets.local.json")` for secrets
- Provide clear error messages if secrets file is missing
- Are runnable with `node setup/xxx.js`
- Properly handle async operations with async/await
- Validate required fields before execution
- Use @cloudbase/node-sdk for all cloud operations

## Usage

```bash
# Check environment status
node setup/doctor.js

# Upload secrets to database
node setup/setup-secrets.js

# Create collections and indexes
node setup/init-collections.js

# Import data (optional: specify custom data directory)
node setup/import-data.js
node setup/import-data.js /path/to/custom/data
```

## Dependencies

All scripts require:
- @cloudbase/node-sdk (install: `npm install @cloudbase/node-sdk`)
- Node.js with async/await support

## Files Modified

- `/Users/zzz/Downloads/person_code/my_skill/douyin-miniprogram-playbook/setup/doctor.js`
- `/Users/zzz/Downloads/person_code/my_skill/douyin-miniprogram-playbook/setup/setup-secrets.js`
- `/Users/zzz/Downloads/person_code/my_skill/douyin-miniprogram-playbook/setup/init-collections.js`
- `/Users/zzz/Downloads/person_code/my_skill/douyin-miniprogram-playbook/setup/import-data.js`

## Directory Created

- `/Users/zzz/Downloads/person_code/my_skill/douyin-miniprogram-playbook/setup/data/` (empty, ready for data files)
