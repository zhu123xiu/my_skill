const crypto = require("crypto");

function sortValueSignature(fields, salt) {
  return [...Object.values(fields || {}), salt].map(String).sort().join("");
}

function buildAuthorization({ appId, privateKeyPem, keyVersion, method, uri, body }) {
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomBytes(8).toString("hex");
  const raw = `${method}\n${uri}\n${timestamp}\n${nonce}\n${body || ""}\n`;
  const signature = crypto.createSign("RSA-SHA256").update(raw).sign(privateKeyPem, "base64");
  return `SHA256-RSA2048 appid=${appId},nonce_str=${nonce},timestamp=${timestamp},key_version=${keyVersion},signature=${signature}`;
}

module.exports = { sortValueSignature, buildAuthorization };
