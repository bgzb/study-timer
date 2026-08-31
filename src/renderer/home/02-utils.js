/* ==================== 工具 ==================== */

const $ = (sel) => document.querySelector(sel);
const pad2 = (n) => String(n).padStart(2, '0');

function fmtClock(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return pad2(h) + ':' + pad2(m);
}
function fmtCountdown(sec) {
  sec = Math.max(0, Math.floor(sec));
  const m = Math.floor(sec / 60), s = sec % 60;
  return pad2(m) + ':' + pad2(s);
}
function getToday() {
  const d = new Date();
  return {
    y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate(), dow: d.getDay(),
    str: d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate())
  };
}
const WEEK_NAMES = ['日', '一', '二', '三', '四', '五', '六'];

/* 演示模式：URL 带 ?t=09:00 可把时钟拨到指定时刻（自测用） */
const demoParam = new URLSearchParams(location.search).get('t');
let demoOffset = null;
if (demoParam && /^\d{1,2}:\d{2}(:\d{2})?$/.test(demoParam)) {
  const parts = demoParam.split(':').map(Number);
  const target = (parts[0] % 24) * 3600 + parts[1] * 60 + (parts[2] || 0);
  const d = new Date();
  const real = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
  demoOffset = ((target - real) % 86400 + 86400) % 86400;
}
function nowSeconds() {
  const d = new Date();
  let s = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
  if (demoOffset !== null) s = (s + demoOffset) % 86400;
  return s;
}
