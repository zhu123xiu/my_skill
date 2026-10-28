/**
 * 端到端冒烟测试框架（假 db）
 *
 * 用途：在真实云数据库凭据就绪之前，验证服务端模板能正常启动、
 * 路由可达、handler 结构正确。用内存 Map 模拟数据库。
 *
 * 运行：node scripts/e2e-smoke.js
 * 预期输出：全部 PASS 后 exit 0；任一 FAIL 则 exit 1。
 */

const http = require("http");
const path = require("path");

// ─── Mock database ───────────────────────────────────────────────
// 用 Map 模拟 @cloudbase/node-sdk 的 database() 接口，
// 覆盖 collection / where / doc / get / set / update / add / count。

const mockStore = new Map(); // collectionName → Map<docId, docData>

function getCollection(name) {
  if (!mockStore.has(name)) mockStore.set(name, new Map());
  return mockStore.get(name);
}

function makeDocRef(collectionName, docId) {
  const col = getCollection(collectionName);
  return {
    async get() {
      const data = col.get(docId);
      if (!data) {
        const err = new Error("document.get:fail document not exists");
        err.errCode = -502004;
        throw err;
      }
      return { data: { ...data, _id: docId } };
    },
    async set({ data: payload }) {
      const clean = { ...payload };
      delete clean._id;
      col.set(docId, clean);
      return { inserted: 1 };
    },
    async update({ data: payload }) {
      if (!col.has(docId)) return { updated: 0 };
      const current = col.get(docId) || {};
      col.set(docId, { ...current, ...payload });
      return { updated: 1 };
    },
    async remove() {
      col.delete(docId);
      return { deleted: 1 };
    },
  };
}

function makeQuery(collectionName, filter) {
  const col = getCollection(collectionName);
  return {
    async get() {
      const results = [];
      for (const [id, doc] of col) {
        let match = true;
        if (filter) {
          for (const [key, value] of Object.entries(filter)) {
            if (doc[key] !== value) { match = false; break; }
          }
        }
        if (match) results.push({ ...doc, _id: id });
      }
      return { data: results };
    },
    async count() {
      let count = 0;
      for (const [, doc] of col) {
        let match = true;
        if (filter) {
          for (const [key, value] of Object.entries(filter)) {
            if (doc[key] !== value) { match = false; break; }
          }
        }
        if (match) count++;
      }
      return { total: count };
    },
    async update({ data: payload }) {
      let updated = 0;
      for (const [id, doc] of col) {
        let match = true;
        if (filter) {
          for (const [key, value] of Object.entries(filter)) {
            if (doc[key] !== value) { match = false; break; }
          }
        }
        if (match) {
          col.set(id, { ...doc, ...payload });
          updated++;
        }
      }
      return { updated };
    },
    limit() { return this; },
    orderBy() { return this; },
    skip() { return this; },
  };
}

function makeCollection(name) {
  const col = getCollection(name);
  return {
    doc(id) { return makeDocRef(name, id); },
    where(filter) { return makeQuery(name, filter); },
    async add({ data: payload }) {
      const id = payload._id || `auto_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const clean = { ...payload };
      delete clean._id;
      col.set(id, clean);
      return { id, inserted: 1 };
    },
    async count() {
      return { total: col.size };
    },
  };
}

const mockDb = {
  collection(name) { return makeCollection(name); },
  serverDate() { return new Date(); },
  command: {
    inc(v) { return { __op: "inc", value: v }; },
    set(v) { return { __op: "set", value: v }; },
  },
};

// ─── Mock cloud init ─────────────────────────────────────────────
// 拦截 require("@cloudbase/node-sdk")，返回 mock db

const Module = require("module");
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request === "@cloudbase/node-sdk") {
    return "mock-cloudbase-node-sdk";
  }
  return originalResolve.call(this, request, parent, ...rest);
};

require.cache["mock-cloudbase-node-sdk"] = {
  id: "mock-cloudbase-node-sdk",
  filename: "mock-cloudbase-node-sdk",
  loaded: true,
  exports: {
    init() {
      return { database: () => mockDb };
    },
  },
};

// ─── Test runner ─────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✔ ${label}`);
    passed++;
  } else {
    console.error(`  ✘ ${label}`);
    failed++;
  }
}

function httpRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          resolve({ statusCode: res.statusCode, headers: res.headers, body: data ? JSON.parse(data) : null });
        } catch {
          resolve({ statusCode: res.statusCode, headers: res.headers, body: data });
        }
      });
    });
    req.on("error", reject);
    if (body) req.write(typeof body === "string" ? body : JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log("\n═══ E2E 冒烟测试 ═══\n");

  // Seed mock data
  const secretsCol = getCollection("test_platform_secrets");
  secretsCol.set("dy_payment", {
    appId: "tt0000000000000000",
    appSecret: "mock_secret",
    privateKeyPem: "mock_key",
    publicKeyPem: "mock_pub",
    salt: "mock_salt",
    keyVersion: "1",
  });

  // Start server
  // Clear require cache for the server module to pick up our mock
  const serverPath = path.resolve(__dirname, "../templates/server/index.js");
  delete require.cache[require.resolve(serverPath)];

  let app;
  try {
    app = require(serverPath);
  } catch (error) {
    console.error(`服务器模块加载失败: ${error.message}`);
    failed++;
    return;
  }

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  console.log(`测试服务器启动在 127.0.0.1:${port}\n`);

  // ── Test 1: health endpoint ──
  console.log("1. Health 端点");
  try {
    const res = await httpRequest({ hostname: "127.0.0.1", port, path: "/health", method: "GET" });
    assert(res.statusCode === 200, `GET /health → ${res.statusCode}`);
    assert(res.body && res.body.ok === true, "返回 { ok: true }");
  } catch (error) {
    assert(false, `health 请求失败: ${error.message}`);
  }

  // ── Test 2: unknown service → 404 ──
  console.log("\n2. 未知服务路由");
  try {
    const res = await httpRequest({
      hostname: "127.0.0.1", port, path: "/api/nonexistent_service",
      method: "POST",
      headers: { "content-type": "application/json", "x-tt-openid": "test_openid" },
    }, JSON.stringify({ action: "test" }));
    assert(res.statusCode === 404 || res.statusCode === 501, `POST /api/nonexistent → ${res.statusCode}`);
  } catch (error) {
    assert(false, `未知服务请求失败: ${error.message}`);
  }

  // ── Test 3: clientLog rate limiting ──
  console.log("\n3. clientLog 端点");
  try {
    const res = await httpRequest({
      hostname: "127.0.0.1", port, path: "/api/clientLog",
      method: "POST",
      headers: { "content-type": "application/json", "x-tt-openid": "test_openid" },
    }, JSON.stringify({ tag: "smoke", detail: "test log", appId: "tt0000000000000000" }));
    assert(res.statusCode === 200, `POST /api/clientLog → ${res.statusCode}`);
    assert(res.body && res.body.success === true, "返回 { success: true }");
  } catch (error) {
    assert(false, `clientLog 请求失败: ${error.message}`);
  }

  // ── Test 4: service handler (health.js if exists) ──
  console.log("\n4. 服务 handler 路由");
  try {
    const res = await httpRequest({
      hostname: "127.0.0.1", port, path: "/api/health",
      method: "POST",
      headers: { "content-type": "application/json", "x-tt-openid": "test_openid" },
    }, JSON.stringify({ action: "check" }));
    assert(res.statusCode === 200, `POST /api/health → ${res.statusCode}`);
    assert(res.body && res.body.success === true, "health handler 返回 success");
  } catch (error) {
    assert(false, `handler 请求失败: ${error.message}`);
  }

  // ── Test 5: pay notify requires rawBody ──
  console.log("\n5. 支付回调 rawBody");
  try {
    const res = await httpRequest({
      hostname: "127.0.0.1", port, path: "/api/pay/notify",
      method: "POST",
      headers: { "content-type": "application/json" },
    }, JSON.stringify({ type: "payment", msg: "{}" }));
    // Should fail signature check but NOT crash
    assert(res.statusCode === 200, `POST /api/pay/notify → ${res.statusCode} (不崩溃)`);
    assert(res.body && res.body.err_no !== undefined, "返回 err_no 字段");
  } catch (error) {
    assert(false, `pay/notify 请求失败: ${error.message}`);
  }

  // ── Test 6: error middleware ──
  console.log("\n6. 错误中间件");
  try {
    const res = await httpRequest({
      hostname: "127.0.0.1", port, path: "/api/health",
      method: "POST",
      headers: { "content-type": "application/json" },
    }, "invalid json{{{");
    // Should get a 400 or 500, not crash
    assert(res.statusCode >= 400, `非法 JSON → ${res.statusCode} (不崩溃)`);
  } catch (error) {
    assert(false, `错误中间件测试失败: ${error.message}`);
  }

  // ── Summary ──
  server.close();
  console.log(`\n═══ 结果: ${passed} PASS, ${failed} FAIL ═══\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((error) => {
  console.error("冒烟测试异常:", error);
  process.exit(1);
});
