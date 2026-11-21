# 独立客户端与服务端

- `MathewWang/zhijiao-client`：MIT 开源客户端，含桌面、可定制 UI、本机 runtime、无头 Client、共享协议和角色素材。
- `MathewWang/zhijiao-server`：独立云端 Relay，单独部署，不需要 Electron、React 或模型 CLI。
- 原 `qiju-companion` 保留作为迁移和集成参考。独立客户端是后续对外安装与 UI 定制入口；现有公网 Relay 版本兼容，不因拆仓更换设备身份或数据库。

原本地 `server/` 已更名为 `runtime/`，默认 `.data` 目录保持不变。它只监听 127.0.0.1，不是阿里云服务端。

## 可复现导出

```sh
node scripts/export-projects.mjs --client /absolute/empty/client --server /absolute/empty/server
```

导出使用白名单，拒绝覆盖非空目录，不复制 .git 历史、.data、.env、SQLite、node_modules 或生产凭据。客户端包只包含客户端运行所需目录，服务端包不包含 UI、模型适配器和用户角色。独立包分别有 package.json、锁文件、README 与边界测试。完成迁移后在相应独立仓库维护代码，不要在两个目录重复修改。

客户端 UI 开发：`npm run dev`，通过 Vite 热更新修改 React 和 CSS；桌面正式入口仍是 `npm run desktop`。旧安装迁移步骤在新客户端的 `docs/migration.md`。
