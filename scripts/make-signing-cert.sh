#!/bin/bash
# 确保本机登录钥匙串存在本地代码签名证书。
# macOS 通知授权跟随应用的代码签名身份：身份不固定时，每次重新打包覆盖安装
# 都会被系统当成"变了的应用"静默丢弃通知。固定的自签名证书可让授权跨重装保留。
# 幂等：证书已存在直接退出；不依赖 Apple 开发者账号，仅本机生效。
set -euo pipefail

IDENTITY="Study Timer Local Dev"
KEYCHAIN="$HOME/Library/Keychains/login.keychain-db"

if security find-identity -v -p codesigning 2>/dev/null | grep -q "\"${IDENTITY}\""; then
  echo "[signing] identity \"${IDENTITY}\" already present"
  exit 0
fi

echo "[signing] creating self-signed codesigning certificate \"${IDENTITY}\"..."
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

openssl req -newkey rsa:2048 -nodes -keyout "$WORKDIR/key.pem" \
  -x509 -days 3650 -out "$WORKDIR/cert.pem" \
  -subj "/CN=${IDENTITY}/O=Study Timer Local" \
  -addext "keyUsage=critical,digitalSignature" \
  -addext "extendedKeyUsage=critical,codeSigning"

openssl pkcs12 -export -out "$WORKDIR/cert.p12" \
  -inkey "$WORKDIR/key.pem" -in "$WORKDIR/cert.pem" \
  -name "${IDENTITY}" -passout pass:study-timer-local

security import "$WORKDIR/cert.p12" -k "$KEYCHAIN" \
  -P study-timer-local -T /usr/bin/codesign -T /usr/bin/security

# 信任设置非必需：本地 ditto 覆盖安装不带 quarantine，不经过 Gatekeeper；
# add-trusted-cert 个别系统会要求授权确认，失败不影响签名与通知授权。
security add-trusted-cert -p codeSign -k "$KEYCHAIN" "$WORKDIR/cert.pem" 2>/dev/null || true

security find-identity -v -p codesigning | grep -q "\"${IDENTITY}\"" || {
  echo "[signing] ERROR: certificate not available after import" >&2
  exit 1
}
echo "[signing] OK"
