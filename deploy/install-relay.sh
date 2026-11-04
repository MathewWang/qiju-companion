#!/usr/bin/env bash
set -euo pipefail
# Run as root from an extracted, reviewed release directory. No public ports or DNS changes.
if [[ $(id -u) != 0 ]]; then echo '请以 root 或 sudo 运行安装脚本' >&2; exit 1; fi
src=$(cd "$(dirname "$0")/.." && pwd)
test -f "$src/relay/server.mjs"
test -f "$src/relay/store.mjs"
test -f "$src/shared/agent-profile.mjs"
for command in curl tar xz openssl sha256sum; do
 if ! command -v "$command" >/dev/null; then echo "缺少 $command，请从系统仓库安装 curl tar xz openssl coreutils" >&2; exit 1; fi
done
case $(uname -m) in x86_64) arch=x64;; aarch64) arch=arm64;; *) echo '不支持的 CPU 架构' >&2; exit 1;; esac
umask 077
install -d -m 0755 /opt/zhijiao /opt/zhijiao/releases
if [[ ! -x /opt/zhijiao/node/bin/node ]]; then
 stage=$(mktemp -d)
 trap 'rm -rf "$stage"' EXIT
 curl --fail --silent --show-error --location --proto '=https' https://nodejs.org/dist/latest-v24.x/SHASUMS256.txt -o "$stage/SHASUMS256.txt"
 archive=$(awk -v suffix="-linux-$arch.tar.xz" '$2 ~ suffix"$" {print $2}' "$stage/SHASUMS256.txt")
 [[ "$archive" =~ ^node-v24\.[0-9]+\.[0-9]+-linux-(x64|arm64)\.tar\.xz$ ]]
 curl --fail --silent --show-error --location --proto '=https' "https://nodejs.org/dist/latest-v24.x/$archive" -o "$stage/$archive"
 (cd "$stage"; awk -v file="$archive" '$2==file' SHASUMS256.txt | sha256sum --check --status)
 tar -xJf "$stage/$archive" -C "$stage"
 mv "$stage/${archive%.tar.xz}" /opt/zhijiao/node
 chmod -R a+rX /opt/zhijiao/node
fi
/opt/zhijiao/node/bin/node --input-type=module -e 'import {DatabaseSync} from "node:sqlite"; const db=new DatabaseSync(":memory:"); db.close(); console.log(process.version);'
if ! id zhijiao >/dev/null 2>&1; then useradd --system --no-create-home --shell /sbin/nologin zhijiao; fi
install -d -m 0700 -o zhijiao -g zhijiao /var/lib/zhijiao
install -d -m 0700 /etc/zhijiao
if [[ ! -f /etc/zhijiao/relay.env ]]; then
 {
  printf '%s\n' HOST=127.0.0.1 PORT=4318 RELAY_DATA_DIR=/var/lib/zhijiao
  printf 'RELAY_INVITE_TOKEN=%s\n' "$(openssl rand -hex 32)"
 } > /etc/zhijiao/relay.env
 chmod 0600 /etc/zhijiao/relay.env
fi
release="/opt/zhijiao/releases/$(date -u +%Y%m%dT%H%M%SZ)-$$"
install -d -m 0755 "$release/relay" "$release/shared"
install -m 0644 "$src/shared/agent-profile.mjs" "$release/shared/"
install -m 0644 "$src/relay/server.mjs" "$src/relay/store.mjs" "$release/relay/"
/opt/zhijiao/node/bin/node --check "$release/relay/server.mjs"
/opt/zhijiao/node/bin/node --check "$release/relay/store.mjs"
if [[ -L /opt/zhijiao/current ]]; then readlink /opt/zhijiao/current > /opt/zhijiao/previous-release; fi
ln -sfn "$release" /opt/zhijiao/current
install -m 0644 "$src/deploy/zhijiao-relay.service" /etc/systemd/system/zhijiao-relay.service
systemctl daemon-reload
systemctl enable zhijiao-relay
systemctl restart zhijiao-relay
healthy=0
for attempt in {1..10}; do
 if curl --fail --silent http://127.0.0.1:4318/healthz; then healthy=1; break; fi
 sleep 1
done
if [[ "$healthy" != 1 ]]; then
 echo '健康检查失败，请查看 systemctl status zhijiao-relay 和 journalctl -u zhijiao-relay' >&2
 exit 1
fi
printf '\n'
systemctl is-active zhijiao-relay
ss -ltnp 'sport = :4318'
echo '部署完成；服务仅监听 127.0.0.1:4318，未开放公网入口。邀请密钥保存在 /etc/zhijiao/relay.env，未输出。'
