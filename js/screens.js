// Tab screens (Routines, Library, Progress, Settings) and onboarding.
import {
  AREAS, AREA_LABEL, CATEGORIES, DIFFICULTIES, KINDS, PLYO_LEVELS, PLYO_SESSIONS_PER_WEEK, VOICES, allExercises, isPlyoRoutine, plyoExercises,
  plyoLevel, stretch, stretches,
} from "./content.js";
import { dialog, heroCard, routineCard, sheet, stretchDetail, stretchRow } from "./components.js";
import { addDays, dayKey, keyToDate, storageWorks } from "./store.js";
import { esc, formatDuration, icon } from "./ui.js";

const FILTERS = [
  ["ALL", "All"],
  ["FAVORITES", "Favorites"],
  ["DAILY", "Daily"],
  ["RELIEF", "Pain Relief"],
  ["FLEXIBILITY", "Flexibility"],
  ["SPORT", "Sport & Recovery"],
  ["RELAX", "Relax & Sleep"],
  ["EXPERT", "Expert"],
  ["CUSTOM", "My Routines"],
];
const CATEGORY_ORDER = ["CUSTOM", "DAILY", "RELIEF", "FLEXIBILITY", "SPORT", "RELAX", "EXPERT"];
const PLYO_FILTERS = [["ALL", "All"], ...PLYO_LEVELS, ["CUSTOM", "My Workouts"]];
const weekdayFmt = new Intl.DateTimeFormat(undefined, { weekday: "long" });
const has = (hay, needle) => hay.toLowerCase().includes(needle.toLowerCase());
const chip = (label, pressed, act, arg = "", cls = "") =>
  `<button class="chip ${cls}" aria-pressed="${pressed}" data-act="${act}" data-arg="${esc(arg)}">${pressed && cls.includes("lg") ? icon("check", 18) : ""}${esc(label)}</button>`;

// ---------------------------------------------------------------- Routines
const modeSwitch = (plyo) => `<div class="seg" data-key="mode" role="group" aria-label="Training mode">
    <button aria-pressed="${!plyo}" data-act="setMode" data-arg="stretch">${icon("leaf", 16)}Stretch</button>
    <button aria-pressed="${plyo}" data-act="setMode" data-arg="plyo">${icon("bolt", 16)}Plyo</button>
  </div>`;

const routinesHead = (u, sub, placeholder) => `<div class="row between" data-key="head">
      <div><h1 class="headline-m">${greeting()}</h1><div class="body-m muted">${sub}</div></div>
      <button class="icon-btn" data-act="toggleSearch" aria-label="${u.showSearch ? "Close search" : "Search routines"}">${icon(u.showSearch ? "close" : "search")}</button>
    </div>
    ${u.showSearch ? `<label class="field" data-key="search">${icon("search")}<input type="search" data-input="routineQuery" placeholder="${placeholder}" value="${esc(u.query)}" autocomplete="off" aria-label="Search routines">${u.query ? `<button class="icon-btn sm" data-act="clearRoutineQuery" aria-label="Clear">${icon("close", 20)}</button>` : ""}</label>` : ""}`;

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

/** Weekly plyo plan: sessions done of the weekly target, Monday-to-Sunday dots and readiness. */
function plyoWeekCard(week) {
  const today = new Date();
  const todayKey = dayKey(today);
  const dots = ["M", "T", "W", "T", "F", "S", "S"]
    .map((label, i) => {
      const k = dayKey(addDays(week.weekStart, i));
      const cls = [week.daysDone.has(k) && "did", k === todayKey && "today"].filter(Boolean).join(" ");
      return `<span class="${cls}"><i></i>${label}</span>`;
    })
    .join("");
  const n = week.sessionsThisWeek;
  const since = week.daysSinceLast;
  const last = since == null ? "No plyo sessions yet." : since === 0 ? "Last plyo today." : since === 1 ? "Last plyo yesterday." : `Last plyo ${since} days ago.`;
  const tomorrow = dayKey(week.nextReadyDay) === dayKey(addDays(today, 1));
  const status = week.isReady ? "Legs ready" : `Next: ${tomorrow ? "tomorrow" : weekdayFmt.format(week.nextReadyDay)}`;
  return `<div class="card week" data-key="week">
    <div class="row between"><span class="title-s">${n} of ${PLYO_SESSIONS_PER_WEEK} sessions this week</span><span class="label-m ${week.isReady ? "accent" : "muted"}">${status}</span></div>
    <div class="days" role="img" aria-label="${n} plyo session${n === 1 ? "" : "s"} this week">${dots}</div>
    <div class="body-s muted">${last} Leave 48 hours between sessions.</div>
  </div>`;
}

function plyoRoutinesScreen(S, ui) {
  const u = ui.routines;
  const q = u.query.trim();
  const fav = new Set(S.settings.favorites);
  const ts = S.settings.transitionSeconds;
  const f = u.plyoFilter || "ALL";
  const filtered = S.allRoutines.filter((r) => {
    if (!isPlyoRoutine(r)) return false;
    const fOk = f === "ALL" ? true : f === "CUSTOM" ? r.isCustom : !r.isCustom && plyoLevel(r.items) === f;
    const qOk = !q || has(r.name, q) || has(r.subtitle, q) || r.items.some((it) => has(stretch(it.stretchId)?.name || "", q));
    return fOk && qOk;
  });
  const card = (r) => routineCard(r, { transitionSeconds: ts, isFavorite: fav.has(r.id) });
  let list;
  if (!filtered.length) {
    const [t, d] = f === "CUSTOM" ? ["No custom workouts yet", "Tap New Workout below to build your own playlist."] : ["No matching workouts", "Try another search term or level."];
    list = `<div class="card empty" data-key="empty" style="margin-top:16px"><div class="title-m">${t}</div><div class="body-m muted" style="margin-top:6px">${d}</div></div>`;
  } else if (f === "ALL" && !q) {
    const custom = filtered.filter((r) => r.isCustom);
    const builtIn = filtered.filter((r) => !r.isCustom);
    list = (custom.length ? `<div class="section-head" data-key="h-PCUSTOM"><h2 class="title-l">My Workouts</h2><div class="body-s muted">Playlists you built</div></div>${custom.map(card).join("")}` : "") +
      `<div class="section-head" data-key="h-PLYO"><h2 class="title-l">${CATEGORIES.PLYO.label}</h2><div class="body-s muted">${CATEGORIES.PLYO.blurb}</div></div>${builtIn.map(card).join("")}`;
  } else {
    list = filtered.map(card).join("");
  }
  return `<div class="screen">
    <div class="scroll" data-scroll="routines-plyo"><div class="pad stack" style="padding-bottom:92px">
      ${routinesHead(u, "Pick a workout or build your own", "Search workouts or exercises...")}
      ${modeSwitch(true)}
      ${plyoWeekCard(S.plyoWeek)}
      <div class="chips" data-key="pfilters" role="toolbar" aria-label="Filter workouts">${PLYO_FILTERS.map(([id, label]) => chip(label, f === id, "plyoFilter", id)).join("")}</div>
      ${list}
    </div></div>
    <button class="fab" data-act="newRoutine">${icon("plus")}New Workout</button>
  </div>`;
}

export function routinesScreen(S, ui, recommended) {
  if (S.settings.plyoMode) return plyoRoutinesScreen(S, ui);
  const u = ui.routines;
  const q = u.query.trim();
  const fav = new Set(S.settings.favorites);
  const ts = S.settings.transitionSeconds;
  const filtered = S.allRoutines.filter((r) => {
    if (isPlyoRoutine(r)) return false; // plyo workouts live on the Plyo side
    const fOk = u.filter === "ALL" ? true : u.filter === "FAVORITES" ? fav.has(r.id) : r.category === u.filter;
    const qOk = !q || has(r.name, q) || has(r.subtitle, q) || r.items.some((it) => has(stretch(it.stretchId)?.name || "", q));
    return fOk && qOk;
  });
  const goal = Math.max(1, S.settings.dailyGoalMinutes);
  const todayMin = S.stats.todayMinutes;
  const pct = Math.min(1, todayMin / goal) * 100;
  const card = (r) => routineCard(r, { transitionSeconds: ts, isFavorite: fav.has(r.id) });

  let list = "";
  if (u.filter === "ALL" && !q) {
    for (const cat of CATEGORY_ORDER) {
      const rs = filtered.filter((r) => r.category === cat);
      if (!rs.length) continue;
      list += `<div class="section-head" data-key="h-${cat}"><h2 class="title-l">${CATEGORIES[cat].label}</h2><div class="body-s muted">${CATEGORIES[cat].blurb}</div></div>`;
      list += rs.map(card).join("");
    }
  } else if (!filtered.length) {
    const [t, d] =
      u.filter === "FAVORITES" ? ["No favorites yet", "Tap the heart on any routine to keep it handy here."]
      : u.filter === "CUSTOM" ? ["No custom routines yet", "Tap New Routine below to design your own sequence."]
      : ["No matching routines", "Try another search term or filter."];
    list = `<div class="card empty" data-key="empty" style="margin-top:16px"><div class="title-m">${t}</div><div class="body-m muted" style="margin-top:6px">${d}</div></div>`;
  } else {
    list = filtered.map(card).join("");
  }

  return `<div class="screen">
    <div class="scroll" data-scroll="routines"><div class="pad stack" style="padding-bottom:92px">
      ${routinesHead(u, "Pick a routine or build your own", "Search routines or stretches...")}
      ${modeSwitch(false)}
      <button class="card row" data-key="goal" data-act="tab" data-arg="progress" style="padding:12px 16px;gap:0">
        <span class="accent">${icon("fire", 26)}</span>
        <span class="col" style="margin-left:8px"><span class="title-s bold">${S.stats.currentStreak} day streak</span><span class="body-s muted">Best ${S.stats.longestStreak}d</span></span>
        <span class="grow" style="margin-left:18px">
          <span class="row between"><span class="label-m">Today's goal</span><span class="label-m accent">${Math.round(todayMin)} / ${goal} min</span></span>
          <span class="bar" style="display:block;margin-top:6px"><i style="width:${pct}%"></i></span>
        </span>
      </button>
      ${recommended && u.filter === "ALL" && !q ? `<div data-key="hero">${heroCard(recommended, { transitionSeconds: ts, isFavorite: fav.has(recommended.id) })}</div>` : ""}
      <div class="chips" data-key="filters" role="toolbar" aria-label="Filter routines">${FILTERS.map(([id, label]) => chip(label, u.filter === id, "routineFilter", id)).join("")}</div>
      ${list}
    </div></div>
    <button class="fab" data-act="newRoutine">${icon("plus")}New Routine</button>
  </div>`;
}

// ---------------------------------------------------------------- Library
export function libraryScreen(S, ui) {
  const u = ui.library;
  const q = u.query.trim();
  const filtered = allExercises.filter(
    (s) =>
      (!u.area || s.allAreas.has(u.area)) &&
      (!u.difficulty || s.difficulty === u.difficulty) &&
      (!u.kind || s.kind === u.kind) &&
      (!q || has(s.name, q) || has(s.description, q) || has(AREA_LABEL[s.area], q)),
  );
  const inspected = u.inspected && stretch(u.inspected);
  return `<div class="screen">
    <div class="scroll" data-scroll="library"><div class="pad stack">
      <div data-key="head"><h1 class="headline-m">Exercise Library</h1><div class="body-m muted">${stretches.length} stretches, yoga poses &amp; mobility drills, plus ${plyoExercises.length} plyo exercises</div></div>
      <label class="field" data-key="search">${icon("search")}<input type="search" data-input="libraryQuery" placeholder="Search exercises, muscles..." value="${esc(u.query)}" autocomplete="off" aria-label="Search exercises">${u.query ? `<button class="icon-btn sm" data-act="clearLibraryQuery" aria-label="Clear">${icon("close", 20)}</button>` : ""}</label>
      <div class="chips" data-key="areas">${chip("All areas", !u.area, "libArea", "")}${AREAS.map(([id, l]) => chip(l, u.area === id, "libArea", id)).join("")}</div>
      <div class="chips" data-key="kinds" style="margin-top:-4px">${DIFFICULTIES.map(([id, l]) => chip(l, u.difficulty === id, "libDifficulty", id)).join("")}${KINDS.map(([id, l]) => chip(l, u.kind === id, "libKind", id)).join("")}</div>
      <div class="label-l muted" data-key="count">${filtered.length} ${filtered.every((s) => s.plyo) && filtered.length ? "exercises" : "stretches"}</div>
      ${filtered.map((s) => stretchRow(s, { key: `s-${s.id}` })).join("")}
    </div></div>
    ${inspected ? sheet(stretchDetail(inspected), { label: inspected.name }) : ""}
  </div>`;
}

// ---------------------------------------------------------------- Progress
const FEELING_EMOJI = { 1: "😖", 2: "😕", 3: "🙂", 4: "😌", 5: "🤩" };
const LEG_FEELING_EMOJI = { 1: "🥵", 2: "😮‍💨", 3: "🙂", 4: "😀", 5: "🤩" };
const dateFmt = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const monthDayFmt = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const monthFmt = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });
const narrowDay = new Intl.DateTimeFormat(undefined, { weekday: "narrow" });

export function progressScreen(S, ui) {
  const u = ui.progress;
  const st = S.stats;
  const goal = Math.max(1, S.settings.dailyGoalMinutes);
  const today = new Date();
  const todayKey = dayKey(today);
  const statCard = (title, value, sub) =>
    `<div class="card stat"><div class="label-m muted">${title}</div><div class="v tnum">${value}</div><div class="body-s muted">${sub}</div></div>`;

  const maxVal = Math.max(goal, ...st.last7Days.map(([, m]) => m), 1);
  const goalFrac = Math.min(1, goal / maxVal);
  const bars = st.last7Days
    .map(([, m]) => {
      const frac = Math.min(1, m / maxVal);
      const h = m <= 0 ? 4 : Math.max(8, frac * 100);
      return `<div><i class="${m <= 0 ? "none" : m >= goal ? "" : "part"}" style="height:${h}%"></i></div>`;
    })
    .join("");
  const labels = st.last7Days.map(([d]) => `<span class="label-s muted">${narrowDay.format(d)}</span>`).join("");

  // month calendar (Monday first)
  const [y, m] = u.month.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(y, m, 0).getDate();
  let cells = ["M", "T", "W", "T", "F", "S", "S"].map((d) => `<span class="dow label-s muted">${d}</span>`).join("");
  for (let i = 0; i < lead; i++) cells += "<span></span>";
  for (let d = 1; d <= days; d++) {
    const k = dayKey(new Date(y, m - 1, d));
    const cls = [st.activeDays.has(k) && "active", k === todayKey && "today", k === u.selected && "sel", k > todayKey && "future"].filter(Boolean).join(" ");
    cells += `<button class="${cls}" data-act="selectDay" data-arg="${k}" aria-label="${monthDayFmt.format(keyToDate(k))}">${d}</button>`;
  }
  let selText = "";
  if (u.selected) {
    const mins = st.minutesByDay.get(u.selected) || 0;
    const label = monthDayFmt.format(keyToDate(u.selected));
    selText = `<div class="body-s muted" style="margin-top:10px">${label}: ${mins > 0 ? `${Math.max(1, Math.round(mins))} active min` : "No sessions"}</div>`;
  }

  const sessions = S.sessions.slice(0, 30);
  const pending = u.pendingDelete && S.sessions.find((s) => s.id === u.pendingDelete);

  return `<div class="screen">
    <div class="scroll" data-scroll="progress"><div class="pad stack">
      <div><h1 class="headline-m">Your Progress</h1><div class="body-m muted">Consistency beats intensity</div></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        ${statCard("Current Streak", st.currentStreak, st.currentStreak === 1 ? "day" : "days")}
        ${statCard("Longest Streak", st.longestStreak, st.longestStreak === 1 ? "day" : "days")}
        ${statCard("Total Minutes", st.totalMinutes, "minutes")}
        ${statCard("Total Sessions", st.totalSessions, "sessions")}
      </div>
      <div class="card pad16">
        <div class="row between"><span class="title-m">Today's Goal</span><span class="label-l accent">${Math.round(st.todayMinutes)} / ${goal} min</span></div>
        <div class="bar" style="margin-top:10px;height:10px"><i style="width:${Math.min(1, st.todayMinutes / goal) * 100}%"></i></div>
        <div class="body-s muted" style="margin-top:10px">${st.weekMinutes} active min this week</div>
      </div>
      <div class="card pad16">
        <div class="row between"><span class="title-m">Last 7 Days</span><span class="label-m" style="color:var(--secondary)">Goal: ${goal} min</span></div>
        <div class="bars" style="margin-top:14px">
          <div class="goal" style="bottom:${24 + 100 * goalFrac}px"></div>
          <div class="cols">${bars}</div>
          <div class="labels">${labels}</div>
        </div>
      </div>
      <div class="card pad16">
        <div class="row between">
          <button class="icon-btn" data-act="month" data-arg="-1" aria-label="Previous month">${icon("chevLeft")}</button>
          <span class="title-m">${monthFmt.format(first)}</span>
          <button class="icon-btn" data-act="month" data-arg="1" aria-label="Next month">${icon("chevRight")}</button>
        </div>
        <div class="cal" style="margin-top:4px">${cells}</div>
        ${selText}
      </div>
      ${st.topRoutines.length ? `<div class="card pad16"><div class="title-m">Favorite Routines</div><div class="col gap8" style="margin-top:10px">${st.topRoutines
        .map(([name, n], i) => `<div class="row gap10"><span class="step-num">${i + 1}</span><span class="grow body-m ellipsis">${esc(name)}</span><span class="label-m muted">${n}×</span></div>`)
        .join("")}</div></div>` : ""}
      <h2 class="title-l" style="margin-top:6px">Recent Sessions</h2>
      ${sessions.length ? sessions
        .map((s) => `<div class="card row" data-key="sess-${s.id}" style="padding:12px 14px;border-radius:16px">
          <div class="grow"><div class="title-s ellipsis">${esc(s.routineName)}</div><div class="body-s muted" style="margin-top:2px">${dateFmt.format(new Date(s.startedAt))} · ${formatDuration(s.durationSec)} · ${s.stretchCount} ${s.plyo ? "sets" : "poses"}</div></div>
          ${FEELING_EMOJI[s.feeling] ? `<span style="font-size:20px;margin-right:4px">${(s.plyo ? LEG_FEELING_EMOJI : FEELING_EMOJI)[s.feeling]}</span>` : ""}
          <button class="icon-btn" data-act="askDeleteSession" data-arg="${s.id}" aria-label="Delete session">${icon("trash", 20)}</button>
        </div>`)
        .join("") : `<div class="card empty"><div class="title-m">No sessions logged yet</div><div class="body-m muted" style="margin-top:6px">Complete your first routine to start building a streak.</div></div>`}
    </div></div>
    ${pending ? dialog({
      title: "Delete session?",
      text: `Remove this "${pending.routineName}" entry from your history?`,
      actions: [{ label: "Cancel", act: "cancelDeleteSession" }, { label: "Delete", act: "confirmDeleteSession", arg: pending.id, danger: true }],
    }) : ""}
  </div>`;
}

export function shiftMonth(monthKey, delta) {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ---------------------------------------------------------------- Settings
const switchRow = (title, subtitle, key, on) => `<label class="setting-row">
  <span class="grow"><span class="title-s" style="display:block">${title}</span><span class="body-s muted">${subtitle}</span></span>
  <span class="switch"><input type="checkbox" role="switch" data-toggle="${key}" ${on ? "checked" : ""}><span></span></span>
</label>`;

export function settingsScreen(S, ui) {
  const s = S.settings;
  const u = ui.settings;
  const focus = new Set(s.focusAreas);
  const card = (title, body) => `<section class="card pad16"><h2 class="title-m" style="margin-bottom:12px">${title}</h2>${body}</section>`;
  return `<div class="screen">
    <div class="scroll" data-scroll="settings"><div class="pad stack">
      <h1 class="headline-m">Settings</h1>
      ${storageWorks() ? "" : `<div class="caution body-m">This browser isn't letting Bendito save data (private browsing?). Your progress will be lost when you close the tab.</div>`}
      ${card("Daily Goal", `<div class="chips wrap">${[3, 5, 10, 15, 20].map((m) => chip(`${m} min`, s.dailyGoalMinutes === m, "setGoal", m)).join("")}</div>`)}
      ${card("Guided Player", `
        <div class="label-l">Transition Between Stretches</div>
        <div class="chips wrap" style="margin:8px 0 8px">${[0, 3, 5, 8, 10].map((t) => chip(t === 0 ? "None" : `${t}s`, s.transitionSeconds === t, "setTransition", t)).join("")}</div>
        <div class="hr"></div>
        ${switchRow("Voice Guidance", "Announce stretch names and side switches", "voiceGuidance", s.voiceGuidance)}
        ${s.voiceGuidance ? `<div style="padding:4px 0 8px"><div class="label-l">Coach Voice</div>
          <div class="row wrap gap8" style="margin-top:8px">${Object.entries(VOICES).map(([id, v]) => chip(`${v.label} · ${v.subtitle}`, s.voiceStyle === id, "setVoice", id)).join("")}
          <button class="btn tonal" style="height:32px;padding:0 14px" data-act="previewVoice">${icon("volume", 18)}Preview</button></div></div>` : ""}
        ${switchRow("Sound Effects", "Play subtle start and countdown chimes", "sounds", s.sounds)}
        ${"vibrate" in navigator ? switchRow("Vibration", "Haptic pulse on transitions", "vibration", s.vibration) : ""}
        ${"wakeLock" in navigator ? switchRow("Keep Screen On", "Prevent sleep while a routine is playing", "keepScreenOn", s.keepScreenOn) : ""}
      `)}
      ${card("Focus Areas", `<div class="body-s muted" style="margin:-6px 0 10px">Used to tailor your Recommended routine</div>
        <div class="chips wrap">${AREAS.map(([id, l]) => chip(l, focus.has(id), "toggleFocus", id)).join("")}</div>`)}
      ${card("Appearance", `<div class="label-l">Theme</div><div class="chips wrap" style="margin-top:8px">${[["SYSTEM", "System"], ["LIGHT", "Light"], ["DARK", "Dark"]].map(([id, l]) => chip(l, s.themeMode === id, "setTheme", id)).join("")}</div>`)}
      ${card("Data", `<div class="body-s muted" style="margin:-6px 0 12px">Your history and custom routines are stored only in this browser. Export a backup to move them to another device.</div>
        <div class="row wrap gap8">
          <button class="btn tonal" data-act="exportData">${icon("download", 18)}Export</button>
          <button class="btn tonal" data-act="importData">${icon("upload", 18)}Import</button>
        </div>
        <div class="hr" style="margin:14px 0 8px"></div>
        <button class="btn text danger" style="padding:0" data-act="askClear">Clear All History &amp; Custom Routines</button>`)}
      <div class="body-s muted" style="text-align:center;padding:8px 0 16px">Bendito for the web · photos and voices from the Android app</div>
    </div></div>
    ${u.showClear ? dialog({
      title: "Clear all data?",
      text: "This deletes all logged sessions, streaks, and custom routines and workouts. This cannot be undone.",
      actions: [{ label: "Cancel", act: "cancelClear" }, { label: "Clear Everything", act: "confirmClear", danger: true }],
    }) : ""}
  </div>`;
}

// ---------------------------------------------------------------- Onboarding
export function onboardingScreen(ui) {
  const o = ui.onboarding;
  const focus = new Set(o.focusAreas);
  const pages = [
    `<div class="page" data-key="p0" style="align-items:flex-start">
      <div class="logo">${logoSvg(64)}</div>
      <div class="display-s" style="margin-top:12px">Bendito</div>
      <div class="title-l">Feel lighter in a few minutes a day</div>
      <p class="body-l muted" style="margin:0">Guided daily stretching, posture resets, targeted pain relief, and custom routines — right in your browser, with your progress saved on this device.</p>
    </div>`,
    `<div class="page" data-key="p1">
      <h1 class="headline-m">Where do you feel tight?</h1>
      <p class="body-m muted" style="margin:0 0 8px">We'll highlight routines that target your focus areas.</p>
      <div class="area-grid">${AREAS.map(([id, l]) => chip(l, focus.has(id), "onbFocus", id, "lg")).join("")}</div>
    </div>`,
    `<div class="page" data-key="p2">
      <h1 class="headline-m">Daily stretching goal</h1>
      <p class="body-m muted" style="margin:0 0 8px">Even a few minutes a day adds up. You can change this anytime in Settings.</p>
      <div class="chips wrap">${[3, 5, 10, 15].map((m) => chip(`${m} min`, o.goal === m, "onbGoal", m, "lg")).join("")}</div>
    </div>`,
  ];
  const last = pages.length - 1;
  return `<div class="screen">
    <div class="topbar" style="padding:8px 12px">
      ${o.page > 0 ? `<button class="icon-btn" data-act="onbBack" aria-label="Back">${icon("back")}</button>` : `<span style="width:40px"></span>`}
      <span class="grow"></span>
      ${o.page < last ? `<button class="btn text" data-act="onbFinish">Skip</button>` : ""}
    </div>
    <div class="onb">
      ${pages[o.page]}
      <div class="dots">${pages.map((_, i) => `<i class="${i === o.page ? "on" : ""}"></i>`).join("")}</div>
      <button class="btn lg" data-act="${o.page < last ? "onbNext" : "onbFinish"}">${o.page === 0 ? "Get Started" : o.page < last ? "Continue" : "Start Stretching"}</button>
    </div>
  </div>`;
}

export function logoSvg(size) {
  return `<svg width="${size}" height="${size}" viewBox="26 14 56 76" aria-hidden="true"><circle cx="60" cy="34" r="6" fill="#fff"/><path d="M52 62Q54 50 60 42M52 62L46 80M52 62L58 80M58 46Q66 34 72 26M56 48Q46 44 40 36" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;
}

export const thisMonthKey = () => dayKey(new Date()).slice(0, 7);
export { addDays };
