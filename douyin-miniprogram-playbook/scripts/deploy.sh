#!/usr/bin/env bash
# 部署脚本参考模板
#
# 用法：
#   chmod +x scripts/deploy.sh
#   ./scripts/deploy.sh
#
# 环境变量（或在 .env 文件中配置）：
#   TCB_ENV        - 云开发环境 ID
#   TCB_SECRET_ID  - 云开发密钥 ID
#   TCB_SECRET_KEY - 云开发密钥 Key
#   PROJECT_PATH   - 项目根目录路径（默认当前目录）

set -euo pipefail

# ─── 配置 ────────────────────────────────────────────────────────
PROJECT_PATH="${PROJECT_PATH:-$(pwd)}"
SERVER_DIR="${PROJECT_PATH}/douyin-cloud/server"

# ─── 检查环境变量 ────────────────────────────────────────────────
if [ -z "${TCB_ENV:-}" ]; then
  echo "❌ 缺少 TCB_ENV 环境变量"
  exit 1
fi

if [ -z "${TCB_SECRET_ID:-}" ] || [ -z "${TCB_SECRET_KEY:-}" ]; then
  echo "❌ 缺少 TCB_SECRET_ID 或 TCB_SECRET_KEY 环境变量"
  exit 1
fi

echo "🚀 开始部署"
echo "   环境: ${TCB_ENV}"
echo "   项目: ${SERVER_DIR}"

# ─── 安装依赖 ────────────────────────────────────────────────────
echo ""
echo "📦 安装依赖..."
cd "${SERVER_DIR}"
if [ -f "pnpm-lock.yaml" ]; then
  pnpm install --frozen-lockfile
elif [ -f "package-lock.json" ]; then
  npm ci
else
  npm install
fi

# ─── 部署云托管 ──────────────────────────────────────────────────
echo ""
echo "🌐 部署云托管服务..."
echo "   提示：抖音云托管部署通常通过控制台或 CI/CD 完成"
echo "   参考文档：https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/develop/server/cloudbase/hosting"

# 如果使用 Docker 部署：
# docker build -t my-service .
# docker push <registry>/my-service:latest

# ─── 部署云函数（如有） ──────────────────────────────────────────
echo ""
echo "⚡ 部署云函数..."
# 如果使用云函数：
# ${installPath} cloud functions deploy --e ${TCB_ENV} --n quickstartFunctions --r --project ${PROJECT_PATH}

# ─── 验证部署 ────────────────────────────────────────────────────
echo ""
echo "✅ 部署完成"
echo "   请验证："
echo "   1. 健康检查：GET /health → { ok: true }"
echo "   2. 支付回调：/api/pay/notify 可达"
echo "   3. 服务路由：/api/:name 正常响应"

echo ""
echo "📋 部署顺序铁律："
echo "   1. 后端先发布 prod → 验证"
echo "   2. 前端切环境 → 验证流量"
echo "   3. 再提审"
echo "   （反了就是 callContainer fail 10401）"
