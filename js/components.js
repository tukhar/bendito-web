// Reusable view fragments (HTML strings). Interactions are wired by data-act
// attributes that app.js dispatches.
import { AREA_LABEL, DIFFICULTY_LABEL, KIND_LABEL, durationSeconds, photo, stretch, swatchStyle } from "./content.js";
import { esc, formatDuration, icon } from "./ui.js";

export function photoBox(stretchId, { cls = "", mirror = false, breathe = false, style = "", key = "" } = {}) {
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
  return `<div class="card rcard sw" style="${swatchStyle(routine.hue)}" data-key="r-${esc(routine.id)}" data-act="openRoutine" data-arg="${esc(routine.id)}" role="button" tabindex="0">
    ${lead ? photoBox(lead.id, { cls: "thumb" }) : `<div class="thumb"></div>`}
    <div class="grow">
      <div class="title-m ellipsis">${esc(routine.name)}</div>
      <div class="body-s muted ellipsis" style="margin-top:2px">${esc(routine.subtitle)}</div>
      <div class="label-m meta" style="margin-top:6px">${formatDuration(total)} · ${routine.items.length} poses</div>
    </div>
    <button class="icon-btn ${isFavorite ? "on" : ""}" data-act="toggleFavorite" data-arg="${esc(routine.id)}" aria-label="${isFavorite ? "Remove favorite" : "Favorite"}">${icon(isFavorite ? "heartFill" : "heart")}</button>
    <button class="icon-btn tonal" data-act="startRoutine" data-arg="${esc(routine.id)}" aria-label="Start ${esc(routine.name)}">${icon("play")}</button>
  </div>`;
}

export function stretchRow(s, { seconds = s.defaultSeconds, act = "inspectStretch", arg = s.id, trailing = "", key = "" } = {}) {
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

export function stretchDetail(s, { practiceLabel = "Practice This Stretch", practiceAct = "practiceStretch", practiceArg = s.id } = {}) {
  const pills = [
    AREA_LABEL[s.area],
    DIFFICULTY_LABEL[s.difficulty],
    KIND_LABEL[s.kind],
  ].map((t) => `<span class="pill info-pill">${esc(t)}</span>`);
  pills.push(`<span class="pill info-pill">${icon("clock", 14)}${s.bilateral ? `${s.defaultSeconds}s per side` : `${s.defaultSeconds}s`}</span>`);
  if (s.bilateral) pills.push(`<span class="pill info-pill">${icon("swap", 14)}Both sides</span>`);
  return `
    <div class="tile row center" style="height:250px;border-radius:22px">
      ${photoBox(s.id, { breathe: true, style: "width:228px;height:228px;border-radius:18px" })}
    </div>
    <h2 class="headline-s" style="margin-top:16px">${esc(s.name)}</h2>
    <div class="row wrap gap8" style="margin-top:8px">${pills.join("")}</div>
    <p class="body-l" style="margin:14px 0 0">${esc(s.description)}</p>
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
