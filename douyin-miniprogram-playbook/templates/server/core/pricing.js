// 模板文件，零改动使用；业务值在 template.config.js
const config = require("../template.config");
const cloud = require("./wx-compat");

const db = cloud.database();

// Collection name derived from config prefix — never hardcode.
const CONFIG_COLLECTION = (config.collectionPrefix || "") + "app_config";
const PRICING_DOCUMENT_ID = "pricing";
const CACHE_TTL_MS = 5 * 60 * 1000;

// Default prices are 0 — project must configure real values in DB or config.
const DEFAULT_PRICING = Object.freeze({
  membershipPriceFen: 0,
  packagePriceFen: 0,
});

let cachedPricing = null;
let cacheExpiresAt = 0;

function validPrice(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

/**
 * Get current pricing configuration.
 * Strategy: DB document (app_config/pricing) → 5-min memory cache → default fallback.
 *
 * The DB document may contain any subset of pricing fields; missing or invalid
 * fields fall back to DEFAULT_PRICING values.
 */
async function getPricing() {
  const now = Date.now();
  if (cachedPricing && now < cacheExpiresAt) {
    return cachedPricing;
  }

  let pricing = DEFAULT_PRICING;
  try {
    const response = await db
      .collection(CONFIG_COLLECTION)
      .doc(PRICING_DOCUMENT_ID)
      .get();
    const document = response.data || {};
    pricing = Object.freeze({
      membershipPriceFen: validPrice(
        document.membershipPriceFen,
        DEFAULT_PRICING.membershipPriceFen
      ),
      packagePriceFen: validPrice(
        document.packagePriceFen,
        DEFAULT_PRICING.packagePriceFen
      ),
    });
  } catch (_error) {
    pricing = DEFAULT_PRICING;
  }

  cachedPricing = pricing;
  cacheExpiresAt = now + CACHE_TTL_MS;
  return pricing;
}

/**
 * Get the membership display name from config.
 */
function getMembershipName() {
  return (config.membership && config.membership.name) || "{{MEMBERSHIP_NAME}}";
}

module.exports = { getPricing, getMembershipName, DEFAULT_PRICING };
