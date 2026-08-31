/* ==================== 每日总结弹出 ==================== */

let summaryAutoOpenedFor = null; // 本次运行内已自动弹过的日期，防止重复弹

// 全天结束（最后一块正常走完 / 跳过提前结束 / 打开应用时当天已结束）时自动弹出总结窗口。
// 柔和策略：showInactive 不抢焦点；已保存或点过"稍后再说"的日期不再弹；重启后当天未填会再次提醒。
function maybeAutoOpenSummary(st) {
  if (!dutiesOwner() || !bridge || !bridge.openSummary) return; // 面板纯展示；浏览器模式无桥
  if (!st || st.phase !== 'done') return;
  const key = today.str;
  if ((state.journal && state.journal[key]) || (state.summaryDismissed && state.summaryDismissed[key])) return;
  if (summaryAutoOpenedFor === key) return;
  summaryAutoOpenedFor = key;
  bridge.openSummary(key, false);
}
