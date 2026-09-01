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
  if (st.phase === 'study' || st.phase === 'break') {
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
    title = t('doneWord');
    tip = t('doneToday');
  }
  if (title !== lastTrayTitle) {
    lastTrayTitle = title;
    bridge.updateTray(title, tip);
  }
}
