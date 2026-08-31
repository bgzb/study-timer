/* ==================== 首次启用 ==================== */

function showEnableOverlayIfNeeded() {
  if (BAR_MODE) return; // 首启授权向导只在主窗口出现
  if (!state.enableAck) $('#enableOverlay').classList.remove('hidden');
}

$('#enableBtn').addEventListener('click', async () => {
  initAudio();
  playSound();
  if ('Notification' in window && Notification.permission === 'default') {
    try { await Notification.requestPermission(); } catch (e) {}
  }
  state.enableAck = true;
  saveState();
  $('#enableOverlay').classList.add('hidden');
});

$('#skipEnable').addEventListener('click', () => {
  state.enableAck = true;
  saveState();
  $('#enableOverlay').classList.add('hidden');
});
