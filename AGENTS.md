# study-timer 项目约束

## 功能修改后自动重新打包安装并验证菜单栏端

用户日常运行的是 **安装版** `/Applications/study-timer.app`，它加载的是打包时封入的代码，
直接修改本目录源码（`index.html` / `main.js` / `preload.js` / `assets/`）对正在运行的应用**不生效**。

因此约定：

- 每当对功能代码做了修改（修复 bug、新增功能等），都要**自动执行**完整的重新打包、覆盖安装和启动验证流程，
  不需要先询问用户确认。
- 日常修改只重新打包、覆盖安装和验证**菜单栏端**，使用以下流程：
  1. 退出正在运行的 `study-timer-menu` 进程（不要求退出或更新桌面端）。
  2. `npm run dist:menu`（产出 `dist/menu/mac-arm64/study-timer-menu.app`）。
  3. `rm -rf /Applications/study-timer-menu.app && ditto dist/menu/mac-arm64/study-timer-menu.app /Applications/study-timer-menu.app`
  4. `open /Applications/study-timer-menu.app`，等待菜单栏端启动，并确认 `study-timer-menu` 进程正常运行。
     菜单栏端启动检查到进程正常运行即可，不需要检查或处理 Ice 的 Visible、Hidden、Always Hidden 分区，
     也不需要确认图标是否实际可见。
- 桌面端 `/Applications/study-timer.app` 在上述日常流程中**不重新打包、不覆盖安装、不启动**，继续保留当前已安装版本；平时即使菜单栏端已完成多次功能修改，也不要因此同步更新桌面端。只有在积累了较多功能、准备进行一次版本迭代/统一发布时，才执行一次桌面端同步更新：退出桌面端进程，运行 `npm run dist`，再将 `dist/mac-arm64/study-timer.app` 覆盖安装到 `/Applications/study-timer.app`。如确需执行数据迁移或桌面端专项验证，也可提前启动它。
- 仅修改文档、注释、测试用临时文件等不影响应用运行内容的改动，无需询问。

## 打包签名与通知授权（勿破坏）

- macOS 的通知授权跟随应用的**代码签名身份**。本项目的两份打包配置（`package.json` 与 `builder-menu.json`）
  均配置了 `"identity": "Study Timer Local Dev"`（本机登录钥匙串里的自签名证书，由 `scripts/make-signing-cert.sh`
  幂等创建，`predist` / `predist:menu` 会在构建前自动确认存在）。
- **不要删除或更换该证书，也不要从打包配置里移除 identity**：一旦签名身份变化或回到未签名状态，
  每次覆盖安装后 macOS 会把 App 当成"变了的应用"，系统会静默丢弃其通知（症状：通知和测试通知按钮都无反应）。
- 通知投递结果记录在各 App userData 的 `notif-debug.log`（封顶 200 行）；排查通知问题先看这个文件
  （`native shown` = 原生横幅已弹出；`falling back to osascript` = 被系统拦截后走了脚本兜底）。
- 打包需 Node ≥ 20.19（`require(esm)` 支持非 CJS 的 `@noble/hashes` v2）；若 shell 里是旧版 Node
  （如 `/usr/local/bin/node` 16），用 nvm 的新版本（如 `~/.nvm/versions/node/v22.22.2/bin`）再跑 `npm run dist:menu`。

用户数据存放在两处：共享状态文件 `~/Library/Application Support/study-timer-shared/state.json`（作息/统计/手记，两个 App 共用并实时同步），以及各 App 自己 userData 目录（通知注册标记等，覆盖安装不会丢失）。
