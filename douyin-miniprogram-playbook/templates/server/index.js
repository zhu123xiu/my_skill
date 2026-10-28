// 模板文件，零改动使用；业务值在 template.config.js
const fs = require("fs");
const path = require("path");
const express = require("express");
const config = require("./template.config");
const cloud = require("./core/wx-compat");
const payment = require("./core/payment");

const { runWithOpenid } = cloud;
const app = express();

// ---------------------------------------------------------------------------
// rawBody capture for /api/pay/notify (essential for signature verification)
// Must be mounted BEFORE the general express.json middleware.
// ---------------------------------------------------------------------------
app.use(
  "/api/pay/notify",
  express.json({
    limit: "1mb",
    verify: (request, _response, buffer) => {
      request.rawBody = buffer.toString("utf8");
    },
  })
);

// General JSON parser for all other routes.
app.use(express.json({ limit: "1mb" }));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract openid from Douyin mini-program header or request body.
 */
function requesterOpenid(request) {
  return String(
    request.get("x-tt-openid") || request.body.openid || ""
  ).trim();
}

/**
 * node-sdk pitfall #1: update result shape varies across SDK versions.
 * Re-exported from payment module for convenience.
 */
function countUpdated(result) {
  return payment.countUpdated(result);
}

/**
 * Extract trade number from various response shapes.
 */
function extractTradeNo(data) {
  return payment.extractTradeNo(data);
}

/**
 * Map OpenAPI error to client-friendly shape.
 */
function mapApiError(error) {
  return payment.mapApiError(error);
}

// ---------------------------------------------------------------------------
// Directory auto-scan for services (no hardcoded whitelist)
// ---------------------------------------------------------------------------

const servicesDir = path.join(__dirname, "services");
const availableServices = new Set();
try {
  fs.readdirSync(servicesDir)
    .filter((name) => /\.js$/.test(name))
    .forEach((name) => {
      availableServices.add(name.replace(/\.js$/, ""));
    });
} catch (_error) {
  // services/ directory may not exist yet; that is fine.
}

/**
 * Lazy-load a service module by name.
 * Returns null if the service file does not exist or fails to load.
 */
function loadService(name) {
  if (!availableServices.has(name)) return null;
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) return null;
  try {
    return require(`./services/${name}`);
  } catch (_error) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Rate limiting for clientLog (simple in-memory, per-process)
// ---------------------------------------------------------------------------

const clientLogRate = new Map();

function rateLimitClientLog(identity) {
  const now = Date.now();
  const previous = clientLogRate.get(identity);
  if (!previous || now - previous.startedAt >= 60 * 1000) {
    clientLogRate.set(identity, { startedAt: now, count: 1 });
    return true;
  }
  if (previous.count >= 10) return false;
  previous.count += 1;
  return true;
}

// ---------------------------------------------------------------------------
// Health endpoint
// ---------------------------------------------------------------------------

app.get("/health", (_request, response) => {
  response.json({ ok: true, service: "api" });
});

// ---------------------------------------------------------------------------
// Client log endpoint (rate-limited per openid+IP)
// ---------------------------------------------------------------------------

app.post("/api/clientLog", (request, response) => {
  const openid = requesterOpenid(request);
  const identity = `${openid || "anonymous"}:${request.ip || ""}`;
  if (!rateLimitClientLog(identity)) {
    return response
      .status(429)
      .json({ success: false, message: "日志上报频率过高" });
  }
  const body = request.body || {};
  console.error("[clientLog]", {
    appId: String(body.appId || "").slice(0, 64),
    tag: String(body.tag || "unknown").slice(0, 128),
    detail: String(body.detail || "").slice(0, 2048),
    page: String(body.page || "").slice(0, 256),
    appVersion: String(body.appVersion || "").slice(0, 128),
  });
  return response.json({ success: true });
});

// ---------------------------------------------------------------------------
// Payment routes (delegate to core/payment.js)
// ---------------------------------------------------------------------------

/**
 * POST /api/pay — generic payment entry point.
 * Business-specific pay logic (createOrder, redeemActivationCode, etc.)
 * should be implemented in a services/pay.js that calls payment module helpers.
 *
 * This route delegates to services/pay.js if it exists, otherwise returns 501.
 */
app.post("/api/pay", async (request, response) => {
  const service = loadService("pay");
  if (!service || typeof service.main !== "function") {
    return response
      .status(501)
      .json({ success: false, message: "支付服务未配置" });
  }
  const openid = requesterOpenid(request);
  try {
    const result = await runWithOpenid(openid, () =>
      service.main(request.body || {}, {})
    );
    return response.json(result || { success: true });
  } catch (error) {
    const mapped = mapApiError(error);
    return response
      .status(mapped.statusCode)
      .json({ success: false, message: mapped.message });
  }
});

/**
 * POST /api/pay/notify — Douyin payment callback.
 * Verifies signature, checks amount, settles order idempotently.
 *
 * The settleOrder and findOrderByTradeNo callbacks must be provided by
 * services/pay.js (or a dedicated payment business module).
 */
app.post("/api/pay/notify", async (request, response) => {
  // Load business-specific callbacks if a pay service exists.
  let settleOrder = async () => true;
  let findOrderByTradeNo = async () => null;
  const payService = loadService("pay");
  if (payService && typeof payService.settleOrder === "function") {
    settleOrder = payService.settleOrder;
  }
  if (payService && typeof payService.findOrderByTradeNo === "function") {
    findOrderByTradeNo = payService.findOrderByTradeNo;
  }
  try {
    await payment.payNotifyHandler(request, response, {
      settleOrder,
      findOrderByTradeNo,
    });
  } catch (error) {
    console.error("[payNotify] error:", error.message);
    if (!response.headersSent) {
      response.status(200).json({ err_no: 1, err_tips: "INTERNAL_ERROR" });
    }
  }
});

/**
 * POST /api/pay/syncOrderStatus — active order query fallback.
 */
app.post("/api/pay/syncOrderStatus", async (request, response) => {
  const outOrderNo = String(request.body.outOrderNo || "").trim();
  let findOrderByTradeNo = async () => null;
  let settleOrder = async () => true;
  const payService = loadService("pay");
  if (payService && typeof payService.findOrderByTradeNo === "function") {
    findOrderByTradeNo = payService.findOrderByTradeNo;
  }
  if (payService && typeof payService.settleOrder === "function") {
    settleOrder = payService.settleOrder;
  }
  try {
    const result = await payment.syncOrderStatusHandler(outOrderNo, {
      settleOrder,
      findOrderByTradeNo,
    });
    return response.json({ success: true, ...result });
  } catch (error) {
    const mapped = mapApiError(error);
    return response
      .status(mapped.statusCode)
      .json({ success: false, message: mapped.message });
  }
});

// ---------------------------------------------------------------------------
// Generic service router: /api/:name
// Directory auto-scan — file name = service name, lazy require.
// Returns 404 for unknown services (no hardcoded whitelist).
// ---------------------------------------------------------------------------

app.post("/api/:name", async (request, response) => {
  const name = request.params.name;
  const service = loadService(name);
  if (!service || typeof service.main !== "function") {
    return response
      .status(404)
      .json({ success: false, message: `unknown service: ${name}` });
  }
  const openid = requesterOpenid(request);
  try {
    const result = await runWithOpenid(openid, () =>
      service.main(request.body || {}, {})
    );
    return response.json(result || { success: true });
  } catch (error) {
    console.error("service error", name, error.message);
    return response
      .status(500)
      .json({ success: false, message: error.message || "服务异常" });
  }
});

// ---------------------------------------------------------------------------
// Error middleware (must be last, 4-arg signature)
// ---------------------------------------------------------------------------

app.use((error, _request, response, _next) => {
  console.error("[express error]", error.message);
  response
    .status(error.status || 500)
    .json({ success: false, message: error.message || "服务异常" });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const port = Number(process.env.PORT || 3000);
if (require.main === module) {
  app.listen(port, () => console.log(`server listening on ${port}`));
}

module.exports = app;
