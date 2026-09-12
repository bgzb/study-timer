(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.StudyTimerShared = Object.assign(root.StudyTimerShared || {}, api);
})(typeof window !== 'undefined' ? window : globalThis, function () {
  /* 今日待办领域模型。todos: { 'YYYY-MM-DD': [{ id, text, done, blockKey?, createdAt }] }
   * 待办可挂到当日时间块（blockKey = '<会话i>-<块j>'），晚间总结可一键带入 plan 字段。 */

  function todosOf(todos, dateStr) {
    const list = todos && typeof todos === 'object' ? todos[dateStr] : null;
    return Array.isArray(list) ? list.filter((x) => x && typeof x.text === 'string') : [];
  }

  function unfinishedTodosOf(todos, dateStr) {
    return todosOf(todos, dateStr).filter((x) => !x.done);
  }

  /* 抽屉徽标与面板头部用的完成计数 */
  function todoStatsOf(todos, dateStr) {
    const list = todosOf(todos, dateStr);
    return { total: list.length, done: list.filter((x) => x.done).length };
  }

  /* 未完成待办 → 手记 plan 预填文本。挂块的按块标签分组一行（[标签] 任务1；任务2），
   * 未挂块的归 otherLabel；空列表返回空串。blockLabel(blockKey) 由渲染层传入（含 i18n）。 */
  function todosToPlanText(items, blockLabel, otherLabel) {
    const list = (Array.isArray(items) ? items : []).filter((x) => x && x.text);
    if (!list.length) return '';
    const groups = [];   // [{ label, texts[] }]
    const other = [];
    for (const it of list) {
      const label = it.blockKey && typeof blockLabel === 'function' ? blockLabel(it.blockKey) : null;
      if (label) {
        const g = groups.find((x) => x.label === label);
        if (g) g.texts.push(it.text);
        else groups.push({ label, texts: [it.text] });
      } else {
        other.push(it.text);
      }
    }
    const lines = groups.map((g) => '[' + g.label + '] ' + g.texts.join('；'));
    if (other.length) lines.push('[' + (otherLabel || '') + '] ' + other.join('；'));
    return lines.join('\n');
  }

  return { todosOf, unfinishedTodosOf, todoStatsOf, todosToPlanText };
});
