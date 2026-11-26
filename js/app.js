// App shell: navigation (tabs + modal stack mirrored into browser history),
// event delegation, rendering and the guided-player lifecycle.
import { CueEngine, unlockAudio, vibrate } from "./audio.js";
import { stretch } from "./content.js";
import { builderScreen, detailScreen, playerScreen } from "./modals.js";
import { PlayerController } from "./player.js";
import { libraryScreen, onboardingScreen, progressScreen, routinesScreen, settingsScreen, shiftMonth, thisMonthKey } from "./screens.js";
import * as store from "./store.js";
import { esc, icon, morphHTML } from "./ui.js";

const root = document.getElementById("app");
const cue = new CueEngine(store.getState().settings.voiceStyle);

const TABS = [
  ["routines", "Routines", "playCircle"],
  ["library", "Library", "figure"],
  ["progress", "Progress", "chart"],
  ["settings", "Settings", "sliders"],
];

const ui = {
  tab: "routines",
  routines: { showSearch: false, query: "", filter: "ALL" },
  library: { query: "", area: null, difficulty: null, kind: null, inspected: null },
  progress: { month: thisMonthKey(), selected: null, pendingDelete: null },
  settings: { showClear: false },
  onboarding: { page: 0, focusAreas: [], goal: 5 },
  toast: null,
};
/** @type {Array<object>} modal stack: {type:'detail'|'builder'|'player', ...} */
const stack = [];
const top = () => stack[stack.length - 1] || null;
const findRoutine = (id) => store.getState().allRoutines.find((r) => r.id === id) || null;
let itemKeySeq = 0;
const withKeys = (items) => items.map((i) => ({ stretchId: i.stretchId, seconds: i.seconds, key: ++itemKeySeq }));
const plainItems = (items) => items.map(({ stretchId, seconds }) => ({ stretchId, seconds }));

// ---------------------------------------------------------------- rendering
const scrollMemory = new Map();
let renderQueued = false;

function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    render();
  });
}

function applyTheme(mode) {
  const el = document.documentElement;
  if (mode === "LIGHT") el.setAttribute("data-theme", "light");
  else if (mode === "DARK") el.setAttribute("data-theme", "dark");
  else el.removeAttribute("data-theme");
  const bg = getComputedStyle(el).getPropertyValue("--bg").trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", bg || "#f7f1e8");
}

function tabView(S) {
  let body;
  if (ui.tab === "library") body = libraryScreen(S, ui);
  else if (ui.tab === "progress") body = progressScreen(S, ui);
  else if (ui.tab === "settings") body = settingsScreen(S, ui);
  else body = routinesScreen(S, ui, store.suggestedRoutines()[0]);
  return `<div class="screen" data-key="tab-${ui.tab}">${body}</div>
    <nav class="nav" data-key="nav" aria-label="Main">${TABS.map(
      ([id, label, ic]) => `<button data-act="tab" data-arg="${id}" ${ui.tab === id ? 'aria-current="page"' : ""}><span class="pill">${icon(ic)}</span>${label}</button>`,
    ).join("")}</nav>`;
}

function modalView(S, m, depth) {
  if (m.type === "detail") {
    const routine = findRoutine(m.routineId);
    if (!routine) return null;
    const sig = JSON.stringify(routine.items);
    if (m.sig !== sig) {
      m.sig = sig;
      m.items = routine.items.map((i) => ({ ...i }));
    }
    return `<div class="screen" data-key="m${depth}-detail-${esc(m.routineId)}">${detailScreen(S, m, routine)}</div>`;
  }
  if (m.type === "builder") return `<div class="screen" data-key="m${depth}-builder">${builderScreen(S, m)}</div>`;
  if (m.type === "player") return `<div class="screen" data-key="m${depth}-player">${playerScreen(S, m)}</div>`;
  return null;
}

function render() {
  const S = store.getState();
  applyTheme(S.settings.themeMode);
  let html;
  if (!S.settings.onboarded) {
    html = `<div class="screen" data-key="onboarding">${onboardingScreen(ui)}</div>`;
  } else if (top()) {
    html = modalView(S, top(), stack.length);
    if (html == null) {
      // The routine behind this modal is gone (e.g. deleted): drop it.
      closeTop();
      return;
    }
  } else {
    html = tabView(S);
  }
  if (ui.toast) html += `<div class="toast" data-key="toast" role="status">${esc(ui.toast)}</div>`;

  root.querySelectorAll("[data-scroll]").forEach((el) => scrollMemory.set(el.dataset.scroll, el.scrollTop));
  morphHTML(root, html);
  root.querySelectorAll("[data-scroll]").forEach((el) => {
    if (el.__restored) return;
    el.__restored = true;
    el.scrollTop = scrollMemory.get(el.dataset.scroll) || 0;
  });
}

let toastTimer = 0;
function toast(text) {
  ui.toast = text;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    ui.toast = null;
    render();
  }, 3200);
  render();
}

// ---------------------------------------------------------------- modal stack + history
// Every open modal has one history entry, so the browser/Android back button
// closes the top modal like Compose's BackHandler did.
let suppressPops = 0;

function pushModal(entry) {
  stack.push(entry);
  history.pushState({ bendito: stack.length }, "");
  if (entry.type === "player") startPlayer(entry);
  render();
}

function dropTop() {
  const m = stack.pop();
  if (m?.type === "player") stopPlayer(m);
  return m;
}

/** Closes the top modal from the UI (keeps history in step). */
function closeTop() {
  if (!stack.length) return;
  suppressPops++;
  history.back();
  dropTop();
  render();
}

window.addEventListener("popstate", () => {
  if (suppressPops > 0) {
    suppressPops--;
    return;
  }
  const m = top();
  if (!m) return;
  // Back first dismisses an open sheet/dialog, then the screen.
  const sheetOpen =
    (m.type === "detail" && (m.inspectedIdx != null || m.showDelete)) ||
    (m.type === "builder" && m.showAdd) ||
    (m.type === "player" && (m.showQueue || m.controller.state.showInstructions));
  const guardPlayer = m.type === "player" && m.controller.state.phase !== "COMPLETED";
  if (sheetOpen || guardPlayer) {
    if (m.type === "detail") Object.assign(m, { inspectedIdx: null, showDelete: false });
    if (m.type === "builder") m.showAdd = false;
    if (m.type === "player") {
      if (m.showQueue || m.controller.state.showInstructions) {
        m.showQueue = false;
        if (m.controller.state.showInstructions) m.controller.toggleInstructions();
      } else {
        m.showExit = true;
      }
    }
    history.pushState({ bendito: stack.length }, "");
    render();
    return;
  }
  dropTop();
  render();
});

// ---------------------------------------------------------------- player
let wakeLock = null;
async function acquireWakeLock() {
  try {
    if (!store.getState().settings.keepScreenOn || !("wakeLock" in navigator) || document.visibilityState !== "visible") return;
    if (wakeLock && !wakeLock.released) return;
    wakeLock = await navigator.wakeLock.request("screen");
  } catch {
    wakeLock = null;
  }
}
function releaseWakeLock() {
  wakeLock?.release?.().catch(() => {});
  wakeLock = null;
}
document.addEventListener("visibilitychange", () => {
  if (top()?.type === "player") acquireWakeLock();
});

function computeRingSize() {
  const w = Math.min(window.innerWidth, 600) - 40;
  const h = window.innerHeight - 20 - 48 - 118;
  return Math.round(Math.max(200, Math.min(w - 28, h * 0.56, 316)));
}

function openPlayer(routineId, routineName, items, startItemIndex = 0) {
  unlockAudio();
  pushModal({ type: "player", routineId, routineName, items: plainItems(items), startItemIndex, muted: false, showQueue: false, showExit: false, ringSize: computeRingSize() });
}

function startPlayer(m) {
  const startedAt = Date.now();
  const settings = () => store.getState().settings;
  cue.setVoiceStyle(settings().voiceStyle);
  cue.setMuted(false);
  m.controller = new PlayerController({
    routineId: m.routineId,
    routineName: m.routineName,
    items: m.items,
    transitionSeconds: settings().transitionSeconds,
    startItemIndex: m.startItemIndex,
    onChange: scheduleRender,
    onCue: (ev) => handleCue(ev, settings(), m.muted),
    onComplete: (elapsed, completedSteps) => {
      const id = store.recordSession({
        routineId: m.routineId,
        routineName: m.routineName,
        startedAt,
        durationSec: Math.max(elapsed, 1),
        stretchCount: Math.max(completedSteps, 1),
        completed: true,
      });
      m.controller.setSavedSession(id);
      releaseWakeLock();
    },
  });
  m.startedAt = startedAt;
  cue.preload(m.items.map((i) => i.stretchId));
  m.controller.start();
  acquireWakeLock();
}

function stopPlayer(m) {
  m.controller?.stop();
  cue.fadeOutSpeech();
  releaseWakeLock();
}

function handleCue(ev, s, muted) {
  const voice = !muted && s.voiceGuidance;
  const sounds = !muted && s.sounds;
  const step = ev.step;
  switch (ev.type) {
    case "Prepare":
      if (voice) cue.speakPrepare(step.stretch.id, step.side);
      break;
    case "UpNext":
      if (voice) cue.speakUpNext(step.stretch.id, step.side);
      break;
    case "StartStretch":
      if (sounds) cue.chime("start");
      if (s.vibration) vibrate(45);
      if (voice && ev.announceName) cue.speakStretch(step.stretch.id, step.side, s.sounds ? 220 : 0);
      break;
    case "SwitchSides":
      if (sounds) cue.chime("switch");
      if (s.vibration) vibrate(45);
      if (voice) cue.speakSwitchSides(s.sounds ? 220 : 0);
      break;
    case "Halfway":
      if (voice) cue.speakHalfway();
      break;
    case "CountdownTick":
      if (sounds) cue.chime("tick");
      break;
    case "Complete":
      if (sounds) cue.chime("complete");
      if (s.vibration) vibrate([70, 70, 120]);
      if (voice) cue.speakComplete(s.sounds ? 260 : 0);
      break;
  }
}

// ---------------------------------------------------------------- actions
const routineAt = (id) => findRoutine(id);
const parsePair = (arg) => arg.split(":").map(Number);

const actions = {
  tab(arg) {
    ui.tab = arg;
    ui.library.inspected = null;
  },
  back: () => closeTop(),
  closeSheet() {
    ui.library.inspected = null;
  },

  // routines tab
  toggleSearch() {
    ui.routines.showSearch = !ui.routines.showSearch;
    if (!ui.routines.showSearch) ui.routines.query = "";
    else requestAnimationFrame(() => root.querySelector('[data-input="routineQuery"]')?.focus());
  },
  clearRoutineQuery() {
    ui.routines.query = "";
  },
  routineFilter(arg) {
    ui.routines.filter = arg;
  },
  toggleFavorite: (id) => store.toggleFavorite(id),
  openRoutine(id) {
    const r = routineAt(id);
    if (r) pushModal({ type: "detail", routineId: id, items: null, sig: null, inspectedIdx: null, showDelete: false });
  },
  startRoutine(id) {
    const r = routineAt(id);
    if (r) openPlayer(r.id, r.name, r.items);
  },
  newRoutine: () => openBuilder(null, false),

  // library
  clearLibraryQuery() {
    ui.library.query = "";
  },
  libArea(arg) {
    ui.library.area = arg && ui.library.area !== arg ? arg : null;
  },
  libDifficulty(arg) {
    ui.library.difficulty = ui.library.difficulty === arg ? null : arg;
  },
  libKind(arg) {
    ui.library.kind = ui.library.kind === arg ? null : arg;
  },
  inspectStretch(id) {
    ui.library.inspected = id;
  },
  practiceStretch(id) {
    const s = stretch(id);
    ui.library.inspected = null;
    if (s) openPlayer(`single_${s.id}`, s.name, [{ stretchId: s.id, seconds: s.defaultSeconds }]);
  },

  // progress
  month(arg) {
    ui.progress.month = shiftMonth(ui.progress.month, Number(arg));
  },
  selectDay(arg) {
    ui.progress.selected = arg;
  },
  askDeleteSession(arg) {
    ui.progress.pendingDelete = Number(arg);
  },
  cancelDeleteSession() {
    ui.progress.pendingDelete = null;
  },
  confirmDeleteSession(arg) {
    ui.progress.pendingDelete = null;
    store.deleteSession(Number(arg));
  },

  // settings
  setGoal: (m) => store.updateSettings({ dailyGoalMinutes: Number(m) }),
  setTransition: (t) => store.updateSettings({ transitionSeconds: Number(t) }),
  setVoice(v) {
    store.updateSettings({ voiceStyle: v });
    cue.playPreview(v);
  },
  previewVoice() {
    cue.setMuted(false);
    cue.playPreview(store.getState().settings.voiceStyle);
  },
  setTheme: (t) => store.updateSettings({ themeMode: t }),
  toggleFocus(area) {
    store.updateSettings((s) => ({
      focusAreas: s.focusAreas.includes(area) ? s.focusAreas.filter((a) => a !== area) : [...s.focusAreas, area],
    }));
  },
  askClear() {
    ui.settings.showClear = true;
  },
  cancelClear() {
    ui.settings.showClear = false;
  },
  confirmClear() {
    ui.settings.showClear = false;
    store.clearAllData();
    toast("All history and custom routines cleared");
  },
  exportData() {
    const blob = new Blob([store.exportJSON()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `bendito-backup-${store.dayKey(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
  importData() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const { addedSessions, addedRoutines } = store.importJSON(await file.text());
        toast(`Imported ${addedSessions} session${addedSessions === 1 ? "" : "s"} and ${addedRoutines} routine${addedRoutines === 1 ? "" : "s"}`);
      } catch (e) {
        toast(e instanceof SyntaxError ? "That file isn't valid JSON." : e.message || "Import failed.");
      }
    };
    input.click();
  },

  // onboarding
  onbFocus(area) {
    const f = ui.onboarding.focusAreas;
    ui.onboarding.focusAreas = f.includes(area) ? f.filter((a) => a !== area) : [...f, area];
  },
  onbGoal(m) {
    ui.onboarding.goal = Number(m);
  },
  onbNext() {
    ui.onboarding.page++;
  },
  onbBack() {
    ui.onboarding.page = Math.max(0, ui.onboarding.page - 1);
  },
  onbFinish() {
    store.updateSettings({ onboarded: true, focusAreas: ui.onboarding.focusAreas, dailyGoalMinutes: ui.onboarding.goal });
  },

  // routine detail
  detailSec(arg) {
    const m = top();
    const [idx, delta] = parsePair(arg);
    const it = m.items[idx];
    if (it) it.seconds = Math.min(180, Math.max(10, it.seconds + delta));
  },
  detailInspect(idx) {
    top().inspectedIdx = Number(idx);
  },
  detailCloseSheet() {
    top().inspectedIdx = null;
  },
  startDetail() {
    const m = top();
    const r = routineAt(m.routineId);
    if (r) openPlayer(r.id, r.name, m.items);
  },
  startDetailFrom(idx) {
    const m = top();
    const r = routineAt(m.routineId);
    m.inspectedIdx = null;
    if (r) openPlayer(r.id, r.name, m.items, Number(idx));
  },
  editCustom: () => openBuilder(top().routineId, false),
  duplicateRoutine: () => openBuilder(top().routineId, true),
  askDeleteRoutine() {
    top().showDelete = true;
  },
  cancelDeleteRoutine() {
    top().showDelete = false;
  },
  confirmDeleteRoutine() {
    const id = top().routineId;
    top().showDelete = false;
    closeTop();
    store.deleteCustomRoutine(id);
  },

  // builder
  bSec(arg) {
    const [idx, delta] = parsePair(arg);
    const it = top().items[idx];
    if (it) it.seconds = Math.min(180, Math.max(10, it.seconds + delta));
  },
  bMove(arg) {
    const m = top();
    const [idx, dir] = parsePair(arg);
    const j = idx + dir;
    if (j < 0 || j >= m.items.length) return;
    [m.items[idx], m.items[j]] = [m.items[j], m.items[idx]];
  },
  bRemove(idx) {
    top().items.splice(Number(idx), 1);
  },
  bOpenAdd() {
    Object.assign(top(), { showAdd: true, addQuery: "", addArea: null });
  },
  bCloseAdd() {
    top().showAdd = false;
  },
  bAddArea(arg) {
    top().addArea = arg || null;
  },
  bAdd(id) {
    const m = top();
    const s = stretch(id);
    if (!s) return;
    m.items.push({ stretchId: s.id, seconds: s.defaultSeconds, key: ++itemKeySeq });
    m.error = null;
  },
  bSave() {
    const m = top();
    if (!m.name.trim()) return void (m.error = "Give your routine a name.");
    if (!m.items.length) return void (m.error = "Add at least one stretch.");
    const savedId = store.saveCustomRoutine(m.editingId, m.name, plainItems(m.items));
    closeTop();
    const prev = top();
    if (m.isDuplicate && prev?.type === "detail") {
      Object.assign(prev, { routineId: savedId, sig: null, inspectedIdx: null, showDelete: false });
    }
  },

  // player
  playerExit() {
    const m = top();
    if (m.controller.state.phase === "COMPLETED") closeTop();
    else m.showExit = true;
  },
  playerKeepGoing() {
    top().showExit = false;
  },
  playerDiscard() {
    top().showExit = false;
    closeTop();
  },
  playerSaveExit() {
    const m = top();
    const st = m.controller.state;
    m.showExit = false;
    store.recordSession({
      routineId: m.routineId,
      routineName: m.routineName,
      startedAt: m.startedAt,
      durationSec: st.elapsedActiveSec,
      stretchCount: Math.max(st.completedSteps, 1),
      completed: false,
    });
    closeTop();
  },
  playerMute() {
    const m = top();
    m.muted = !m.muted;
    cue.setMuted(m.muted);
  },
  playerQueue() {
    const m = top();
    m.showQueue = !m.showQueue;
  },
  playerInfo() {
    top().controller.toggleInstructions();
  },
  playerJump(idx) {
    const m = top();
    m.showQueue = false;
    m.controller.jumpToItem(Number(idx));
  },
  playerPrev: () => top().controller.previous(),
  playerNext: () => top().controller.next(),
  playerPause() {
    const c = top().controller;
    c.togglePause();
    if (c.state.isPaused) cue.fadeOutSpeech();
  },
  playerFeeling(v) {
    const m = top();
    m.controller.setFeeling(Number(v));
    if (m.controller.state.savedSessionId != null) store.updateSessionFeeling(m.controller.state.savedSessionId, Number(v));
  },
  playerDone: () => closeTop(),
};

function openBuilder(sourceId, isDuplicate) {
  const src = sourceId ? findRoutine(sourceId) : null;
  pushModal({
    type: "builder",
    isDuplicate,
    editingId: src && !isDuplicate && src.isCustom ? src.id : null,
    name: src ? (isDuplicate ? `${src.name} (Copy)` : src.name) : "",
    items: src ? withKeys(src.items) : [],
    showAdd: false,
    addQuery: "",
    addArea: null,
    error: null,
  });
}

const inputs = {
  routineQuery(v) {
    ui.routines.query = v;
  },
  libraryQuery(v) {
    ui.library.query = v;
  },
  addQuery(v) {
    top().addQuery = v;
  },
  bName(v) {
    const m = top();
    m.name = v;
    m.error = null;
  },
};

// ---------------------------------------------------------------- events
root.addEventListener("click", (e) => {
  const el = e.target.closest("[data-act]");
  if (!el || !root.contains(el) || el.disabled) return;
  // Clicks in a data-stop region (e.g. a stepper inside a clickable row) don't
  // trigger the row's own action.
  const stop = e.target.closest("[data-stop]");
  if (stop && el.contains(stop)) return;
  const fn = actions[el.dataset.act];
  if (!fn) return;
  fn(el.dataset.arg ?? "", el, e);
  render();
});

root.addEventListener("keydown", (e) => {
  if ((e.key === "Enter" || e.key === " ") && e.target.matches('[role="button"][data-act]')) {
    e.preventDefault();
    e.target.click();
  }
});

root.addEventListener("input", (e) => {
  const key = e.target.dataset?.input;
  if (key && inputs[key]) {
    inputs[key](e.target.value);
    render();
  }
});

root.addEventListener("change", (e) => {
  const key = e.target.dataset?.toggle;
  if (key) store.updateSettings({ [key]: e.target.checked });
});

document.addEventListener("keydown", (e) => {
  if (e.target.matches?.("input, textarea")) {
    if (e.key === "Escape") e.target.blur();
    return;
  }
  const m = top();
  if (e.key === "Escape") {
    if (m || ui.library.inspected || ui.settings.showClear || ui.progress.pendingDelete) {
      e.preventDefault();
      if (!m) {
        Object.assign(ui.library, { inspected: null });
        ui.settings.showClear = false;
        ui.progress.pendingDelete = null;
        render();
      } else {
        history.back(); // handled by popstate like a hardware back press
      }
    }
    return;
  }
  if (m?.type === "player" && m.controller.state.phase !== "COMPLETED" && !m.showExit) {
    const map = { " ": "playerPause", ArrowRight: "playerNext", ArrowLeft: "playerPrev", k: "playerPause", m: "playerMute" };
    const act = map[e.key];
    if (act) {
      e.preventDefault();
      actions[act]();
      render();
    }
  }
});

window.addEventListener("resize", () => {
  const m = top();
  if (m?.type === "player") {
    m.ringSize = computeRingSize();
    scheduleRender();
  }
});

// Re-render when stored data changes, and roll the day over at midnight.
store.subscribe(scheduleRender);
setInterval(() => {
  if (!top()) scheduleRender();
}, 60_000);
window.matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", scheduleRender);

if (history.state?.bendito) history.replaceState(null, "");
render();

if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
