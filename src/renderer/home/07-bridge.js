/* ==================== Electron 桥 ==================== */

const bridge = window.studyTimer || null;
let lastTrayTitle = null;

// 提醒职责：菜单栏端 owner 窗口恒 true；桌面端窗口平时 false，
// 主进程探测到菜单栏端未运行时置 true（临时接管，提醒不断档）；浏览器模式恒 true
let duties = bridge ? !!bridge.getDutiesSync() : true;
if (bridge && bridge.onDutiesChange) bridge.onDutiesChange((v) => { duties = v; tick(); });
function dutiesOwner() { return !BAR_MODE && duties; }

function updateTray(st) {
  if (!bridge || !dutiesOwner()) return;
  let title = '--:--', tip = t('appName');
  if (gateActiveToday()) {
    // 未打卡：托盘明示今天还没开始，点开面板即可打卡
    title = t('trayGated');
    tip = t('trayGatedTip');
  } else if (st.phase === 'study' || st.phase === 'break') {
    title = fmtCountdown(st.block.effEnd - nowSeconds());
    tip = (st.phase === 'study' ? t('studying') + ' · ' : t('breakTime') + ' · ') + blockRangeText(st.block);
  } else if (st.phase === 'gap') {
    title = fmtCountdown(st.next.start - nowSeconds());
    tip = t('gapTip')(
      st.next.type === 'study' ? t('studyWord') : t('breakWord'), fmtClock(st.next.start));
  } else if (st.phase === 'wait') {
    title = '▸' + fmtClock(st.next.start);
    tip = t('waitTip')(st.next.name, fmtClock(st.next.start));
  } else {
    // 收工生效中：托盘明示提前收工（收工后仍可加钟，加钟时段会回到倒计时显示）
    if (windDownActiveOf(today.str)) {
      title = t('windDownDone');
      tip = t('windDownDone') + ' · ' + t('windDownHint');
    } else {
      title = t('doneWord');
      tip = t('doneToday');
    }
  }
  // 倒数日托盘后缀（cdTray 开关开启时）：追加最近未到期项，如 ' ⏳87'
  const cdSuffix = StudyTimerShared.trayCountdownSuffix(state.countdowns, today.str, state.cdTray);
  if (cdSuffix) {
    title += cdSuffix;
    const near = StudyTimerShared.sortedCountdowns(state.countdowns, today.str).find((c) => c.days >= 0);
    if (near) tip += ' · ⏳' + near.name;
  }
  if (title !== lastTrayTitle) {
    lastTrayTitle = title;
    bridge.updateTray(title, tip);
  }
}
