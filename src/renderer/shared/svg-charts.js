(function (root, factory) {
  const api = factory(root.StudyTimerShared || {});
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.StudyTimerShared = Object.assign(root.StudyTimerShared || {}, api);
})(typeof window !== 'undefined' ? window : globalThis, function () {
  /* 统计页的微型 SVG 图表库：只产出 SVG 字符串，颜色交给 CSS 变量（stats.css），
     动画钩子全部用 class（stc-*），进出场由 CSS keyframes 驱动 */
  const nf = (v) => (Number.isFinite(v) ? v : 0);
  const fix = (v) => (Math.round(v * 10) / 10);

  /* 折线（可带面积填充）：values 已按比例归一前调用方给真实值，这里取 max 归一 */
  function sparkline(values, opts) {
    const o = opts || {};
    const w = o.w || 300, h = o.h || 64, pad = 3;
    const vals = (values || []).map(nf);
    const n = vals.length;
    if (n < 2) return '';
    const max = o.max != null ? Math.max(1, nf(o.max)) : Math.max(1, ...vals);
    const dx = (w - pad * 2) / (n - 1);
    const pts = vals.map((v, i) => [pad + i * dx, h - pad - (v / max) * (h - pad * 2)]);
    const d = 'M' + pts.map((p) => fix(p[0]) + ' ' + fix(p[1])).join(' L');
    const area = d + ' L' + fix(w - pad) + ' ' + h + ' L' + pad + ' ' + h + ' Z';
    return '<svg class="stc-line' + (o.className ? ' ' + o.className : '') + '" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" fill="none" aria-hidden="true">'
      + '<path class="stc-area" d="' + area + '"/>'
      + '<path class="stc-stroke" d="' + d + '" pathLength="1"/></svg>';
  }

  /* 环形进度：pct ∈ [0,1]；描边动画用内联 --p 变量（pathLength=1） */
  function ring(pct, opts) {
    const o = opts || {};
    const size = o.size || 62, sw = o.sw || 6;
    const r = (size - sw) / 2, c = size / 2;
    const p = Math.max(0, Math.min(1, nf(pct)));
    return '<svg class="stc-ring" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" fill="none" aria-hidden="true" style="--p:' + fix(p) + '">'
      + '<circle class="stc-ring-track" cx="' + c + '" cy="' + c + '" r="' + r + '" stroke-width="' + sw + '"/>'
      + '<circle class="stc-ring-val" cx="' + c + '" cy="' + c + '" r="' + r + '" stroke-width="' + sw + '" pathLength="1" stroke-linecap="round" transform="rotate(-90 ' + c + ' ' + c + ')"/></svg>';
  }

  /* 24 小时径向时钟：values（分钟）为主系列（工作日），values2 可选叠加（周末·节假日） */
  function radialClock(values, opts) {
    const o = opts || {};
    const size = o.size || 220, cx = size / 2, cy = size / 2;
    const inner = Math.round(size * 0.3), outer = Math.round(size * 0.46);
    const vals = (values || []).map(nf);
    const max = Math.max(1, ...vals);
    let out = '<circle class="stc-rc-grid" cx="' + cx + '" cy="' + cy + '" r="' + inner + '"/>'
      + '<circle class="stc-rc-grid" cx="' + cx + '" cy="' + cy + '" r="' + Math.round((inner + outer) / 2) + '"/>';
    for (let h = 0; h < 24; h++) {
      const a = (h / 24) * Math.PI * 2 - Math.PI / 2; // 0 点朝正上，顺时针
      const dx = Math.cos(a), dy = Math.sin(a);
      const segs = [{ list: vals, max, cls: '', inner }];
      if (o.values2) segs.push({ list: (o.values2 || []).map(nf), max: Math.max(1, ...(o.values2 || []).map(nf)), cls: ' alt', inner: inner + 4 });
      for (const s of segs) {
        const v = s.list[h];
        if (!(v > 0)) continue;
        const len = (v / s.max) * outer;
        out += '<line class="stc-rc-bar' + s.cls + '" x1="' + fix(cx + dx * s.inner) + '" y1="' + fix(cy + dy * s.inner) + '"'
          + ' x2="' + fix(cx + dx * (s.inner + len)) + '" y2="' + fix(cy + dy * (s.inner + len)) + '"'
          + ' data-h="' + h + '" style="animation-delay:' + (h * 14) + 'ms"/>';
      }
    }
    for (const hr of [0, 3, 6, 9, 12, 15, 18, 21]) {
      const a = (hr / 24) * Math.PI * 2 - Math.PI / 2;
      const lx = cx + Math.cos(a) * (inner - 11), ly = cy + Math.sin(a) * (inner - 11);
      out += '<text class="stc-rc-lab" x="' + fix(lx) + '" y="' + fix(ly + 3.5) + '" text-anchor="middle">' + hr + '</text>';
    }
    return '<svg class="stc-clock" viewBox="0 0 ' + size + ' ' + size + '" fill="none" aria-hidden="true">' + out + '</svg>';
  }

  /* 散点：points [{x, y, key?}]，xDomain/yDomain = [min,max]；用于评分×专注时长 */
  function scatter(points, opts) {
    const o = opts || {};
    const w = o.w || 280, h = o.h || 130;
    const padL = 24, padR = 8, padT = 8, padB = 18;
    const xd = o.xDomain || [0, 1], yd = o.yDomain || [0, 1];
    const px = (x) => padL + ((nf(x) - xd[0]) / (xd[1] - xd[0] || 1)) * (w - padL - padR);
    const py = (y) => h - padB - ((nf(y) - yd[0]) / (yd[1] - yd[0] || 1)) * (h - padB - padT);
    let out = '';
    for (let i = 0; i <= 2; i++) {
      const gy = padT + ((h - padT - padB) / 2) * i;
      out += '<line class="stc-sc-grid" x1="' + padL + '" y1="' + fix(gy) + '" x2="' + (w - padR) + '" y2="' + fix(gy) + '"/>';
    }
    let dots = '';
    (points || []).forEach((p, i) => {
      dots += '<circle class="stc-sc-dot" cx="' + fix(px(p.x)) + '" cy="' + fix(py(p.y)) + '" r="4"'
        + ' data-key="' + (p.key || '') + '" data-x="' + fix(p.x) + '" data-y="' + fix(p.y) + '"'
        + ' style="animation-delay:' + (i * 24) + 'ms"/>';
    });
    for (let x = Math.ceil(xd[0]); x <= xd[1]; x++) {
      out += '<text class="stc-sc-lab" x="' + fix(px(x)) + '" y="' + (h - 5) + '" text-anchor="middle">' + x + '</text>';
    }
    out += dots;
    return '<svg class="stc-scatter" viewBox="0 0 ' + w + ' ' + h + '" fill="none" aria-hidden="true">' + out + '</svg>';
  }

  return { sparkline, ring, radialClock, scatter };
});
