// Persistent app state (settings, session history, custom routines) kept in
// localStorage, plus the streak/minutes statistics derived from it.
import { PLYO_RECOVERY_DAYS, builtInRoutineIds, builtInRoutines, customToRoutine, isPlyoRoutine, stretch } from "./content.js";

const KEY = "bendito.v1";

export const DEFAULT_SETTINGS = {
  onboarded: false,
  focusAreas: [],
  dailyGoalMinutes: 5,
  transitionSeconds: 5,
  voiceGuidance: true,
  voiceStyle: "AVA",
  vibration: true,
  sounds: true,
  keepScreenOn: true,
  themeMode: "SYSTEM",
  favorites: [],
  // Which side of the Routines tab is showing: stretching (false) or plyometrics (true).
  plyoMode: false,
};

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}");
    return {
      settings: { ...DEFAULT_SETTINGS, ...(raw.settings || {}) },
      sessions: Array.isArray(raw.sessions) ? raw.sessions : [],
      customRoutines: Array.isArray(raw.customRoutines) ? raw.customRoutines : [],
    };
  } catch {
    return { settings: { ...DEFAULT_SETTINGS }, sessions: [], customRoutines: [] };
  }
}

let data = read();
let persistOk = true;
const listeners = new Set();

function commit() {
  data.sessions.sort((a, b) => b.startedAt - a.startedAt);
  data.customRoutines.sort((a, b) => b.updatedAt - a.updatedAt);
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    persistOk = true;
  } catch {
    persistOk = false; // private mode / storage full: keep working in memory
  }
  cachedDerived = null;
  listeners.forEach((fn) => fn());
}

export const subscribe = (fn) => (listeners.add(fn), () => listeners.delete(fn));
export const storageWorks = () => persistOk;

let cachedDerived = null;
export function getState() {
  if (!cachedDerived) {
    cachedDerived = {
      ...data,
      allRoutines: [...data.customRoutines.map(customToRoutine), ...builtInRoutines],
      stats: computeStats(data.sessions),
      plyoWeek: plyoWeek(data.sessions),
    };
  }
  return cachedDerived;
}

export function updateSettings(patch) {
  data.settings = { ...data.settings, ...(typeof patch === "function" ? patch(data.settings) : patch) };
  commit();
}

export function toggleFavorite(id) {
  const fav = new Set(data.settings.favorites);
  fav.has(id) ? fav.delete(id) : fav.add(id);
  updateSettings({ favorites: [...fav] });
}

export function saveCustomRoutine(id, name, items) {
  const rand = crypto.randomUUID?.() ?? Math.random().toString(16).slice(2) + Date.now().toString(16);
  const routineId = id || `custom_${rand.slice(0, 8)}`;
  const entry = { id: routineId, name: name.trim(), items: items.map((i) => ({ ...i })), updatedAt: Date.now() };
  data.customRoutines = [entry, ...data.customRoutines.filter((r) => r.id !== routineId)];
  commit();
  return routineId;
}

export function deleteCustomRoutine(id) {
  data.customRoutines = data.customRoutines.filter((r) => r.id !== id);
  data.settings = { ...data.settings, favorites: data.settings.favorites.filter((f) => f !== id) };
  commit();
}

export function recordSession(s) {
  const id = Math.max(Date.now(), ...data.sessions.map((x) => x.id + 1));
  data.sessions.push({ id, feeling: 0, ...s });
  commit();
  return id;
}

export function updateSessionFeeling(id, feeling) {
  data.sessions = data.sessions.map((s) => (s.id === id ? { ...s, feeling } : s));
  commit();
}

export function deleteSession(id) {
  data.sessions = data.sessions.filter((s) => s.id !== id);
  commit();
}

export function clearAllData() {
  data.sessions = [];
  data.customRoutines = [];
  data.settings = { ...data.settings, favorites: data.settings.favorites.filter((f) => builtInRoutineIds.has(f)) };
  commit();
}

export function exportJSON() {
  return JSON.stringify({ app: "bendito", version: 1, exportedAt: new Date().toISOString(), ...data }, null, 2);
}

/** Merges a backup into current data. Returns counts of what was added. */
export function importJSON(text) {
  const raw = JSON.parse(text);
  if (!raw || (raw.app && raw.app !== "bendito")) throw new Error("Not a Bendito backup file.");
  const sessions = (Array.isArray(raw.sessions) ? raw.sessions : []).filter(
    (s) => s && typeof s.startedAt === "number" && typeof s.durationSec === "number" && s.routineName,
  );
  const customs = (Array.isArray(raw.customRoutines) ? raw.customRoutines : []).filter(
    (r) => r && r.id && r.name && Array.isArray(r.items) && r.items.every((i) => stretch(i.stretchId)),
  );
  const seen = new Set(data.sessions.map((s) => `${s.startedAt}|${s.routineId}`));
  let addedSessions = 0;
  let nextId = Math.max(Date.now(), ...data.sessions.map((x) => x.id + 1));
  for (const s of sessions) {
    const k = `${s.startedAt}|${s.routineId}`;
    if (seen.has(k)) continue;
    seen.add(k);
    data.sessions.push({ ...s, id: nextId++ });
    addedSessions++;
  }
  const byId = new Map(data.customRoutines.map((r) => [r.id, r]));
  for (const r of customs) {
    const cur = byId.get(r.id);
    if (!cur || (r.updatedAt || 0) > (cur.updatedAt || 0)) byId.set(r.id, { ...r, updatedAt: r.updatedAt || Date.now() });
  }
  const addedRoutines = byId.size - data.customRoutines.length;
  data.customRoutines = [...byId.values()];
  if (raw.settings && Array.isArray(raw.settings.favorites)) {
    const fav = new Set([...data.settings.favorites, ...raw.settings.favorites]);
    data.settings = { ...data.settings, favorites: [...fav] };
  }
  commit();
  return { addedSessions, addedRoutines };
}

// ---------------------------------------------------------------- dates & stats
export const dayKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const keyToDate = (k) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

export function currentStreak(days, today) {
  let d = days.has(dayKey(today)) ? today : addDays(today, -1);
  let n = 0;
  while (days.has(dayKey(d))) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

export function longestStreak(days) {
  if (!days.size) return 0;
  const sorted = [...days].sort();
  let best = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    run = dayKey(addDays(keyToDate(sorted[i - 1]), 1)) === sorted[i] ? run + 1 : 1;
    if (run > best) best = run;
  }
  return best;
}

export function computeStats(sessions, today = new Date()) {
  const minutesByDay = new Map();
  for (const s of sessions) {
    const k = dayKey(new Date(s.startedAt));
    minutesByDay.set(k, (minutesByDay.get(k) || 0) + s.durationSec / 60);
  }
  const days = new Set(minutesByDay.keys());
  const todayKey = dayKey(today);
  const weekStart = addDays(today, -((today.getDay() + 6) % 7)); // Monday
  const weekStartKey = dayKey(weekStart);
  let weekMinutes = 0;
  for (const [k, m] of minutesByDay) if (k >= weekStartKey && k <= todayKey) weekMinutes += m;
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const d = addDays(today, -i);
    last7Days.push([d, minutesByDay.get(dayKey(d)) || 0]);
  }
  const counts = new Map();
  for (const s of sessions) counts.set(s.routineName, (counts.get(s.routineName) || 0) + 1);
  return {
    currentStreak: currentStreak(days, today),
    longestStreak: longestStreak(days),
    totalSessions: sessions.length,
    totalMinutes: Math.floor(sessions.reduce((a, s) => a + s.durationSec, 0) / 60),
    todayMinutes: minutesByDay.get(todayKey) || 0,
    weekMinutes: Math.floor(weekMinutes),
    last7Days,
    activeDays: days,
    minutesByDay,
    topRoutines: [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3),
  };
}

/**
 * The current Monday-to-Sunday week of plyometric training, as StatsCalculator.plyoWeek.
 * Sessions count when they were saved with `plyo: true`.
 */
export function plyoWeek(sessions, today = new Date()) {
  const todayKey = dayKey(today);
  const days = new Set(sessions.filter((s) => s.plyo).map((s) => dayKey(new Date(s.startedAt))).filter((k) => k <= todayKey));
  const weekStart = addDays(today, -((today.getDay() + 6) % 7)); // Monday
  const weekStartKey = dayKey(weekStart);
  const lastKey = days.size ? [...days].sort().pop() : null;
  const lastSession = lastKey ? keyToDate(lastKey) : null;
  const startOfToday = keyToDate(todayKey);
  const daysSinceLast = lastSession ? Math.round((startOfToday - lastSession) / 86_400_000) : null;
  const isReady = daysSinceLast == null || daysSinceLast >= PLYO_RECOVERY_DAYS;
  const readyDay = lastSession ? addDays(lastSession, PLYO_RECOVERY_DAYS) : null;
  return {
    weekStart,
    /** Day keys this week with at least one plyometric session. */
    daysDone: new Set([...days].filter((k) => k >= weekStartKey)),
    sessionsThisWeek: [...days].filter((k) => k >= weekStartKey).length,
    lastSession,
    daysSinceLast,
    isReady,
    /** The first day a new session fits; today when ready. */
    nextReadyDay: readyDay && readyDay > startOfToday ? readyDay : startOfToday,
  };
}

/** Same ranking as BenditoViewModel.suggestedRoutines(). */
export function suggestedRoutines(hour = new Date().getHours()) {
  const { allRoutines, settings } = getState();
  // The recommendation card belongs to the stretching side; plyo has its own weekly plan.
  const all = allRoutines.filter((r) => !isPlyoRoutine(r));
  const focus = new Set(settings.focusAreas);
  const timeIds =
    hour < 11 ? ["wake_up", "posture_reset", "full_body"]
    : hour < 18 ? ["posture_reset", "desk_break", "full_body"]
    : ["bedtime", "evening_unwind", "de_stress"];
  const timeRoutines = timeIds.map((id) => all.find((r) => r.id === id)).filter(Boolean);
  const focusRanked = !focus.size
    ? []
    : all
        .map((r) => [r, r.items.filter((it) => [...(stretch(it.stretchId)?.allAreas || [])].some((a) => focus.has(a))).length])
        .filter(([, score]) => score > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([r]) => r);
  const combined = new Map();
  if (timeRoutines[0]) combined.set(timeRoutines[0].id, timeRoutines[0]);
  for (const r of [...focusRanked, ...timeRoutines]) if (!combined.has(r.id)) combined.set(r.id, r);
  return [...combined.values()].slice(0, 6);
}
