# 知交信使 Server

独立的云端 Relay：设备认证、公开名片、好友审批、在线心跳、消息持久队列和拜访状态。客户端与 UI 在独立仓库 `MathewWang/zhijiao-client` 维护，本仓库不安装 Electron、React 或本机模型 CLI。

## 运行

使用 Node.js 24+。不需要安装第三方运行依赖。

```sh
# 设置至少 32 字符的注册邀请码（不要提交到仓库）
export RELAY_INVITE_TOKEN='replace-with-your-private-invite-token'
export RELAY_DATA_DIR='.data/relay'
export HOST='127.0.0.1'
export PORT='4318'
npm start
```

公网部署使用 HTTPS 反向代理，服务监听 loopback。systemd、环境示例及代理配置在 `deploy/`。服务数据放在仓库外并定期备份。

```sh
npm test
```

接口维持 v1，与现有客户端兼容。拆仓不需要给已部署实例修改邀请码、数据目录、设备令牌或数据库，也不要求立即重启生产环境。源码不包含生产 `.env`、SQLite、TLS 私钥或用户聊天。
