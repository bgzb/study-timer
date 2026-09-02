/* ==================== 节假日数据自动同步 ====================
 * 内置表只是离线兜底；启动后自动从 holiday-cn（国务院公告数据，NateScarlet 维护）
 * 同步当年与明年安排：官方未发布明年时数据源返回空表，静默跳过。
 * 每天重拉一次以跟进公告修订；所有源都失败时保留现有数据不动。 */

const HOLIDAY_SOURCES = [
  (y) => 'https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master/' + y + '.json',
  (y) => 'https://fastly.jsdelivr.net/gh/NateScarlet/holiday-cn@master/' + y + '.json',
  (y) => 'https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/' + y + '.json'
];

let holidaySyncing = false;
let holidaySyncOutcome = null; // 'ok' | 'fail'：最近一次同步结果，供设置页重开时回显

async function fetchHolidayJson(url) {
  // App 内走主进程代理（无 CORS、复用系统代理）；浏览器直连（这些源都开了 CORS *）
  if (bridge && bridge.fetchJson) return bridge.fetchJson(url);
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

// 返回 { parsed, reachable }：parsed=null 且 reachable=true 表示源正常但该年份未发布
async function fetchHolidayYear(year) {
  let reachable = false;
  for (const mk of HOLIDAY_SOURCES) {
    let json;
    try { json = await fetchHolidayJson(mk(year)); }
    catch (e) { continue; } // 该源不可达（网络/被墙），换下一个
    reachable = true;
    const parsed = StudyTimerShared.parseHolidayCn(json, year);
    if (parsed) return { parsed, reachable: true };
    if (json && typeof json === 'object' && json.year === year) {
      // 源明确给出该年份且 days 为空 = 官方尚未发布，是权威结果，无需再试其它源
      return { parsed: null, reachable: true };
    }
    // 响应不属于该年份（脏数据/错误页），换下一个源
  }
  return { parsed: null, reachable };
}

// manual=true：设置页"立即更新"，跳过"今天已同步"检查，全部年份重拉
async function syncHolidays(manual) {
  if (holidaySyncing) return;
  holidaySyncing = true;
  renderHolidaySyncStatus('loading');
  const now = new Date();
  const years = StudyTimerShared.yearsToFetch(now);
  let changed = false;
  let netFailed = false;
  try {
    const targets = years.filter((y) => manual || StudyTimerShared.needsSync(state, y, now));
    const fetched = await Promise.all(targets.map((y) => fetchHolidayYear(y).then((r) => [y, r])));
    // 网络往返期间其它窗口可能改写共享状态：落盘前重读，把合并压缩到同步代码段里
    state = loadState();
    changed = StudyTimerShared.prunePastYears(state, years[0]);
    fetched.forEach(([y, r]) => {
      if (r.parsed) {
        StudyTimerShared.mergeYearIntoState(state, r.parsed, BUILTIN_HOLIDAYS, BUILTIN_MAKEUP, now);
        changed = true;
      } else if (!r.reachable) {
        netFailed = true; // 所有源都不可达才算失败；源正常但未发布（如明年安排）不算
      }
    });
    if (changed) {
      saveState();
      rebuildDay();
      tick();
    }
  } catch (e) {
    netFailed = true;
  }
  holidaySyncing = false; // 先复位再渲染：renderHolidayTab 会按此标记决定是否显示 loading
  holidaySyncOutcome = netFailed ? 'fail' : 'ok';
  renderHolidaySyncStatus(holidaySyncOutcome);
  if (changed && settingsOverlay.classList.contains('open')) renderHolidayTab();
}

function holidaySyncTime(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const p = (n) => (n < 10 ? '0' : '') + n;
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}

// 节假日 Tab 顶部的同步状态行（'loading' | 'ok' | 'fail'）
function renderHolidaySyncStatus(kind) {
  const el = $('#holSyncStatus');
  const btn = $('#holSyncBtn');
  if (!el || !btn) return;
  btn.disabled = kind === 'loading';
  const years = StudyTimerShared.yearsToFetch(new Date());
  const parts = years.map((y) => {
    const rec = ((state.holidaySync || {})[String(y)]) || null;
    return rec ? t('holSynced')(String(y), holidaySyncTime(rec.at)) : t('holPending')(String(y));
  });
  let text = parts.join('　·　');
  if (kind === 'loading') text = t('holSyncLoading');
  else if (kind === 'fail') text += ' ' + t('holSyncFail');
  el.textContent = text;
}

$('#holSyncBtn').addEventListener('click', () => { syncHolidays(true); });

// 自动同步只由"提醒职责 owner"窗口执行（菜单栏端 owner / 无菜单栏时的桌面端 / 浏览器），
// 避免同一 App 的多窗口重复抓取；设置页手动按钮不受此限
if (dutiesOwner()) {
  setTimeout(() => { syncHolidays(false); }, 2000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) syncHolidays(false); // needsSync 内部按天去重，这里只管触发
  });
}
