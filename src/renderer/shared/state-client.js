(function (root) {
  const api = root.StudyTimerShared || (root.StudyTimerShared = {});
  const schema = api.ensureState ? api : null;
  const key = (schema && schema.STORE_KEY) || 'studyTimer.v1';
  function readAll() {
    const bridge = root.studyTimer;
    if (bridge && bridge.loadAllSync) { try { return bridge.loadAllSync() || {}; } catch (e) { return {}; } }
    return null;
  }
  function loadState() {
    let saved = null;
    const all = readAll();
    if (all) saved = all.state || null;
    else { try { const raw = root.localStorage.getItem(key); if (raw) saved = JSON.parse(raw); } catch (e) {} }
    return schema ? schema.ensureState(saved) : (saved || {});
  }
  function saveState(state, metadata) {
    const bridge = root.studyTimer;
    if (bridge && bridge.saveAll) bridge.saveAll(Object.assign({ state }, metadata || {}));
    else { try { root.localStorage.setItem(key, JSON.stringify(state)); } catch (e) {} }
  }
  api.readAll = readAll; api.loadState = loadState; api.saveState = saveState;
})(typeof window !== 'undefined' ? window : globalThis);
