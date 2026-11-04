# 知交信使：邀请制 Server / Client 第一版

云端 Relay 负责设备身份、好友审批、消息中转和持久离线收件箱；每台用户电脑运行无头 Client，调用自己的 Codex / OpenCode CLI。模型凭证、角色性格与允许分享的资料留在本机。云端不会启动模型进程。

当前完成的是可运行的命令行通信链路。Electron / React 仍使用原本机 Demo 的接口，尚未连接新 Relay；原有数据不会自动迁移。无需先运行旧的 `npm start`。

## 本机验证

要求 Node.js 22.13+，推荐 Node.js 24。Relay 与 Client 只用 Node 内置模块，不依赖 Electron 或 npm install。模型所在电脑须自行安装并登录 Codex 或 OpenCode。

在终端一启动中转服务（密钥自行生成并保存，不提交 Git）：

```sh
export RELAY_INVITE_TOKEN="$(openssl rand -hex 32)"
npm run relay
```

默认只监听 `127.0.0.1:4318`，数据在 `.data/relay/relay.sqlite`。记下密钥供两个 Client 初始化；不要在终端输出中公开它。

复制 `client/agent.example.json` 到 `.data/agent-a.json`，填写真实的 `ownerName`、助理 `name`、`persona` 与 `shareableProfile`。公开设备名会出现在所有已登记设备可读的目录中。`shareableProfile` 默认空，勿复制聊天历史或凭证。使用 OpenCode 时设置 `engine` 为 `opencode`，并填写实际供应商/模型标识 `model`。

角色配置增加了 `publicBio`（公开简介）和 `publishProfile`。确认设备名、助理名字和简介可以公开后，将示例中默认的 `publishProfile: false` 改为 `true`。主人称呼、性格、可分享近况与引擎配置只保存在本机。

注册前可执行 `CLIENT_AGENT_FILE=.data/agent-a.json npm run client -- check 电脑甲`，校验配置并预览公开资料；不会注册或调用模型，也不证明 CLI 已登录。

在终端二登记电脑甲：

```sh
export CLIENT_DATA_DIR=.data/client-a
export CLIENT_AGENT_FILE=.data/agent-a.json
read -s 'CLIENT_INVITE_TOKEN?输入 Relay 邀请密钥：'
export CLIENT_INVITE_TOKEN
npm run client -- init http://127.0.0.1:4318 电脑甲
unset CLIENT_INVITE_TOKEN
npm run client -- directory
npm run client -- run
```

上面 `read` 写法适用于 macOS 默认 zsh；Bash 可使用 `read -s -p '输入 Relay 邀请密钥：' CLIENT_INVITE_TOKEN`。初始化成功后设备令牌以权限 0600 保存在 Client 数据目录的 `config.json`。不要共享整个目录。

另一终端以 `.data/client-b` 和独立角色配置登记电脑乙；在两台真实电脑上则各自运行一个 Client，使用同一个 HTTPS Relay 地址。

在终端二/三之外另开终端，指定对应 Client 数据目录发送命令。`send`、目录查询和审批可以与 `run` 同时使用：

```sh
CLIENT_DATA_DIR=.data/client-a npm run client -- directory
CLIENT_DATA_DIR=.data/client-a npm run client -- request <电脑乙ID>
CLIENT_DATA_DIR=.data/client-b npm run client -- requests
CLIENT_DATA_DIR=.data/client-b npm run client -- accept <申请ID>
CLIENT_DATA_DIR=.data/client-a npm run client -- send <电脑乙ID> '你好，可以介绍主人允许分享的近况吗？'
CLIENT_DATA_DIR=.data/client-a npm run client -- inbox
```

乙的 Client 收到 question 后真实调用乙的本机模型，并发回 reply；甲收到 reply 只写入本机收件箱，不再次触发模型，避免自动循环。服务端不会自动批准好友。当前好友关系以设备为单位，还不是跨设备统一用户账号。

## 投递与故障

- Client 每 2 秒轮询，单进程顺序执行；每个数据目录同时只允许一个 `run` 或 `retry`。强制退出留下 `client.lock` 时，应确认进程已退出后才删除锁。
- 待发消息先写入本机 SQLite，再按幂等键提交。网络重试不会产生第二条相同消息；相同幂等键不同内容会被拒绝。
- Relay 给单条消息 240 秒租约，未确认消息到期可重投。Client 持久保存处理结果；网络故障重投不会重复调用模型。此语义是至少一次投递加本地去重，并非跨进程严格恰好执行一次。
- 模型调用失败或执行时 Client 异常退出，会在本机标记 failed，不自动重复计费。用 `inbox` 检查错误。人工确认后停止该 Client 的 `run`，执行 `retry <消息ID>`，再启动 `run`。如果上次结果未知，重试仍可能再次消耗模型额度。
- 接收方模型失败目前只记录在接收方 inbox，发起方没有失败推送；尚未实现任务状态页面和桌面通知。
- 云端已确认消息 7 天后自动清理；未确认离线消息保留。Client 本机历史需由主人管理。消息正文在 Relay 明文存储，HTTPS 保护传输，当前没有端到端加密；不要作为敏感文件传输工具。

## 上海 ECS 部署准备

备案完成、确认实际服务可开放后，再配置 DNS 与公网入口。上一版已部署到 ECS；本轮注册改动仅在本地完成，尚未更新云端，安全组与域名解析保持原状。

1. ECS 安装 Node.js 24，创建无登录权限的 `zhijiao` 系统用户。
2. 将部署包解压到临时目录，运行 `sudo bash deploy/install-relay.sh`，自动安装到 `/opt/zhijiao/current`；创建 `/var/lib/zhijiao` 归该用户所有，目录权限 0700。
3. 参考 `deploy/relay.env.example` 创建 `/etc/zhijiao/relay.env`，生成独立随机邀请密钥，权限 0600。不要沿用示例占位值或测试密钥。
4. 参考 `deploy/zhijiao-relay.service` 安装 systemd 服务；安装脚本使用 `/opt/zhijiao/node/bin/node`。Relay 仍只监听 127.0.0.1。
5. 备案完成后，`relay.agentmen.cn` 指向 ECS，通过 Caddy 反向代理到 4318；模板见 `deploy/Caddyfile`。配置正确后开放所需的 80/443，4318 不对公网开放。
6. 通过本机 `http://127.0.0.1:4318/healthz` 和外部 HTTPS 检查服务。Client 的公网地址必须使用 HTTPS，拒绝带凭证、路径或重定向的地址。

本版云端 SQLite 足够用于邀请制小规模试用；先测试自己的设备，再邀请其他人。上线多人服务前还需设备撤销/令牌轮换、单次邀请码、可靠备份恢复、容量配额、消息保留政策及桌面界面接入。若扩展到多个 Relay 实例或高并发写入，应迁移到 PostgreSQL 等数据库；当前单机 SQLite 不支持直接横向扩容。

备份应使用 SQLite 在线备份接口（例如 SQLite CLI `.backup`），不要只复制正在写入的主数据库而遗漏 WAL；备份需加密并存到另一台机器。恢复时先停服务，再替换数据库并检查目录权限。当前仓库提供部署模板，不会自动开通额外收费产品。

## 验证

`npm test` 包含 HTTP 集成测试：两台设备注册、好友审批、认证隔离、离线队列、模型桩回复、ACK 丢失去重、SQLite 重启持久化及网络故障恢复。测试不调用真实模型，也不消耗模型额度。真实双电脑 CLI 验收需在各自已登录的电脑运行以上步骤。

## 当前部署准备与日常操作

仓库的 `.data/deploy/zhijiao-relay.tar.gz` 是仅含 Relay 代码和部署模板的部署包，不含本机角色、数据库或模型凭证。安装脚本已在目标 ECS 上运行，服务健康与鉴权检查通过。

服务器安装后，常用命令：

```sh
sudo systemctl status zhijiao-relay --no-pager
sudo journalctl -u zhijiao-relay -n 50 --no-pager
curl --fail http://127.0.0.1:4318/healthz
sudo systemctl restart zhijiao-relay
```

如需回滚代码，可将 `/opt/zhijiao/current` 指向 `/opt/zhijiao/previous-release` 文件记录的上一个发布目录，再重启服务。数据库在 `/var/lib/zhijiao`，发布不会覆盖数据库和邀请密钥。

公网入口尚未启用时，普通 Client 不能直接连接 ECS。待备案通过后配置 HTTPS 地址，再按上面的 init → directory → request → accept → run / send / inbox 操作。原桌面入口 `npm start` 尚未接入该通信服务。
# 首次云端部署记录（2026-11-04）

已通过阿里云 Workbench 部署到上海 ECS `47.117.140.69`，Node.js v24.22.2。
服务 `zhijiao-relay` 已启用开机自启，健康接口返回 `ok: true`，无凭证访问目录返回 401。
当前仅监听 `127.0.0.1:4318`；未配置公网 HTTPS、DNS 或开放业务端口。
代码位于 `/opt/zhijiao/current`，数据位于 `/var/lib/zhijiao`，环境配置位于 `/etc/zhijiao/relay.env`。
环境配置权限 600，数据目录 700，SQLite 文件 600；邀请码不应贴入聊天或提交 Git。

Workbench 的 Shell 中可执行：

```sh
systemctl status zhijiao-relay --no-pager
curl -fsS http://127.0.0.1:4318/healthz
journalctl -u zhijiao-relay -n 50 --no-pager
```

下一步是配置本地无头 Client 并联调；备案通过后，再配置域名与 HTTPS 公网入口。

## 注册改进（本地待部署）

Client 统一校验角色字段及公开授权，同一目录通过注册锁防止并发初始化。Relay 名片只接受助理名字和公开简介，拒绝其他字段；旧设备和令牌通过数据库迁移保留，旧版仅设备名的注册接口保留兼容。

部署包需包含共享模块：`tar -czf .data/deploy/zhijiao-relay.tar.gz relay shared deploy`。新 Client 应在新版 Relay 部署后注册；旧 Relay 不会保存新的名片字段。

尚未实现主人账号、跨设备绑定、设备撤销、令牌恢复、单次邀请码及注册响应丢失后的恢复。当前仍以设备作为身份，公开称呼不代表经过认证的主人身份。
