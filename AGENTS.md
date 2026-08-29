# study-timer 项目约束

## 功能修改后必须先询问再重新安装

用户日常运行的是 **安装版** `/Applications/study-timer.app`，它加载的是打包时封入的代码，
直接修改本目录源码（`index.html` / `main.js` / `preload.js` / `assets/`）对正在运行的应用**不生效**。

因此约定：

- 每当对功能代码做了修改（修复 bug、新增功能等），**不要自动执行** `npm run dist` 重新打包、
  也不要自动覆盖安装到 `/Applications` 或重启应用。
- 必须先**询问用户**是否需要重新打包安装，得到确认后再执行完整流程：
  1. `npm run dist`（electron-builder --mac --arm64，输出到 `dist/mac-arm64/`）
  2. 退出正在运行的 study-timer 进程
  3. `rm -rf /Applications/study-timer.app && ditto dist/mac-arm64/study-timer.app /Applications/study-timer.app`
  4. `open /Applications/study-timer.app` 并验证新功能已生效
- 仅修改文档、注释、测试用临时文件等不影响应用运行内容的改动，无需询问。

用户数据（localStorage、设置、学习统计）存放在应用 userData 目录，覆盖安装不会丢失。
