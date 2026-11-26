// Full-screen modal views: routine detail, routine builder and the guided player.
import {
  AREAS, AREA_LABEL, CATEGORIES, LOAD_BANDS, PLYO_LEVELS, PLYO_LEVEL_LABEL, PLYO_RANGE, areasOf, doseLabel, durationSeconds, isPlyoRoutine,
  loadBand, plyoExercises, plyoLevel, plyoLoad, stretch, stretches, swatchStyle, totalSets,
} from "./content.js";
import { dialog, photoBox, plyoRow, sheet, stretchDetail, stretchRow } from "./components.js";
import { SIDE_LABEL } from "./player.js";
import { esc, formatClock, formatDuration, icon } from "./ui.js";

const has = (hay, needle) => hay.toLowerCase().includes(needle.toLowerCase());

// ---------------------------------------------------------------- Routine detail
/** Time one exercise takes inside a workout: every bout plus the rest after it. */
const blockSeconds = (it, s) => Math.max(1, it.sets ?? 1) * (s.bilateral ? 2 : 1) * (it.seconds + (it.restSeconds ?? 0));

function plyoDetailScreen(S, m, routine) {
  const fav = S.settings.favorites.includes(routine.id);
  const items = m.items;
  const total = durationSeconds(items, S.settings.transitionSeconds);
  const lead = items[0] && stretch(items[0].stretchId);
  const areas = areasOf(items).slice(0, 3);
  const sets = totalSets(items);
  const inspectedItem = m.inspectedIdx != null ? items[m.inspectedIdx] : null;
  const inspected = inspectedItem && stretch(inspectedItem.stretchId);
  const warmUp = S.allRoutines.find((r) => r.id === "pre_workout");

  const rows = items
    .map((it, idx) => {
      const s = stretch(it.stretchId);
      if (!s) return "";
      const trailing = `<span class="label-m muted tnum">${formatClock(blockSeconds(it, s))}</span>`;
      return `<div style="padding:4px 18px" data-key="i-${idx}">${plyoRow(s, { item: it, act: "detailInspect", arg: idx, trailing })}</div>`;
    })
    .join("");

  return `<div class="screen">
    <div class="scroll" data-scroll="detail-${esc(routine.id)}">
      <div class="banner sw" style="${swatchStyle(routine.hue)}">
        <div class="row between">
          <button class="icon-btn" data-act="back" aria-label="Back">${icon("back")}</button>
          <div class="row">
            <button class="icon-btn ${fav ? "on" : ""}" data-act="toggleFavorite" data-arg="${esc(routine.id)}" aria-label="${fav ? "Remove favorite" : "Favorite"}">${icon(fav ? "heartFill" : "heart")}</button>
            ${routine.isCustom
              ? `<button class="icon-btn" data-act="editCustom" aria-label="Edit workout">${icon("edit")}</button>
                 <button class="icon-btn" data-act="askDeleteRoutine" aria-label="Delete workout">${icon("trash")}</button>`
              : `<button class="icon-btn" data-act="duplicateRoutine" aria-label="Duplicate &amp; Edit">${icon("copy")}</button>`}
          </div>
        </div>
        <div class="row gap12" style="padding:8px">
          <div class="grow">
            <div class="label-s cat">PLYO · ${PLYO_LEVEL_LABEL[plyoLevel(items)].toUpperCase()}</div>
            <h1 class="headline-m" style="margin-top:4px">${esc(routine.name)}</h1>
            <div class="body-m" style="opacity:.8;margin-top:4px">${esc(routine.subtitle)}</div>
            <div class="title-s tnum" style="margin-top:10px">${formatDuration(total)} · ${sets} set${sets === 1 ? "" : "s"} · load ${plyoLoad(items)}</div>
          </div>
          ${lead ? photoBox(lead.id, { animate: true, key: `lead-${lead.id}` }) : ""}
        </div>
        <div class="row wrap" style="gap:6px 8px;padding:12px 8px 4px">
          ${areas.map((a) => `<span class="pill area label-s">${esc(AREA_LABEL[a])}</span>`).join("")}
          ${routine.isCustom ? "" : `<button class="pill dup label-s" data-act="duplicateRoutine">Duplicate &amp; Edit</button>`}
        </div>
      </div>
      ${warmUp ? `<button class="warm" data-act="openRoutine" data-arg="pre_workout">${icon("leaf", 20)}<span class="grow"><span class="title-s" style="display:block">Warm up first</span><span class="body-s" style="display:block;opacity:.8">Easy jog, or the ${formatDuration(durationSeconds(warmUp.items, S.settings.transitionSeconds))} ${esc(warmUp.name)} routine</span></span>${icon("chevRight", 18)}</button>` : ""}
      <h2 class="title-m" style="padding:16px 18px 6px">Exercises</h2>
      ${rows}
      <div style="height:24px"></div>
    </div>
    <div class="bottombar"><button class="btn lg" data-act="startDetail">${icon("play", 20)}Start Workout · ${formatDuration(total)}</button></div>
    ${inspected ? sheet(stretchDetail(inspected, { item: inspectedItem, practiceLabel: "Start Workout from Here", practiceAct: "startDetailFrom", practiceArg: m.inspectedIdx }), { close: "detailCloseSheet", label: inspected.name }) : ""}
    ${m.showDelete ? dialog({
      title: "Delete workout?",
      text: `This will permanently remove "${routine.name}" from My Workouts.`,
      actions: [{ label: "Cancel", act: "cancelDeleteRoutine" }, { label: "Delete", act: "confirmDeleteRoutine", danger: true }],
    }) : ""}
  </div>`;
}

export function detailScreen(S, m, routine) {
  if (isPlyoRoutine(routine)) return plyoDetailScreen(S, m, routine);
  const fav = S.settings.favorites.includes(routine.id);
  const items = m.items;
  const total = durationSeconds(items, S.settings.transitionSeconds);
  const lead = items[0] && stretch(items[0].stretchId);
  const areas = areasOf(items).slice(0, 4);
  const inspected = m.inspectedIdx != null && items[m.inspectedIdx] && stretch(items[m.inspectedIdx].stretchId);

  const rows = items
    .map((it, idx) => {
      const s = stretch(it.stretchId);
      if (!s) return "";
      const trailing = `<div class="stepper" data-stop>
        <button class="icon-btn sm" data-act="detailSec" data-arg="${idx}:-5" aria-label="Decrease duration">${icon("minus", 18)}</button>
        <span class="val tnum">${s.bilateral ? `2×${it.seconds}s` : `${it.seconds}s`}</span>
        <button class="icon-btn sm" data-act="detailSec" data-arg="${idx}:5" aria-label="Increase duration">${icon("plus", 18)}</button>
      </div>`;
      return `<div style="padding:5px 18px" data-key="i-${idx}">${stretchRow(s, { seconds: it.seconds, act: "detailInspect", arg: idx, trailing })}</div>`;
    })
    .join("");

  return `<div class="screen">
    <div class="scroll" data-scroll="detail-${esc(routine.id)}">
      <div class="banner sw" style="${swatchStyle(routine.hue)}">
        <div class="row between">
          <button class="icon-btn" data-act="back" aria-label="Back">${icon("back")}</button>
          <div class="row">
            <button class="icon-btn ${fav ? "on" : ""}" data-act="toggleFavorite" data-arg="${esc(routine.id)}" aria-label="${fav ? "Remove favorite" : "Favorite"}">${icon(fav ? "heartFill" : "heart")}</button>
            ${routine.isCustom
              ? `<button class="icon-btn" data-act="editCustom" aria-label="Edit routine">${icon("edit")}</button>
                 <button class="icon-btn" data-act="askDeleteRoutine" aria-label="Delete routine">${icon("trash")}</button>`
              : `<button class="icon-btn" data-act="duplicateRoutine" aria-label="Duplicate &amp; Edit">${icon("copy")}</button>`}
          </div>
        </div>
        <div class="row gap12" style="padding:8px">
          <div class="grow">
            <div class="label-s cat">${CATEGORIES[routine.category].label.toUpperCase()}</div>
            <h1 class="headline-m" style="margin-top:4px">${esc(routine.name)}</h1>
            <div class="body-m" style="opacity:.8;margin-top:4px">${esc(routine.subtitle)}</div>
            <div class="title-s" style="margin-top:10px">${formatDuration(total)} · ${items.length} stretches</div>
          </div>
          ${lead ? photoBox(lead.id, { breathe: true, key: `lead-${lead.id}` }) : ""}
        </div>
        ${areas.length ? `<div class="row wrap" style="gap:6px 8px;padding:12px 8px 4px">
          ${areas.map((a) => `<span class="pill area label-s">${esc(AREA_LABEL[a])}</span>`).join("")}
          ${routine.isCustom ? "" : `<button class="pill dup label-s" data-act="duplicateRoutine">Duplicate &amp; Edit</button>`}
        </div>` : ""}
      </div>
      <h2 class="title-m" style="padding:16px 18px 6px">Stretches in this routine</h2>
      ${rows}
      <div style="height:24px"></div>
    </div>
    <div class="bottombar"><button class="btn lg" data-act="startDetail">${icon("play", 20)}Start Routine · ${formatDuration(total)}</button></div>
    ${inspected ? sheet(stretchDetail(inspected, { practiceLabel: "Start Routine from Here", practiceAct: "startDetailFrom", practiceArg: m.inspectedIdx }), { close: "detailCloseSheet", label: inspected.name }) : ""}
    ${m.showDelete ? dialog({
      title: "Delete routine?",
      text: `This will permanently remove "${routine.name}" from My Routines.`,
      actions: [{ label: "Cancel", act: "cancelDeleteRoutine" }, { label: "Delete", act: "confirmDeleteRoutine", danger: true }],
    }) : ""}
  </div>`;
}

// ---------------------------------------------------------------- Routine builder
const LOAD_SCALE = 260; // right edge of the load meter
const BAND_COLOR = { LIGHT: "var(--secondary)", MODERATE: "var(--secondary)", HIGH: "var(--warn)", TOO_MUCH: "var(--error)" };

function loadMeter(items, total) {
  const load = plyoLoad(items);
  const band = loadBand(load);
  const n = items.length;
  // Zone widths follow the band thresholds (80 / 140 / 200) on the 0..260 scale.
  return `<div class="card meter" data-key="meter">
    <div class="row between"><span class="title-s tnum">${n} exercise${n === 1 ? "" : "s"} · ${formatDuration(total)} · load ${load}</span><span class="label-m" style="color:${BAND_COLOR[band.id]}">${band.label}</span></div>
    <div class="zones" role="img" aria-label="Load ${load}: ${band.label}">${LOAD_BANDS.map((b) => `<i class="z-${b.id} ${b.id === band.id ? "lit" : ""}"></i>`).join("")}<b style="left:${Math.min(100, (load / LOAD_SCALE) * 100)}%"></b></div>
    <div class="zlabels">${LOAD_BANDS.map((b) => `<span>${b.label}</span>`).join("")}</div>
    <div class="body-s muted">${band.advice}</div>
  </div>`;
}

const plyoStepper = (idx, field, label, text, value) => {
  const [min, max] = PLYO_RANGE[field];
  return `<div class="stp"><small>${label}</small><div>
    <button class="icon-btn sm" data-act="bPlyoStep" data-arg="${idx}:${field}:-1" aria-label="Less ${label.toLowerCase()}" ${value <= min ? "disabled" : ""}>${icon("minus", 14)}</button>
    <b class="tnum">${text}</b>
    <button class="icon-btn sm" data-act="bPlyoStep" data-arg="${idx}:${field}:1" aria-label="More ${label.toLowerCase()}" ${value >= max ? "disabled" : ""}>${icon("plus", 14)}</button>
  </div></div>`;
};

function plyoBuilderScreen(S, m) {
  const total = durationSeconds(m.items, S.settings.transitionSeconds);
  const title = m.editingId ? "Edit Workout" : m.isDuplicate ? "Duplicate Workout" : "New Plyo Workout";
  const rows = m.items
    .map((it, idx) => {
      const s = stretch(it.stretchId);
      if (!s) return "";
      const last = idx === m.items.length - 1;
      return `<div class="card brow" data-key="b-${it.key}">
        <div class="row gap10">
          ${photoBox(s.id, { style: "width:44px;height:44px;border-radius:12px;flex:none" })}
          <div class="grow"><div class="title-s ellipsis">${esc(s.name)}</div>${s.bilateral ? `<div class="body-s muted">Each side</div>` : ""}</div>
          <button class="icon-btn sm" data-act="bMove" data-arg="${idx}:-1" aria-label="Move up" ${idx === 0 ? "disabled" : ""}>${icon("up", 18)}</button>
          <button class="icon-btn sm" data-act="bMove" data-arg="${idx}:1" aria-label="Move down" ${last ? "disabled" : ""}>${icon("down", 18)}</button>
          <button class="icon-btn sm" data-act="bRemove" data-arg="${idx}" aria-label="Remove">${icon("close", 18)}</button>
        </div>
        <div class="steps">
          ${plyoStepper(idx, "sets", "Sets", `${it.sets}`, it.sets)}
          ${plyoStepper(idx, "seconds", "Work", `${it.seconds} s`, it.seconds)}
          ${plyoStepper(idx, "restSeconds", "Rest", `${it.restSeconds} s`, it.restSeconds)}
        </div>
      </div>`;
    })
    .join("");

  let addSheet = "";
  if (m.showAdd) {
    const q = m.addQuery.trim();
    const counts = new Map();
    m.items.forEach((it) => counts.set(it.stretchId, (counts.get(it.stretchId) || 0) + 1));
    const list = plyoExercises
      .filter((s) => (!m.addLevel || s.difficulty === m.addLevel) && (!q || has(s.name, q) || has(AREA_LABEL[s.area], q)))
      .map((s) => {
        const n = counts.get(s.id) || 0;
        const trailing = `<span class="icon-btn tonal" style="position:relative">${icon("plus")}${n ? `<span class="label-s" style="position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;border-radius:9px;background:var(--primary);color:var(--on-primary);display:flex;align-items:center;justify-content:center;padding:0 4px">${n}</span>` : ""}</span>`;
        return plyoRow(s, { act: "bAdd", arg: s.id, trailing, key: `a-${s.id}` });
      })
      .join("");
    addSheet = sheet(`
      <div class="row between" style="margin-bottom:10px"><h2 class="title-l">Add Exercises</h2><button class="btn text" data-act="bCloseAdd">Done</button></div>
      <label class="field" data-key="asearch">${icon("search")}<input type="search" data-input="addQuery" placeholder="Search exercises..." value="${esc(m.addQuery)}" autocomplete="off" aria-label="Search exercises"></label>
      <div class="chips" style="margin:12px -20px;padding:0 20px">${[["", "All levels"], ...PLYO_LEVELS].map(([id, l]) => `<button class="chip" aria-pressed="${(m.addLevel || "") === id}" data-act="bAddLevel" data-arg="${id}">${esc(l)}</button>`).join("")}</div>
      <div class="col gap8">${list || `<div class="body-m muted empty">No matching exercises</div>`}</div>
    `, { close: "bCloseAdd", label: "Add exercises" });
  }

  return `<div class="screen">
    <div class="topbar">
      <button class="icon-btn" data-act="back" aria-label="Back">${icon("back")}</button>
      <h1 class="title-l grow" style="margin-left:4px">${title}</h1>
      <button class="btn text" data-act="bSave" style="font-size:16px">Save</button>
    </div>
    <div class="scroll"><div class="pad stack" style="padding-top:4px;gap:10px">
      <div><div class="field-label">Workout name</div>
        <label class="field"><input type="text" data-input="bName" placeholder="e.g. Tuesday Springs" value="${esc(m.name)}" maxlength="60" aria-label="Workout name"></label></div>
      ${loadMeter(m.items, total)}
      ${m.error ? `<div class="body-m" style="color:var(--error)">${esc(m.error)}</div>` : ""}
      ${rows || `<div class="card empty"><div class="title-m">No exercises added yet</div><div class="body-m muted" style="margin-top:6px">Tap Add Exercises below to pick jumps and hops.</div></div>`}
    </div></div>
    <div class="bottombar row gap10">
      <button class="btn lg tonal" style="flex:1" data-act="bOpenAdd">${icon("plus", 20)}Add Exercises</button>
      <button class="btn lg" style="flex:1" data-act="bSave">Save Workout</button>
    </div>
    ${addSheet}
  </div>`;
}

export function builderScreen(S, m) {
  if (m.plyo) return plyoBuilderScreen(S, m);
  const total = durationSeconds(m.items, S.settings.transitionSeconds);
  const title = m.editingId ? "Edit Routine" : m.isDuplicate ? "Duplicate Routine" : "New Routine";
  const rows = m.items
    .map((it, idx) => {
      const s = stretch(it.stretchId);
      if (!s) return "";
      const last = idx === m.items.length - 1;
      return `<div class="card row gap10" data-key="b-${it.key}" style="padding:10px 8px 10px 10px;border-radius:16px">
        ${photoBox(s.id, { style: "width:48px;height:48px;border-radius:12px;flex:none" })}
        <div class="grow">
          <div class="title-s ellipsis">${esc(s.name)}</div>
          <div class="row gap4" style="margin-top:2px">
            <button class="icon-btn sm" data-act="bSec" data-arg="${idx}:-5" aria-label="Less time">${icon("minus", 16)}</button>
            <span class="label-m accent tnum" style="min-width:58px;text-align:center">${s.bilateral ? `${it.seconds}s / side` : `${it.seconds}s`}</span>
            <button class="icon-btn sm" data-act="bSec" data-arg="${idx}:5" aria-label="More time">${icon("plus", 16)}</button>
          </div>
        </div>
        <button class="icon-btn sm" data-act="bMove" data-arg="${idx}:-1" aria-label="Move up" ${idx === 0 ? "disabled" : ""}>${icon("up", 18)}</button>
        <button class="icon-btn sm" data-act="bMove" data-arg="${idx}:1" aria-label="Move down" ${last ? "disabled" : ""}>${icon("down", 18)}</button>
        <button class="icon-btn sm" data-act="bRemove" data-arg="${idx}" aria-label="Remove">${icon("close", 18)}</button>
      </div>`;
    })
    .join("");

  let addSheet = "";
  if (m.showAdd) {
    const q = m.addQuery.trim();
    const counts = new Map();
    m.items.forEach((it) => counts.set(it.stretchId, (counts.get(it.stretchId) || 0) + 1));
    const list = stretches
      .filter((s) => (!m.addArea || s.allAreas.has(m.addArea)) && (!q || has(s.name, q) || has(AREA_LABEL[s.area], q)))
      .map((s) => {
        const n = counts.get(s.id) || 0;
        const trailing = `<span class="icon-btn tonal" style="position:relative">${icon("plus")}${n ? `<span class="label-s" style="position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;border-radius:9px;background:var(--primary);color:var(--on-primary);display:flex;align-items:center;justify-content:center;padding:0 4px">${n}</span>` : ""}</span>`;
        return stretchRow(s, { act: "bAdd", arg: s.id, trailing, key: `a-${s.id}` });
      })
      .join("");
    addSheet = sheet(`
      <div class="row between" style="margin-bottom:10px"><h2 class="title-l">Add Stretches</h2><button class="btn text" data-act="bCloseAdd">Done</button></div>
      <label class="field" data-key="asearch">${icon("search")}<input type="search" data-input="addQuery" placeholder="Search stretches..." value="${esc(m.addQuery)}" autocomplete="off" aria-label="Search stretches"></label>
      <div class="chips" style="margin:12px -20px;padding:0 20px">${[["", "All"], ...AREAS].map(([id, l]) => `<button class="chip" aria-pressed="${(m.addArea || "") === id}" data-act="bAddArea" data-arg="${id}">${esc(l)}</button>`).join("")}</div>
      <div class="col gap8">${list || `<div class="body-m muted empty">No matching stretches</div>`}</div>
    `, { close: "bCloseAdd", label: "Add stretches" });
  }

  return `<div class="screen">
    <div class="topbar">
      <button class="icon-btn" data-act="back" aria-label="Back">${icon("back")}</button>
      <h1 class="title-l grow" style="margin-left:4px">${title}</h1>
      <button class="btn text" data-act="bSave" style="font-size:16px">Save</button>
    </div>
    <div class="scroll"><div class="pad stack" style="padding-top:4px">
      <div><div class="field-label">Routine name</div>
        <label class="field"><input type="text" data-input="bName" placeholder="e.g. Morning Spine Reset" value="${esc(m.name)}" maxlength="60" aria-label="Routine name"></label></div>
      <div class="label-l muted">${m.items.length} stretches · ${formatDuration(total)}</div>
      ${m.error ? `<div class="body-m" style="color:var(--error)">${esc(m.error)}</div>` : ""}
      ${rows || `<div class="card empty"><div class="title-m">No stretches added yet</div><div class="body-m muted" style="margin-top:6px">Tap Add Stretches below to pick poses from the library.</div></div>`}
    </div></div>
    <div class="bottombar row gap10">
      <button class="btn lg tonal" style="flex:1" data-act="bOpenAdd">${icon("plus", 20)}Add Stretches</button>
      <button class="btn lg" style="flex:1" data-act="bSave">Save Routine</button>
    </div>
    ${addSheet}
  </div>`;
}

// ---------------------------------------------------------------- Player
const FEELINGS = [[1, "😖", "Tense"], [2, "😕", "Tight"], [3, "🙂", "Okay"], [4, "😌", "Loose"], [5, "🤩", "Great"]];
const LEG_FEELINGS = [[1, "🥵", "Heavy"], [2, "😮‍💨", "Tired"], [3, "🙂", "Okay"], [4, "😀", "Springy"], [5, "🤩", "Bouncy"]];

export function playerScreen(S, m) {
  const c = m.controller;
  const st = c.state;
  if (st.phase === "COMPLETED") return completionView(S, m);
  const step = c.currentStep;
  const upcoming = c.nextStep;
  const waiting = st.phase === "PREPARE" || st.phase === "TRANSITION";
  // Rest between plyometric sets: currentStep is already the set (or exercise) that comes next.
  const resting = st.phase === "TRANSITION" && st.isRest;
  const plyoStep = !!step?.isPlyo;
  const phaseLabel = st.isPaused ? "Paused"
    : st.phase === "PREPARE" ? "Get ready"
    : resting ? "Rest"
    : st.phase === "TRANSITION" && st.isSwitchingSides ? "Switch sides"
    : st.phase === "TRANSITION" ? "Up next"
    : null;
  // Like the Android Canvas arc: stroke centred on the ring's outer edge.
  const R = 50;
  const C = 2 * Math.PI * R;
  const offset = C * (1 - c.progressFraction);
  const display = waiting && !resting ? step?.durationSec ?? st.remainingSec : st.remainingSec;
  const showPip = st.phase === "ACTIVE" && st.remainingSec <= 10 && upcoming && !plyoStep;
  const inspected = st.showInstructions && step;

  // Plyo: set dots and one line under them (the coaching cue while working, what's next while resting).
  let plyoInfo = "";
  if (plyoStep) {
    const prev = st.steps[st.currentIndex - 1];
    const newExercise = resting && (!prev || prev.itemIndex !== step.itemIndex);
    // The upcoming step's set number is one past the sets already finished, also across a side switch.
    const dots = Array.from({ length: step.setCount }, (_, n) =>
      `<i class="${n < step.set - 1 ? "d" : !resting && n === step.set - 1 ? "c" : ""}"></i>`).join("");
    const setLabel = resting ? (newExercise ? `${step.setCount} set${step.setCount === 1 ? "" : "s"}` : "Rest") : `Set ${step.set} of ${step.setCount}`;
    const line = resting
      ? newExercise ? `Up next: ${esc(step.stretch.name)}`
        : prev && prev.side !== step.side && prev.set === step.set ? `Next: ${SIDE_LABEL[step.side].toLowerCase()}`
        : `Next: set ${step.set} of ${step.setCount}`
      : esc(step.stretch.plyo.cue);
    plyoInfo = `<div class="sets" aria-label="${resting ? "Resting" : `Set ${step.set} of ${step.setCount}`}">${dots}<span class="label-m muted">${setLabel}</span></div>
      <div class="cue body-m muted">${line}</div>`;
  }

  return `<div class="screen">
    <div class="player">
      <div class="top">
        <button class="icon-btn" data-act="playerExit" aria-label="Close player">${icon("close")}</button>
        <span class="title-s muted tnum">${c.totalPoses > 0 ? `${c.currentPoseNumber} of ${c.totalPoses}` : esc(st.routineName)}</span>
        <span class="row">
          <button class="icon-btn" data-act="playerMute" aria-label="${m.muted ? "Unmute cues" : "Mute cues"}">${icon(m.muted ? "volumeOff" : "volume")}</button>
          <button class="icon-btn" data-act="playerQueue" aria-label="${m.plyo ? "Workout exercises" : "Routine poses"}">${icon("list")}</button>
        </span>
      </div>
      <div class="stage" style="--ring:${m.ringSize}px">
        <div class="phase">${phaseLabel ? `<span class="pill label-m ${resting && !st.isPaused ? "rest" : ""}">${phaseLabel.toUpperCase()}</span>` : ""}</div>
        <div class="ring-wrap">
          <div class="ring">
            <svg class="arc" viewBox="0 0 100 100" aria-hidden="true">
              <circle class="track" cx="50" cy="50" r="${R}" style="stroke-width:${(10 / m.ringSize) * 100}"/>
              <circle class="prog ${st.phase === "ACTIVE" ? "" : "alt"}" cx="50" cy="50" r="${R}" style="stroke-width:${(10 / m.ringSize) * 100}" stroke-dasharray="${C.toFixed(3)}" stroke-dashoffset="${offset.toFixed(3)}"/>
            </svg>
            ${step ? photoBox(step.stretch.id, { mirror: step.side === "RIGHT", breathe: !st.isPaused, animate: plyoStep || !st.isPaused, hold: resting || st.phase === "PREPARE" ? "rest" : st.isPaused ? "pause" : "", dim: resting, key: `ph-${step.stretch.id}-${step.side}` }) : ""}
          </div>
          ${waiting && !resting ? `<div class="count-badge" aria-live="polite">${st.remainingSec}</div>` : ""}
          ${showPip ? `<div class="pip" data-key="pip">${photoBox(upcoming.stretch.id, { mirror: upcoming.side === "RIGHT", key: `pip-${upcoming.stretch.id}-${upcoming.side}` })}<span>${upcoming.itemIndex === step?.itemIndex ? "Switch" : "Up Next"}</span></div>` : ""}
        </div>
        ${step ? `<div class="stretch-name">
            <h1 class="headline-s clamp2">${esc(step.stretch.name)}</h1>
            <button class="icon-btn sm" data-act="playerInfo" aria-label="${plyoStep ? "Exercise" : "Stretch"} instructions">${icon("info", 20)}</button>
          </div>
          ${step.side !== "NONE" ? `<span class="pill side-pill label-m">${SIDE_LABEL[step.side]}</span>` : ""}
          ${plyoInfo}` : ""}
        <div class="clock" role="timer">${formatClock(display)}</div>
      </div>
      <div class="transport">
        <button class="side-btn" data-act="playerPrev" aria-label="Previous ${plyoStep ? "set" : "stretch"}">${icon("prev", 28)}</button>
        <button class="main-btn" data-act="playerPause" aria-label="${st.isPaused ? "Resume" : "Pause"}">${icon(st.isPaused ? "play" : "pause", 38)}</button>
        <button class="side-btn" data-act="playerNext" aria-label="Next ${plyoStep ? "set" : "stretch"}">${icon("next", 28)}</button>
      </div>
    </div>
    ${inspected ? sheet(stretchDetail(step.stretch, { practiceAct: null, item: m.items[step.itemIndex] }), { close: "playerInfo", label: step.stretch.name }) : ""}
    ${m.showQueue ? sheet(queueSheet(m), { close: "playerQueue", label: m.plyo ? "Workout exercises" : "Routine poses" }) : ""}
    ${m.showExit ? dialog({
      title: "Leave session?",
      text: st.elapsedActiveSec >= 15
        ? `You've ${m.plyo ? "trained" : "stretched"} for ${formatDuration(st.elapsedActiveSec)}. Save this progress or discard?`
        : "Your session is still in progress.",
      actions: st.elapsedActiveSec >= 15
        ? [{ label: "Discard", act: "playerDiscard", danger: true }, { label: "Keep Going", act: "playerKeepGoing" }, { label: "Save & Exit", act: "playerSaveExit" }]
        : [{ label: "Keep Going", act: "playerKeepGoing" }, { label: "Discard & Exit", act: "playerDiscard", danger: true }],
    }) : ""}
  </div>`;
}

function queueSheet(m) {
  const c = m.controller;
  const cur = c.currentStep?.itemIndex;
  return `<h2 class="title-l">${esc(c.state.routineName)}</h2>
    <div class="body-s muted" style="margin:2px 0 12px">Tap any ${m.plyo ? "exercise" : "pose"} to jump there</div>
    <div class="col gap4">${m.items
      .map((it, idx) => {
        const s = stretch(it.stretchId);
        if (!s) return "";
        return `<button class="qrow ${idx === cur ? "cur" : ""}" data-act="playerJump" data-arg="${idx}">
          <span class="n">${idx + 1}</span>${photoBox(s.id)}
          <span class="grow title-s ellipsis">${esc(s.name)}</span>
          <span class="label-m tnum">${s.plyo ? doseLabel(it, s) : s.bilateral ? `2×${it.seconds}s` : `${it.seconds}s`}</span>
        </button>`;
      })
      .join("")}</div>`;
}

function plyoCompletionView(S, m) {
  const st = m.controller.state;
  const week = S.plyoWeek;
  const n = week.sessionsThisWeek;
  return `<div class="screen"><div class="done">
    <div class="burst">${icon("check", 52)}</div>
    <h1 class="headline-m">Workout Complete!</h1>
    <div class="body-l muted" style="margin-top:4px">${esc(st.routineName)}</div>
    <div class="tiles">
      <div><div class="title-l tnum">${formatDuration(Math.max(st.elapsedActiveSec, 1))}</div><div class="label-m muted">Time</div></div>
      <div><div class="title-l tnum">${st.completedSteps}</div><div class="label-m muted">Sets</div></div>
      <div><div class="title-l tnum">${plyoLoad(m.items)}</div><div class="label-m muted">Load</div></div>
    </div>
    <h2 class="title-m">How do your legs feel?</h2>
    <div class="feel" style="margin-bottom:14px">${LEG_FEELINGS.map(([v, e, l]) => `<button aria-pressed="${st.feeling === v}" data-act="playerFeeling" data-arg="${v}"><span class="emoji">${e}</span><span class="label-s">${l}</span></button>`).join("")}</div>
    <div class="body-s muted" style="margin-bottom:22px">${n} plyo session${n === 1 ? "" : "s"} this week. Leave 48 hours before the next one.</div>
    <button class="btn lg" style="max-width:360px" data-act="playerDone">Done</button>
  </div></div>`;
}

function completionView(S, m) {
  if (m.plyo) return plyoCompletionView(S, m);
  const st = m.controller.state;
  const streak = Math.max(S.stats.currentStreak, 1);
  return `<div class="screen"><div class="done">
    <div class="burst">${icon("check", 52)}</div>
    <h1 class="headline-m">Session Complete!</h1>
    <div class="body-l muted" style="margin-top:4px">${esc(st.routineName)}</div>
    <div class="tiles">
      <div><div class="title-l tnum">${formatDuration(Math.max(st.elapsedActiveSec, 1))}</div><div class="label-m muted">Time</div></div>
      <div><div class="title-l tnum">${st.completedSteps}</div><div class="label-m muted">Poses</div></div>
      <div><div class="title-l tnum">${streak} d</div><div class="label-m muted">Streak</div></div>
    </div>
    <h2 class="title-m">How do you feel?</h2>
    <div class="feel">${FEELINGS.map(([v, e, l]) => `<button aria-pressed="${st.feeling === v}" data-act="playerFeeling" data-arg="${v}"><span class="emoji">${e}</span><span class="label-s">${l}</span></button>`).join("")}</div>
    <button class="btn lg" style="max-width:360px" data-act="playerDone">Done</button>
  </div></div>`;
}
