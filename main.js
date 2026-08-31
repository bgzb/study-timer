'use strict';

// 稳定的 Electron 入口；具体职责由 src/main/bootstrap 组装。
require('./src/main/bootstrap').start(__dirname);
