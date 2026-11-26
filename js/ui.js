// Shared UI helpers: escaping, formatting, icons and a tiny DOM morpher.

export const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function formatDuration(seconds) {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  if (s % 60 === 0) return `${s / 60} min`;
  return `${Math.ceil(s / 60)} min`;
}

export function formatClock(seconds) {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// ---------------------------------------------------------------- icons
const P = {
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  heart:
    '<path d="M12 20.2S3.6 15.1 3.6 9.3c0-2.7 2.1-4.8 4.7-4.8 1.6 0 3 .8 3.7 2.1.7-1.3 2.1-2.1 3.7-2.1 2.6 0 4.7 2.1 4.7 4.8 0 5.8-8.4 10.9-8.4 10.9z"/>',
  heartFill:
    '<path fill="currentColor" d="M12 20.2S3.6 15.1 3.6 9.3c0-2.7 2.1-4.8 4.7-4.8 1.6 0 3 .8 3.7 2.1.7-1.3 2.1-2.1 3.7-2.1 2.6 0 4.7 2.1 4.7 4.8 0 5.8-8.4 10.9-8.4 10.9z"/>',
  play: '<path fill="currentColor" d="M8.5 5.8v12.4c0 .8.9 1.3 1.6.9l10-6.2c.6-.4.6-1.3 0-1.7l-10-6.2c-.7-.5-1.6 0-1.6.8z"/>',
  pause: '<rect fill="currentColor" stroke="none" x="6.5" y="5" width="4" height="14" rx="1.4"/><rect fill="currentColor" stroke="none" x="13.5" y="5" width="4" height="14" rx="1.4"/>',
  next: '<path fill="currentColor" d="M5.5 6.6v10.8c0 .8.9 1.2 1.5.8l8-5.4c.6-.4.6-1.2 0-1.6L7 5.8c-.6-.4-1.5 0-1.5.8z"/><path d="M18.2 6v12"/>',
  prev: '<path fill="currentColor" d="M18.5 6.6v10.8c0 .8-.9 1.2-1.5.8l-8-5.4c-.6-.4-.6-1.2 0-1.6l8-5.4c.6-.4 1.5 0 1.5.8z"/><path d="M5.8 6v12"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  edit: '<path d="M4.5 19.5l1-4.2L15.8 5a2.1 2.1 0 0 1 3 3L8.6 18.4z"/><path d="M13.5 7.3l3 3"/>',
  trash: '<path d="M4.5 7h15M10 11v6M14 11v6M6.5 7l.9 11.4a2 2 0 0 0 2 1.6h5.2a2 2 0 0 0 2-1.6L17.5 7M9 7V4.5h6V7"/>',
  copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2.2"/><path d="M15.5 8.5V6.7a2.2 2.2 0 0 0-2.2-2.2H6.7a2.2 2.2 0 0 0-2.2 2.2v6.6a2.2 2.2 0 0 0 2.2 2.2h1.8"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.2"/><circle cx="12" cy="7.9" r=".6" fill="currentColor"/>',
  list: '<path d="M9.5 6.5h10M9.5 12h10M9.5 17.5h10"/><circle cx="5" cy="6.5" r=".9" fill="currentColor"/><circle cx="5" cy="12" r=".9" fill="currentColor"/><circle cx="5" cy="17.5" r=".9" fill="currentColor"/>',
  volume: '<path d="M4.5 9.5h3l4.5-4v13l-4.5-4h-3z"/><path d="M15.5 9.2a4 4 0 0 1 0 5.6M18.2 6.6a7.6 7.6 0 0 1 0 10.8"/>',
  volumeOff: '<path d="M4.5 9.5h3l4.5-4v13l-4.5-4h-3z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
  sliders: '<path d="M4 7h9M18 7h2M4 17h3M12 17h8"/><circle cx="15.5" cy="7" r="2.3"/><circle cx="9.5" cy="17" r="2.3"/>',
  chart: '<path d="M5.5 20v-8M12 20V5M18.5 20v-5"/>',
  playCircle: '<circle cx="12" cy="12" r="9"/><path fill="currentColor" d="M10 8.6v6.8c0 .5.5.8.9.5l5.2-3.4c.4-.2.4-.8 0-1L10.9 8.1c-.4-.3-.9 0-.9.5z"/>',
  figure: '<circle cx="12" cy="4.6" r="2" fill="currentColor"/><path d="M5 9.2c2.3.6 4.6.9 7 .9s4.7-.3 7-.9M12 10.1v5M12 15.1l-2.8 5.4M12 15.1l2.8 5.4"/>',
  fire: '<path fill="currentColor" stroke="none" d="M12.1 21.5c-4 0-7.1-2.9-7.1-6.8 0-3.2 2-5.1 3.5-7.1.3 1.6 1.2 2.7 2.3 3.2C10.6 7 12.5 4.3 15.3 2.6c-.3 3.1 1.1 5 2.3 6.7.9 1.3 1.4 2.7 1.4 4.3 0 4.6-3 7.9-6.9 7.9zm.1-2c1.8 0 3-1.3 3-3 0-1.4-.9-2.4-1.6-3.6-.9 1.4-2 2-2.9 2.1-.4-.5-.6-1.1-.7-1.6-.7.9-.9 1.8-.9 2.9 0 1.8 1.3 3.2 3.1 3.2z"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  swap: '<path d="M4.5 8.5h14l-3.5-3.5M19.5 15.5h-14l3.5 3.5"/>',
  chevLeft: '<path d="M14.5 6l-6 6 6 6"/>',
  chevRight: '<path d="M9.5 6l6 6-6 6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  download: '<path d="M12 4.5v10.5M7.5 10.5L12 15l4.5-4.5M5 19.5h14"/>',
  upload: '<path d="M12 15V4.5M7.5 9L12 4.5 16.5 9M5 19.5h14"/>',
};

export function icon(name, size = 24, cls = "") {
  return `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ""}</svg>`;
}

// ---------------------------------------------------------------- morph
// Patches `from` in place so it matches `to`, keeping existing nodes (and so
// focus, scroll position, playing animations and loaded images) where it can.
// Children with a data-key attribute are matched by key.

function keyOf(node) {
  return node.nodeType === 1 ? node.getAttribute("data-key") : null;
}

function sameKind(a, b) {
  if (a.nodeType !== b.nodeType) return false;
  if (a.nodeType !== 1) return true;
  return a.tagName === b.tagName && keyOf(a) === keyOf(b);
}

function syncAttrs(from, to) {
  for (const { name } of [...from.attributes]) {
    if (!to.hasAttribute(name)) from.removeAttribute(name);
  }
  for (const { name, value } of [...to.attributes]) {
    if (from.getAttribute(name) !== value) from.setAttribute(name, value);
  }
  const tag = from.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") {
    const focused = document.activeElement === from;
    if (from.type === "checkbox" || from.type === "radio") {
      from.checked = to.hasAttribute("checked");
    } else if (!focused && from.value !== (to.getAttribute("value") ?? to.textContent ?? "")) {
      from.value = to.getAttribute("value") ?? "";
    }
  }
}

function morphNode(from, to) {
  if (from.nodeType === 3 || from.nodeType === 8) {
    if (from.nodeValue !== to.nodeValue) from.nodeValue = to.nodeValue;
    return;
  }
  syncAttrs(from, to);
  if (from.tagName === "TEXTAREA") return;
  morphChildren(from, to);
}

export function morphChildren(parent, next) {
  const oldKids = [...parent.childNodes];
  const newKids = [...next.childNodes];
  const keyed = new Map();
  for (const k of oldKids) {
    const key = keyOf(k);
    if (key != null) keyed.set(key, k);
  }
  const used = new Set();
  let cursor = 0;
  newKids.forEach((nk, i) => {
    const key = keyOf(nk);
    let match = null;
    if (key != null) {
      const cand = keyed.get(key);
      if (cand && !used.has(cand) && sameKind(cand, nk)) match = cand;
    } else {
      while (cursor < oldKids.length && (used.has(oldKids[cursor]) || keyOf(oldKids[cursor]) != null)) cursor++;
      const cand = oldKids[cursor];
      if (cand && sameKind(cand, nk)) {
        match = cand;
        cursor++;
      }
    }
    const ref = parent.childNodes[i] || null;
    if (match) {
      used.add(match);
      if (match !== ref) parent.insertBefore(match, ref);
      morphNode(match, nk);
    } else {
      parent.insertBefore(nk.cloneNode(true), ref);
    }
  });
  for (const k of oldKids) {
    if (!used.has(k) && k.parentNode === parent) parent.removeChild(k);
  }
}

const tpl = document.createElement("template");
export function morphHTML(root, html) {
  tpl.innerHTML = html;
  morphChildren(root, tpl.content);
}
