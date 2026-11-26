// Reusable view fragments (HTML strings). Interactions are wired by data-act
// attributes that app.js dispatches.
import {
  AREA_LABEL, IMPACT_LABEL, KIND_LABEL, PLYO_LEVEL_LABEL, defaultItem, doseLabel, durationSeconds, isPlyoRoutine, levelLabel,
  photo, plyoLevel, stretch, swatchStyle,
} from "./content.js";
import { figureSvg, reducedMotion } from "./figure.js";
import { esc, formatDuration, icon } from "./ui.js";

/**
 * The stick figure a plyometric exercise shows wherever a stretch shows its photo. `animate`
 * loops the keyframes; `hold` ("pause" freezes mid-move, "rest" stands still) stops the loop.
 */
export function figureBox(s, { cls = "", mirror = false, animate = false, hold = "", dim = false, style = "", key = "" } = {}) {
  const live = animate && !reducedMotion();
  const attrs = [
    `data-fig="${esc(s.id)}"`,
    mirror ? 'data-mirror="1"' : "",
    live ? "data-anim data-keep" : "",
    live && hold ? `data-hold="${hold}"` : "",
    key ? `data-key="${esc(key)}"` : "",
  ].filter(Boolean).join(" ");
  return `<div class="photo fig ${dim ? "dim" : ""} ${cls}" style="${style}" ${attrs}>${figureSvg(s, s.plyo.thumbAt, mirror)}</div>`;
}

export function photoBox(stretchId, { cls = "", mirror = false, breathe = false, animate = breathe, hold = "", dim = false, style = "", key = "" } = {}) {
  const s = stretch(stretchId);
  if (s?.plyo) return figureBox(s, { cls, mirror, animate, hold, dim, style, key });
  return `<div class="photo ${mirror ? "mirror" : ""} ${breathe ? "breathe" : ""} ${cls}" style="${style}"${key ? ` data-key="${esc(key)}"` : ""}><img src="${photo(stretchId)}" alt="" loading="lazy" decoding="async" draggable="false"></div>`;
}

export function heroCard(routine, { transitionSeconds, isFavorite }) {
  const lead = routine.items[0] && stretch(routine.items[0].stretchId);
  const total = durationSeconds(routine.items, transitionSeconds);
  return `<div class="hero sw" style="${swatchStyle(routine.hue)}" data-act="openRoutine" data-arg="${esc(routine.id)}" role="button" tabindex="0">
    <div class="grow col">
      <div><span class="tag label-s">RECOMMENDED FOR YOU</span></div>
      <h2 class="headline-s clamp2" style="margin-top:10px">${esc(routine.name)}</h2>
      <div class="body-m sub clamp2" style="margin-top:4px">${esc(routine.subtitle)}</div>
      <div class="label-m meta" style="margin-top:10px">${formatDuration(total)} · ${routine.items.length} stretches</div>
      <div class="row gap8" style="margin-top:14px">
        <button class="btn" data-act="startRoutine" data-arg="${esc(routine.id)}">${icon("play", 18)}Start</button>
        <button class="icon-btn fav ${isFavorite ? "on" : ""}" data-act="toggleFavorite" data-arg="${esc(routine.id)}" aria-label="${isFavorite ? "Remove from favorites" : "Add to favorites"}">${icon(isFavorite ? "heartFill" : "heart")}</button>
      </div>
    </div>
    ${lead ? photoBox(lead.id, { breathe: true }) : ""}
  </div>`;
}

export function routineCard(routine, { transitionSeconds, isFavorite }) {
  const lead = routine.items[0] && stretch(routine.items[0].stretchId);
  const total = durationSeconds(routine.items, transitionSeconds);
  const n = routine.items.length;
  const meta = isPlyoRoutine(routine)
    ? `${PLYO_LEVEL_LABEL[plyoLevel(routine.items)]} · ${formatDuration(total)} · ${n} move${n === 1 ? "" : "s"}`
    : `${formatDuration(total)} · ${n} poses`;
  return `<div class="card rcard sw" style="${swatchStyle(routine.hue)}" data-key="r-${esc(routine.id)}" data-act="openRoutine" data-arg="${esc(routine.id)}" role="button" tabindex="0">
    ${lead ? photoBox(lead.id, { cls: "thumb" }) : `<div class="thumb"></div>`}
    <div class="grow">
      <div class="title-m ellipsis">${esc(routine.name)}</div>
      <div class="body-s muted ellipsis" style="margin-top:2px">${esc(routine.subtitle)}</div>
      <div class="label-m meta" style="margin-top:6px">${meta}</div>
    </div>
    <button class="icon-btn ${isFavorite ? "on" : ""}" data-act="toggleFavorite" data-arg="${esc(routine.id)}" aria-label="${isFavorite ? "Remove favorite" : "Favorite"}">${icon(isFavorite ? "heartFill" : "heart")}</button>
    <button class="icon-btn tonal" data-act="startRoutine" data-arg="${esc(routine.id)}" aria-label="Start ${esc(routine.name)}">${icon("play")}</button>
  </div>`;
}

export function stretchRow(s, { seconds = s.defaultSeconds, act = "inspectStretch", arg = s.id, trailing = "", key = "", item = null } = {}) {
  if (s.plyo) return plyoRow(s, { item: item || defaultItem(s), act, arg, trailing, key });
  return `<div class="srow" ${key ? `data-key="${esc(key)}"` : ""} data-act="${act}" data-arg="${esc(arg)}" role="button" tabindex="0">
    ${photoBox(s.id)}
    <div class="grow">
      <div class="title-s ellipsis">${esc(s.name)}</div>
      <div class="row gap6" style="margin-top:2px">
        <span class="body-s muted">${esc(AREA_LABEL[s.area])}</span><span class="body-s muted">·</span>
        <span class="label-m accent">${s.bilateral ? `${seconds}s / side` : `${seconds}s`}</span>
      </div>
    </div>
    ${trailing}
  </div>`;
}

/** A plyometric exercise in a list: "3 × 15 s · rest 30 s" in place of a hold time. */
export function plyoRow(s, { item = defaultItem(s), act = "inspectStretch", arg = s.id, trailing = "", key = "" } = {}) {
  return `<div class="srow" ${key ? `data-key="${esc(key)}"` : ""} data-act="${act}" data-arg="${esc(arg)}" role="button" tabindex="0">
    ${figureBox(s)}
    <div class="grow">
      <div class="title-s ellipsis">${esc(s.name)}</div>
      <div class="body-s ellipsis" style="margin-top:2px"><span class="label-m accent tnum">${doseLabel(item, s)}</span> <span class="muted">· rest ${item.restSeconds} s</span></div>
    </div>
    ${trailing}
  </div>`;
}

export function sheet(inner, { close = "closeSheet", label = "" } = {}) {
  return `<div class="overlay" data-key="sheet" role="dialog" aria-modal="true" aria-label="${esc(label)}">
    <div class="scrim" data-act="${close}"></div>
    <div class="sheet"><div class="handle"></div><div class="body">${inner}</div></div>
  </div>`;
}

export function dialog({ title, text, actions }) {
  return `<div class="overlay dialog" data-key="dialog" role="alertdialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="scrim"></div>
    <div class="box">
      <h2 class="headline-s">${esc(title)}</h2>
      <p class="body-m muted" style="margin:16px 0 0">${esc(text)}</p>
      <div class="actions">${actions
        .map((a) => `<button class="btn text ${a.danger ? "danger" : ""}" data-act="${a.act}" data-arg="${esc(a.arg ?? "")}">${esc(a.label)}</button>`)
        .join("")}</div>
    </div>
  </div>`;
}

export function stretchDetail(s, { practiceLabel = s.plyo ? "Practice This Exercise" : "Practice This Stretch", practiceAct = "practiceStretch", practiceArg = s.id, item = null } = {}) {
  const pill = (t, ic = "") => `<span class="pill info-pill">${ic ? icon(ic, 14) : ""}${esc(t)}</span>`;
  const pills = [AREA_LABEL[s.area], levelLabel(s), KIND_LABEL[s.kind]].map((t) => pill(t));
  if (s.plyo) {
    const it = item || defaultItem(s);
    pills.push(pill(doseLabel(it, s), "clock"), pill(`Rest ${it.restSeconds} s`), pill(`${IMPACT_LABEL[s.plyo.impact]} impact`));
    if (s.plyo.reps) pills.push(pill(`About ${s.plyo.reps} reps a set`));
    if (s.plyo.needs) pills.push(pill(`Needs: ${s.plyo.needs}`));
  } else {
    pills.push(pill(s.bilateral ? `${s.defaultSeconds}s per side` : `${s.defaultSeconds}s`, "clock"));
  }
  if (s.bilateral) pills.push(pill("Both sides", "swap"));
  return `
    <div class="tile row center" style="height:250px;border-radius:22px">
      ${photoBox(s.id, { breathe: true, style: "width:228px;height:228px;border-radius:18px" })}
    </div>
    <h2 class="headline-s" style="margin-top:16px">${esc(s.name)}</h2>
    <div class="row wrap gap8" style="margin-top:8px">${pills.join("")}</div>
    <p class="body-l" style="margin:14px 0 0">${esc(s.description)}</p>
    ${s.plyo ? `<p class="body-m muted" style="margin:8px 0 0"><strong>Cue:</strong> ${esc(s.plyo.cue)}</p>` : ""}
    <h3 class="title-m" style="margin-top:18px">How to do it</h3>
    <div style="margin-top:8px">${s.steps
      .map((st, i) => `<div class="row gap12" style="align-items:flex-start;padding:5px 0"><span class="step-num">${i + 1}</span><span class="body-m" style="padding-top:2px">${esc(st)}</span></div>`)
      .join("")}</div>
    ${s.benefits.length ? `<h3 class="title-m" style="margin-top:16px">Benefits</h3>
    <div style="margin-top:6px">${s.benefits
      .map((b) => `<div class="row gap8" style="padding:3px 0"><span class="accent">${icon("check", 18)}</span><span class="body-m">${esc(b)}</span></div>`)
      .join("")}</div>` : ""}
    ${s.caution ? `<div class="caution body-m" style="margin-top:16px"><strong>Caution:</strong> ${esc(s.caution)}</div>` : ""}
    ${practiceAct ? `<button class="btn lg" style="margin-top:22px" data-act="${practiceAct}" data-arg="${esc(practiceArg)}">${icon("play", 20)}${esc(practiceLabel)}</button>` : ""}
  `;
}
