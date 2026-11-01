// 模板文件，零改动使用。
// 安全红线：
// - DINGTALK_SECRET 泄露 = 任何人可往群里发消息；处置 = 机器人设置里「重置」后更新容器环境变量。
// - 密钥严禁入码、入库、入文档正文、入 git 历史；只走容器环境变量 DINGTALK_TOKEN / DINGTALK_SECRET。
// - 发送失败绝不重试、绝不阻塞、绝不抛出——支付链路可用性优先于通知可达性。
// - 不配 token/secret 时功能整体静默关闭，支付/退款/权益链路行为完全不受影响。
const crypto = require("crypto");
const https = require("https");

// fire-and-forget：任一密钥缺失即静默 return；全程 try/catch，不 throw、不阻塞。
function notifyDingTalk(title, markdownText) {
  const token = process.env.DINGTALK_TOKEN;
  const secret = process.env.DINGTALK_SECRET;
  if (!token || !secret) return;
  try {
    const timestamp = Date.now();
    const sign = encodeURIComponent(
      crypto.createHmac("sha256", secret).update(`${timestamp}\n${secret}`).digest("base64")
    );
    const body = JSON.stringify({
      msgtype: "markdown",
      markdown: { title, text: markdownText },
    });
    const url = `https://oapi.dingtalk.com/robot/send?access_token=${token}&timestamp=${timestamp}&sign=${sign}`;
    const request = https.request(
      url,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(body),
        },
      },
      (response) => {
        response.on("data", () => {});
        response.on("end", () => {});
      }
    );
    request.on("error", () => {});
    request.write(body);
    request.end();
  } catch (_) {}
}

// 分 → "¥xx.xx" 字符串
function fenToYuan(fen) {
  const yuan = Number(fen || 0) / 100;
  return "¥" + yuan.toFixed(2);
}

// 东八区时间字符串（不依赖容器时区设置）
function nowText() {
  const d = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
  );
}

module.exports = { notifyDingTalk, fenToYuan, nowText };