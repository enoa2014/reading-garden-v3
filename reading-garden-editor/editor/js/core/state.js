const listeners = new Map();

const state = {
  mode: "checking",
  projectHandle: null,
  projectName: "",
  structure: {
    ok: false,
    missing: [],
  },
  books: [],
  bookHealth: [],
  errors: [],
  currentView: "dashboard",
  busy: false,
  newBookFeedback: null,
  packFeedback: null,
  packDiagnostic: null,
  aiSettings: null,
  aiFeedback: null,
  analysisFeedback: null,
  analysisSuggestion: null,
};

function emit(key) {
  const set = listeners.get(key);
  if (!set) return;
  set.forEach((cb) => {
    try {
      cb(state[key], state);
    } catch (err) {
      console.error("state listener error", err);
    }
  });
}

export function getState() {
  return state;
}

export function setState(patch) {
  const changed = [];
  Object.keys(patch).forEach((key) => {
    if (!(key in state)) return;
    if (state[key] === patch[key]) return;
    state[key] = patch[key];
    changed.push(key);
  });

  changed.forEach((key) => emit(key));
  if (changed.length) emit("*");
}

export function subscribe(key, callback) {
  if (!listeners.has(key)) listeners.set(key, new Set());
  const set = listeners.get(key);
  set.add(callback);
  return () => {
    set.delete(callback);
    if (!set.size) listeners.delete(key);
  };
}
