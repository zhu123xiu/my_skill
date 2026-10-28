// 模板文件，零改动使用；业务值在 template.config.js
const crypto = require("crypto");
const https = require("https");
const config = require("../template.config");
const cloud = require("./wx-compat");

const db = cloud.database();

// ---------------------------------------------------------------------------
// Secret & token management
// ---------------------------------------------------------------------------

let dySecret = null;
let clientToken = null;

/**
 * Read platform signing secret from database.
 * Document id comes from config.payment.secretsDocId.
 */
async function loadDySecret({ force = false } = {}) {
  if (dySecret && !force) return dySecret;
  const docId = config.payment.secretsDocId || "dy_payment";
  const collectionName = (config.collectionPrefix || "") + "platform_secrets";
  const response = await db.collection(collectionName).doc(docId).get();
  const data = response && response.data;
  dySecret = Array.isArray(data) ? data[0] : data;
  if (!dySecret) {
    throw new Error(`${collectionName}.${docId} 缺失，无法签名`);
  }
  return dySecret;
}

/**
 * HTTPS request to Douyin OAuth client_token endpoint.
 */
function requestClientToken(secret) {
  return new Promise((resolve, reject) => {
    const query = new URLSearchParams({
      client_key: secret.appId || process.env.DOUYIN_APP_ID || "",
      client_secret: secret.appSecret || "",
      grant_type: "client_credential",
    });
    const request = https.get(
      `https://open.douyin.com/oauth/client_token/?${query.toString()}`,
      { headers: { accept: "application/json" } },
      (response) => {
        let text = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          text += chunk;
        });
        response.on("end", () => {
          try {
            const payload = JSON.parse(text || "{}");
            const data = payload.data || {};
            if (
              response.statusCode >= 400 ||
              payload.error_code ||
              !data.access_token
            ) {
              const error = new Error(
                payload.description ||
                  payload.error_description ||
                  "抖音 access-token 获取失败"
              );
              error.statusCode = response.statusCode;
              error.response = payload;
              reject(error);
              return;
            }
            resolve(data);
          } catch (error) {
            reject(error);
          }
        });
      }
    );
    request.on("error", reject);
  });
}

/**
 * Cached client token with 2-hour TTL, 5-minute early renewal.
 * Pass { force: true } to bypass cache (e.g. after 401).
 */
async function getClientToken({ force = false } = {}) {
  const now = Date.now();
  if (
    clientToken &&
    !force &&
    clientToken.accessToken &&
    now < clientToken.expiresAt - 5 * 60 * 1000
  ) {
    return clientToken.accessToken;
  }
  try {
    const secret = await loadDySecret();
    const result = await requestClientToken(secret);
    const expiresIn = Number(result.expires_in || 7200);
    clientToken = {
      accessToken: result.access_token,
      expiresAt: now + expiresIn * 1000,
    };
    return clientToken.accessToken;
  } catch (error) {
    if (!force) return getClientToken({ force: true });
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Signing helpers
// ---------------------------------------------------------------------------

/**
 * Pure value-sorting signature (NOT key=value).
 * Extract all field values + salt as array, sort, concatenate.
 * This was a real pitfall — the platform expects value-only sorting.
 */
function sortValueSignature(params, salt) {
  return [...Object.values(params || {}), salt]
    .map(String)
    .sort()
    .join("");
}

/**
 * RSA-SHA256 authorization string for Douyin OpenAPI requests.
 * Format: SHA256-RSA2048 appid=...,nonce_str=...,timestamp=...,key_version=...,signature=...
 */
function buildDyAuthorization(method, uri, data, secret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomBytes(8).toString("hex");
  const raw = `${method}\n${uri}\n${timestamp}\n${nonce}\n${data}\n`;
  const signature = crypto
    .createSign("RSA-SHA256")
    .update(raw, "utf8")
    .sign(secret.privateKeyPem, "base64");
  return (
    `SHA256-RSA2048 appid=${secret.appId},nonce_str=${nonce},` +
    `timestamp=${timestamp},key_version=${secret.keyVersion},signature=${signature}`
  );
}

/**
 * Build order params with byte-authorization for /requestOrder.
 */
function buildDyOrderParams(orderParams, secret) {
  const data = JSON.stringify(orderParams);
  return {
    data,
    byteAuthorization: buildDyAuthorization("POST", "/requestOrder", data, secret),
  };
}

/**
 * Callback signature verification (Byte-Signature header).
 * Verifies: timestamp\nnonce\nrawBody\n against platform public key.
 */
function buildByteSign(timestamp, nonce, rawBody, secret) {
  if (!secret || !secret.platformPublicKeyPem) return false;
  const raw = `${timestamp}\n${nonce}\n${rawBody}\n`;
  // Returns verification result — caller compares with the Byte-Signature header.
  // For signing outbound, use crypto.createSign; for verifying inbound, use createVerify.
  return { raw, publicKey: secret.platformPublicKeyPem };
}

function verifyByteSignature(timestamp, nonce, rawBody, signature, secret) {
  if (!secret || !secret.platformPublicKeyPem) return false;
  const raw = `${timestamp}\n${nonce}\n${rawBody}\n`;
  return crypto
    .createVerify("RSA-SHA256")
    .update(raw, "utf8")
    .verify(secret.platformPublicKeyPem, signature, "base64");
}

// ---------------------------------------------------------------------------
// OpenAPI request layer
// ---------------------------------------------------------------------------

/**
 * Generic OpenAPI POST with Byte-Authorization header.
 * Path is appended to the trade_basic base URL.
 */
function postOpenApi(path, data, secret, accessToken) {
  return new Promise((resolve, reject) => {
    const uri = `/api/trade_basic/v1/developer/${path}`;
    const request = https.request(`https://open.douyin.com${uri}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(data),
        "access-token": accessToken,
        "Byte-Authorization": buildDyAuthorization("POST", uri, data, secret),
      },
    }, (response) => {
      let text = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        text += chunk;
      });
      response.on("end", () => {
        try {
          const payload = JSON.parse(text || "{}");
          if (response.statusCode >= 400 || payload.err_no) {
            const error = new Error(
              payload.err_tips || payload.message || "抖音 OpenAPI 请求失败"
            );
            error.statusCode = response.statusCode;
            error.response = payload;
            reject(error);
            return;
          }
          resolve(payload);
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on("error", reject);
    request.write(data);
    request.end();
  });
}

/**
 * Wrapper with auto-retry:
 *   - on token failure (403 / access_token errors): force refresh token
 *   - on signature failure: force refresh secret + token
 */
async function openApiPost(path, body) {
  const data = JSON.stringify(body || {});
  let secret = await loadDySecret();
  let accessToken = await getClientToken();
  try {
    return await postOpenApi(path, data, secret, accessToken);
  } catch (error) {
    const text = String(error && error.message).toLowerCase();
    const responseText = JSON.stringify(
      (error && error.response) || {}
    ).toLowerCase();
    const tokenFailure =
      (error && error.statusCode === 403) ||
      /28001003|access.?token|token invalid|forbidden/.test(
        `${text} ${responseText}`
      );
    if (tokenFailure) {
      accessToken = await getClientToken({ force: true });
      return postOpenApi(path, data, secret, accessToken);
    }
    if (!/(signature|sign|key.?version|11084)/i.test(text)) throw error;
    secret = await loadDySecret({ force: true });
    accessToken = await getClientToken({ force: true });
    return postOpenApi(path, data, secret, accessToken);
  }
}

// ---------------------------------------------------------------------------
// Payment helpers (skeletons — business logic goes in the consuming service)
// ---------------------------------------------------------------------------

/**
 * Check if a status string indicates a paid/success state.
 */
function isPaidStatus(value) {
  const status = String(value || "").toUpperCase();
  return ["STATUS_SUCCESS", "SUCCESS", "PAID", "PAY_SUCCESS"].includes(status);
}

/**
 * node-sdk pitfall #1: update result shape varies.
 * Safely extract the updated count from different SDK response formats.
 */
function countUpdated(result) {
  if (!result) return 0;
  if (typeof result.updated === "number") return result.updated;
  if (result.stats && typeof result.stats.updated === "number") {
    return result.stats.updated;
  }
  return 0;
}

/**
 * Extract trade number from various response shapes.
 */
function extractTradeNo(data) {
  if (!data) return "";
  return (
    data.out_order_no ||
    data.outOrderNo ||
    data.order_id ||
    data.orderId ||
    ""
  );
}

/**
 * Map OpenAPI error to a client-friendly response shape.
 */
function mapApiError(error) {
  const statusCode = (error && error.statusCode) || 500;
  const message =
    (error && error.response && (error.response.err_tips || error.response.message)) ||
    (error && error.message) ||
    "服务异常";
  return { statusCode, message };
}

/**
 * Payment callback handler skeleton.
 * - Timestamp anti-replay (10-minute window)
 * - Verify Byte-Signature against platform public key
 * - Amount check against config products
 * - Idempotent settle (only settle if order status is still pending)
 *
 * The actual settle/entitlement logic is business-specific and must be
 * provided by the consuming service via callbacks.
 */
async function payNotifyHandler(request, response, { settleOrder, findOrderByTradeNo }) {
  const successResponse = () =>
    response.status(200).json({ err_no: 0, err_tips: "success" });
  const failureResponse = (message) =>
    response.status(200).json({ err_no: 1, err_tips: message });

  // --- Timestamp anti-replay (10 min) ---
  const timestamp = request.get("Byte-Timestamp") || "";
  if (timestamp && Math.abs(Date.now() / 1000 - Number(timestamp)) > 600) {
    return failureResponse("TIMESTAMP_EXPIRED");
  }

  // --- Signature verification ---
  const nonce = request.get("Byte-Nonce-Str") || "";
  const signature = request.get("Byte-Signature") || "";
  const rawBody = request.rawBody || JSON.stringify(request.body || {});

  if (!timestamp || !nonce || !signature) {
    return failureResponse("SIGNATURE_MISSING");
  }

  let secret = await loadDySecret();
  let verified = verifyByteSignature(timestamp, nonce, rawBody, signature, secret);
  if (!verified) {
    secret = await loadDySecret({ force: true });
    verified = verifyByteSignature(timestamp, nonce, rawBody, signature, secret);
  }
  if (!verified) return failureResponse("SIGN_ERROR");

  // --- Parse message ---
  let message;
  try {
    message =
      typeof request.body.msg === "string"
        ? JSON.parse(request.body.msg)
        : request.body.msg || request.body;
  } catch (_error) {
    return failureResponse("INVALID_MESSAGE");
  }

  // Non-payment messages (refund, settlement) are acknowledged idempotently.
  if (request.body.type !== "payment") return successResponse();
  if (message.status !== "SUCCESS") return successResponse();

  // --- Order lookup ---
  const outOrderNo = message.out_order_no;
  if (!outOrderNo) return failureResponse("ORDER_NOT_FOUND");

  const order = await findOrderByTradeNo(outOrderNo);
  if (!order) return failureResponse("ORDER_NOT_FOUND");

  // --- Amount check against config products ---
  if (
    message.total_amount !== undefined &&
    Number(message.total_amount) !== Number(order.goodsPrice)
  ) {
    return failureResponse("AMOUNT_MISMATCH");
  }

  // --- Idempotent settle ---
  const settled = await settleOrder(order, {
    orderId: message.order_id || "",
    totalAmount: message.total_amount,
  });
  if (!settled) return failureResponse("AMOUNT_MISMATCH");
  return successResponse();
}

/**
 * Active order query fallback skeleton.
 * Queries the Douyin OpenAPI for current order status and settles if paid.
 * Business-specific settle logic is injected via callbacks.
 */
async function syncOrderStatusHandler(outOrderNo, { settleOrder, findOrderByTradeNo }) {
  if (!outOrderNo) return { status: "pending" };

  const order = await findOrderByTradeNo(outOrderNo);
  if (!order) return { status: "pending" };
  if (order.status === "paid" || order.status === "delivered") {
    return { status: "paid" };
  }

  let queryResult;
  try {
    queryResult = await openApiPost("order_query/", {
      out_order_no: outOrderNo,
    });
  } catch (_error) {
    return { status: "pending" };
  }

  const queryData =
    queryResult && queryResult.data ? queryResult.data : queryResult || {};
  const paymentInfo =
    queryData.payment_info ||
    (queryData.order_info && queryData.order_info.payment_info) ||
    {};
  const payStatus = paymentInfo.pay_status || queryData.pay_status;

  if (!isPaidStatus(payStatus)) {
    const normalized = String(payStatus || "").toUpperCase();
    return {
      status: /FAIL|CANCEL|CLOSED|REFUND/.test(normalized) ? "failed" : "pending",
    };
  }

  const settled = await settleOrder(order, {
    orderId: queryData.order_id || paymentInfo.order_id || "",
    totalAmount:
      paymentInfo.total_amount !== undefined
        ? paymentInfo.total_amount
        : queryData.total_amount,
  });
  return { status: settled ? "paid" : "failed" };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  // Secret & token
  loadDySecret,
  requestClientToken,
  getClientToken,
  // Signing
  sortValueSignature,
  buildDyAuthorization,
  buildDyOrderParams,
  buildByteSign,
  verifyByteSignature,
  // OpenAPI
  postOpenApi,
  openApiPost,
  // Helpers
  isPaidStatus,
  countUpdated,
  extractTradeNo,
  mapApiError,
  // Handler skeletons
  payNotifyHandler,
  syncOrderStatusHandler,
};
