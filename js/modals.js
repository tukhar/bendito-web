// Full-screen modal views: routine detail, routine builder and the guided player.
import { AREAS, AREA_LABEL, CATEGORIES, areasOf, durationSeconds, stretch, stretches, swatchStyle } from "./content.js";
import { dialog, photoBox, sheet, stretchDetail, stretchRow } from "./components.js";
import { SIDE_LABEL } from "./player.js";
import { esc, formatClock, formatDuration, icon } from "./ui.js";

const has = (hay, needle) => hay.toLowerCase().includes(needle.toLowerCase());

// ---------------------------------------------------------------- Routine detail
export function detailScreen(S, m, routine) {
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
export function builderScreen(S, m) {
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

export function playerScreen(S, m) {
  const c = m.controller;
  const st = c.state;
  if (st.phase === "COMPLETED") return completionView(S, m);
  const step = c.currentStep;
  const upcoming = c.nextStep;
  const waiting = st.phase === "PREPARE" || st.phase === "TRANSITION";
  const phaseLabel = st.isPaused ? "Paused"
    : st.phase === "PREPARE" ? "Get ready"
    : st.phase === "TRANSITION" && st.isSwitchingSides ? "Switch sides"
    : st.phase === "TRANSITION" ? "Up next"
    : null;
  // Like the Android Canvas arc: stroke centred on the ring's outer edge.
  const R = 50;
  const C = 2 * Math.PI * R;
  const offset = C * (1 - c.progressFraction);
  const display = waiting ? step?.durationSec ?? st.remainingSec : st.remainingSec;
  const showPip = st.phase === "ACTIVE" && st.remainingSec <= 10 && upcoming;
  const inspected = st.showInstructions && step;

  return `<div class="screen">
    <div class="player">
      <div class="top">
        <button class="icon-btn" data-act="playerExit" aria-label="Close player">${icon("close")}</button>
        <span class="title-s muted tnum">${c.totalPoses > 0 ? `${c.currentPoseNumber} of ${c.totalPoses}` : esc(st.routineName)}</span>
        <span class="row">
          <button class="icon-btn" data-act="playerMute" aria-label="${m.muted ? "Unmute cues" : "Mute cues"}">${icon(m.muted ? "volumeOff" : "volume")}</button>
          <button class="icon-btn" data-act="playerQueue" aria-label="Routine poses">${icon("list")}</button>
        </span>
      </div>
      <div class="stage" style="--ring:${m.ringSize}px">
        <div class="phase">${phaseLabel ? `<span class="pill label-m">${phaseLabel.toUpperCase()}</span>` : ""}</div>
        <div class="ring-wrap">
          <div class="ring">
            <svg class="arc" viewBox="0 0 100 100" aria-hidden="true">
              <circle class="track" cx="50" cy="50" r="${R}" style="stroke-width:${(10 / m.ringSize) * 100}"/>
              <circle class="prog ${st.phase === "ACTIVE" ? "" : "alt"}" cx="50" cy="50" r="${R}" style="stroke-width:${(10 / m.ringSize) * 100}" stroke-dasharray="${C.toFixed(3)}" stroke-dashoffset="${offset.toFixed(3)}"/>
            </svg>
            ${step ? photoBox(step.stretch.id, { mirror: step.side === "RIGHT", breathe: !st.isPaused, key: `ph-${step.stretch.id}-${step.side}` }) : ""}
          </div>
          ${waiting ? `<div class="count-badge" aria-live="polite">${st.remainingSec}</div>` : ""}
          ${showPip ? `<div class="pip" data-key="pip">${photoBox(upcoming.stretch.id, { mirror: upcoming.side === "RIGHT", key: `pip-${upcoming.stretch.id}-${upcoming.side}` })}<span>${upcoming.itemIndex === step?.itemIndex ? "Switch" : "Up Next"}</span></div>` : ""}
        </div>
        ${step ? `<div class="stretch-name">
            <h1 class="headline-s clamp2">${esc(step.stretch.name)}</h1>
            <button class="icon-btn sm" data-act="playerInfo" aria-label="Stretch instructions">${icon("info", 20)}</button>
          </div>
          ${step.side !== "NONE" ? `<span class="pill side-pill label-m">${SIDE_LABEL[step.side]}</span>` : ""}` : ""}
        <div class="clock" role="timer">${formatClock(display)}</div>
      </div>
      <div class="transport">
        <button class="side-btn" data-act="playerPrev" aria-label="Previous stretch">${icon("prev", 28)}</button>
        <button class="main-btn" data-act="playerPause" aria-label="${st.isPaused ? "Resume" : "Pause"}">${icon(st.isPaused ? "play" : "pause", 38)}</button>
        <button class="side-btn" data-act="playerNext" aria-label="Next stretch">${icon("next", 28)}</button>
      </div>
    </div>
    ${inspected ? sheet(stretchDetail(step.stretch, { practiceAct: null }), { close: "playerInfo", label: step.stretch.name }) : ""}
    ${m.showQueue ? sheet(queueSheet(m), { close: "playerQueue", label: "Routine poses" }) : ""}
    ${m.showExit ? dialog({
      title: "Leave session?",
      text: st.elapsedActiveSec >= 15
        ? `You've stretched for ${formatDuration(st.elapsedActiveSec)}. Save this progress or discard?`
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
    <div class="body-s muted" style="margin:2px 0 12px">Tap any pose to jump there</div>
    <div class="col gap4">${m.items
      .map((it, idx) => {
        const s = stretch(it.stretchId);
        if (!s) return "";
        return `<button class="qrow ${idx === cur ? "cur" : ""}" data-act="playerJump" data-arg="${idx}">
          <span class="n">${idx + 1}</span>${photoBox(s.id)}
          <span class="grow title-s ellipsis">${esc(s.name)}</span>
          <span class="label-m">${s.bilateral ? `2×${it.seconds}s` : `${it.seconds}s`}</span>
        </button>`;
      })
      .join("")}</div>`;
}

function completionView(S, m) {
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
