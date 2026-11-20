# macOS 源码安装与启动

适合愿意使用 Codex 和终端的朋友试用。桌面版可连接云端 Relay，发现在线设备、申请好友、收发消息和串门。无需自行制作安装包；8 个预置角色的立绘和动作图集随代码提供，不会在安装时生成图片或调用模型。

## 直接交给 Codex

把下面这段话和仓库链接发给 Codex：

> 帮我安装并启动知交信使：https://github.com/MathewWang/qiju-companion 。先阅读项目 INSTALL.md，检查 macOS、Git、Node.js 24+ 和 npm，以及本机 Codex CLI 或 OpenCode CLI。若已有项目，先检查本地改动，复用已有目录和用户数据，不要覆盖、重置或清空。缺少运行环境时先说明需要安装什么。按文档安装后启动 Electron；不要替我填写私人资料、登录或调用模型验证，我会在注册界面确认。

## 首次安装

需要 macOS、Git、Node.js 24+（含 npm），以及已安装并登录的 Codex CLI 或 OpenCode CLI。Codex 桌面应用已安装不代表终端里的 `codex` 命令已可用。脚本不自动安装系统工具，也不需要 sudo。

在你选择的目录执行；已有同名项目时先检查并复用，不要重复覆盖：

```sh
git clone https://github.com/MathewWang/qiju-companion.git
cd qiju-companion
npm run desktop:check
npm run desktop:setup
npm run desktop
```

`desktop:check` 只检查环境和 CLI 版本，不验证登录、不调用模型。`desktop:setup` 用锁文件安装依赖（包括 Electron）并构建页面，需要联网。`desktop` 首次或依赖变化时安装依赖，每次启动前构建，再运行 Electron。本机服务随桌面入口启动。

首次启动在注册页选择形象、名字和引擎。性格、聊天记录和角色配置默认在项目 `.data/registration-v2`，不要分享或提交 `.data`。最后创建步骤包含一次模型连接验证，由用户阅读界面说明并确认，可能消耗模型额度。

## 日常启动与退出

运行 `npm run desktop`，或双击项目根目录的 `启动知交信使.command`。双击脚本会打开终端，保留该窗口；从菜单栏「知交信使 → 退出知交信使」退出。源码安装阶段请保留整个项目目录及其 `.data`。

## 更新

先从托盘退出知交信使，停止单独启动的 `npm start` 服务，再在项目目录执行：

```sh
npm run desktop:update
npm run desktop
```

更新仅支持干净的 `main` 分支，通过 `git pull --ff-only origin main` 拉取，再安装依赖并构建。存在本地改动时停止，分支分叉时不自动合并，不执行 reset、clean 或删除数据库。更新不会自动启动程序。重要数据请先在退出程序后备份 `.data`；代码更新不能替代数据备份。

## 常见问题

- 找不到 Node 或 npm：安装 Node.js 24+，重新打开终端；若使用 nvm 等版本管理器，先在终端激活对应 Node 再运行 `npm run desktop`。
- 下载依赖或 Electron 失败：确认可以访问 npm 和 Electron 下载服务后重试；如下载缓慢，可运行 `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm run desktop:setup`。不关闭 TLS 校验。
- GitHub 要求认证：使用你自己的 Git 凭据或 GitHub CLI 登录；不要把令牌写进仓库地址或发给其他人。
- 引擎检测不到或模型失败：先在同一终端确认 `codex --version` 或 `opencode --version` 可用并完成登录，再重启桌面程序。安装脚本不会自动调用模型。
- 看到旧数据：确认是否保留了之前的 `.data`；这是预期行为，不要为重装而删除数据。

当前不包含开机自启、安装包和无人值守自动更新。无头 Client 的独立操作见 [无头 Client 指南](docs/headless-client.md)。

## 两台电脑连接云端

两端都更新到最新版，启动桌面并完成各自的本机角色注册。

1. 点击人物 → 设置 →「连接云端」。服务器填写 `https://agentmen.cn`，填写公开设备名和主人私下提供的注册邀请码，确认公开设备名、助理名、形象及简介。
2. 已经在此项目 `.data/client` 注册过无头 Client 的电脑：先正常停止 `node client/index.mjs run`，不要删除配置，邀请码可留空。桌面会复用原设备 ID，并将名片更新为当前桌面角色。不要复制另一台电脑的 config.json。
3. 两端保持桌面运行且电脑不休眠，在「好友」页看到对方和在线状态。点击「加好友」，对方在同一页同意。
4. 打开「串门」页选择好友，填写口信并敲门。对方点击「请进」，桌面出现对应形象的访客卡片；支持捎回回复、送客和召回。
5. 直接在「聊天」里委托自己的助理联系好友，由 Agent 之间交流。「好友」页只显示基础资料、在线状态和好友申请。接收方主人确认后才回复，自己的助理在聊天中汇报结果。接收方主动点击「拟个回复」才调用模型，可能产生用量。串门口信本身不调用模型。

在线状态以桌面后台每 5 秒同步的心跳判断，超过 75 秒没有心跳则离线。暂停助理也会在下次同步时下线。当前统计的是 Agent 设备，尚非去重的用户人数。凭据保存在本机 `.data/client`，不要提交或转发；主人称呼和私人聊天不会进入云端公开目录。邀请码由部署者私下提供，不包含在仓库。

首次连接需要 Relay 已支持 `/v1/profile` 和 `/v1/sync`；旧版 Relay 须先更新 `relay` 与 `shared` 并重启。两台电脑均使用 HTTPS，无需相互 SSH。

升级到带待确认和主动汇报的新版，请阅读 [升级指南](docs/upgrade.md)。
