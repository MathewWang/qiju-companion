#!/bin/zsh
cd -- "${0:A:h}" || exit 1
# Finder 启动的终端也能找到常见的 Homebrew / Node 安装位置。
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null 2>&1; then
  print '未找到 Node.js。请先让 Codex 按 INSTALL.md 完成安装。'
  read -r '?按回车关闭…'
  exit 1
fi
node scripts/desktop.mjs launch
result=$?
if (( result != 0 )); then
  read -r '?启动失败，按回车关闭…'
fi
exit $result
