export function readSave(key, validate) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return validate(value) ? value : null;
  } catch { return null; }
}

export function readRecord(key) {
  try {
    const value = Number(localStorage.getItem(key));
    return Number.isSafeInteger(value) && value >= 0 ? value : 0;
  } catch { return 0; }
}

export function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch { return false; }
}

export function bindings() {
  const controller = new AbortController();
  return {
    on(target, event, callback, options = {}) {
      target.addEventListener(event, callback, { ...options, signal: controller.signal });
    },
    dispose() { controller.abort(); },
  };
}
