/* ==================== 提示音与通知 ==================== */

let audioCtx = null;
function initAudio() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}

function playSound() {
  const preset = SOUND_PRESETS[state.sound] || SOUND_PRESETS.chime;
  // App 内：走系统级 afplay 播放 macOS 自带音效，响亮且不依赖页面音频
  if (bridge && bridge.playSound && preset.sys) {
    bridge.playSound(preset.sys, 0.1 + state.volume * 1.9);
    return;
  }
  try {
    initAudio();
    if (!audioCtx) return;
    const vol = state.volume;
    const t0 = audioCtx.currentTime + 0.01;
    for (const n of preset.notes) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = n.type || 'sine';
      osc.frequency.value = n.f;
      const start = t0 + n.t;
      const end = start + n.d;
      const peak = (n.g || 0.85) * Math.min(1, vol * 1.2);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.001, peak), start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(start);
      osc.stop(end + 0.05);
    }
  } catch (e) { /* 音频失败不影响主流程 */ }
}

function currentSysSound() {
  const preset = SOUND_PRESETS[state.sound] || SOUND_PRESETS.chime;
  return preset.sys || 'Glass';
}

function notify(title, body, sound) {
  if (!state.notifications) return;
  // App 内：主进程原生通知，提示音随横幅由系统播放（最可靠）
  if (bridge && bridge.notify) {
    bridge.notify(title, body, sound || currentSysSound());
    return;
  }
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, { body });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch (e) { /* 忽略通知异常 */ }
}

function blockRangeText(b) {
  return fmtClock(b.start) + ' – ' + fmtClock(b.effEnd) + ' · ' + b.minutes + t('min');
}

// 进入跳过间隙时取最近一次跳过的原因（skips 按发生顺序追加，末条即最新）
function latestSkipReason() {
  const list = (state.skips && state.skips[today.str]) || [];
  const last = list[list.length - 1];
  return (last && last.reason) || t('skipNoReason');
}

function fireTransition(st) {
  if (!dutiesOwner()) return; // 铃声/通知只由职责窗口发（菜单栏端优先，桌面端兜底），面板是纯展示
  if (gateActiveToday()) return; // 未打卡：相位照常展示，但不发通知不响铃
  // 提示音随横幅由系统播放；无横幅场景（通知关闭/浏览器模式）才本地播放
  const bannerWillSound = !!(bridge && state.notifications);
  if (!bannerWillSound) playSound();
  const snd = currentSysSound();
  if (st.phase === 'study') {
    const q = pickQuote(StudyTimerShared.anchorPoolFor(st.session, st.block));
    notify(t('studyStart')(st.session.name), blockRangeText(st.block) + '\n' + q, snd);
  } else if (st.phase === 'break') {
    notify(t('breakNotify'), blockRangeText(st.block) + '\n' + pickQuote('break'), snd);
  } else if (st.phase === 'gap') {
    // 进入跳过间隙：带上原因，下一块从原定时刻开始
    notify(t('gapNotifyTitle'), latestSkipReason() + '\n' + t('nextBlock')(
      st.next.type === 'study' ? t('studyWord') : t('breakWord'), fmtClock(st.next.start)), snd);
  } else if (st.phase === 'wait' && st.prev) {
    const extra = completedExtraSessionOf(st);
    let q = pickQuote(extra ? 'extraEnd' : 'sessionEnd');
    if (!extra) q = q.replace('{session}', st.prev.name);
    const body = st.next ? q + '\n' + t('nextSession')(st.next.name, fmtClock(st.next.start)) : q;
    notify(t('sessionDone')(st.prev.name), body, snd);
  } else if (st.phase === 'done') {
    notify(t('dayDoneNotify'), pickQuote(completedExtraSessionOf(st) ? 'extraEnd' : 'dayDone'), snd);
  }
}

/* 未打卡提醒：门禁中的职责窗口在当天首次出现"学习中"相位时提醒一次
   （每次运行每天最多一条；时段开始前/全天结束时安静） */
let nudgedCheckinFor = null;
function maybeNudgeCheckin(st) {
  if (!st || st.phase !== 'study') return;
  if (nudgedCheckinFor === today.str) return;
  if (StudyTimerShared.checkedIn(state, today.str)) return;
  nudgedCheckinFor = today.str;
  notify(t('nudgeCheckinTitle'), t('nudgeCheckinBody'), currentSysSound());
}
