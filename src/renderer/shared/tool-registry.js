(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.StudyTimerShared = Object.assign(root.StudyTimerShared || {}, api);
})(typeof window !== 'undefined' ? window : globalThis, function () {
  /* 侧边工具抽屉的分组与条目注册表。新增功能在此追加一行即可，
   * 渲染与交互由 home/17-tool-drawer.js 统一完成。
   * - kind 'action'：点击直接执行；'toggle'：用 aria-pressed 表达开/关态（如面板主题）
   * - 'system' 组渲染时沉底；条目多于视口高度时抽屉内部滚动
   * - labelKey/titleKey 为 i18n 键（titleKey 缺省复用 labelKey） */
  const TOOL_GROUPS = [
    {
      id: 'tools',
      titleKey: 'drawerGroupTools',
      tools: [
        { id: 'journal', icon: 'journal', labelKey: 'journalTitle', kind: 'action' },
        { id: 'stats', icon: 'stats', labelKey: 'statsBtn', kind: 'action' },
        { id: 'todo', icon: 'todo', labelKey: 'todoTitle', kind: 'action' },
        { id: 'countdown', icon: 'countdown', labelKey: 'cdTitle', kind: 'action' }
      ]
    },
    {
      id: 'system',
      titleKey: 'drawerGroupSystem',
      tools: [
        { id: 'settings', icon: 'settings', labelKey: 'settings', kind: 'action' }
      ]
    }
  ];

  /* 注册表合法性校验（tests/tool-registry.test.js）：返回错误信息数组，空数组即合法 */
  function validateToolRegistry(groups, iconPaths) {
    const errors = [];
    const seen = new Set();
    const icons = iconPaths || {};
    (groups || []).forEach((group, gi) => {
      if (!group || typeof group.id !== 'string' || !group.id) {
        errors.push('group[' + gi + ']: missing id');
        return;
      }
      if (typeof group.titleKey !== 'string' || !group.titleKey) {
        errors.push('group ' + group.id + ': missing titleKey');
      }
      if (!Array.isArray(group.tools)) {
        errors.push('group ' + group.id + ': tools must be an array');
        return;
      }
      group.tools.forEach((tool, ti) => {
        const at = 'group ' + group.id + ' tool[' + ti + ']';
        if (!tool || typeof tool.id !== 'string' || !tool.id) {
          errors.push(at + ': missing id');
          return;
        }
        if (seen.has(tool.id)) errors.push(at + ': duplicate id ' + tool.id);
        seen.add(tool.id);
        if (!Object.prototype.hasOwnProperty.call(icons, tool.icon)) {
          errors.push(at + ': unknown icon "' + tool.icon + '"');
        }
        if (typeof tool.labelKey !== 'string' || !tool.labelKey) errors.push(at + ': missing labelKey');
        if (tool.titleKey != null && (typeof tool.titleKey !== 'string' || !tool.titleKey)) {
          errors.push(at + ': invalid titleKey');
        }
        if (tool.kind !== 'action' && tool.kind !== 'toggle') {
          errors.push(at + ': kind must be "action" or "toggle"');
        }
      });
    });
    return errors;
  }

  return { TOOL_GROUPS, validateToolRegistry };
});
