// Stick figure for plyometric exercises: the web twin of the keyframe mode in
// PoseIllustration.kt. Lists get a static pose; the player, detail banner and
// detail sheet get a looping animation driven by one requestAnimationFrame loop.
import { poseAt, stretch } from "./content.js";

const FLOOR_LINE = 93.8; // the mat sits just under the feet (floor is y = 90, limbs are 5.5 wide)
const n1 = (v) => v.toFixed(1);

export const reducedMotion = () => !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Flips a pose left-to-right for the right side of a bilateral exercise (Pose.mirrored()). */
const flip = (a) => a.map((v, i) => (i % 2 === 0 ? 100 - v : v));

/** Path data and positions for one pose: [head, neck, hip, lElbow, lHand, rElbow, rHand, lKnee, lFoot, rKnee, rFoot]. */
function geometry(pose, mirror) {
  const a = mirror ? flip(pose) : pose;
  const sx = a[2] + (a[4] - a[2]) * 0.1;
  const sy = a[3] + (a[5] - a[3]) * 0.1;
  const limb = (x0, y0, i) => `M${n1(x0)} ${n1(y0)}L${n1(a[i])} ${n1(a[i + 1])}L${n1(a[i + 2])} ${n1(a[i + 3])}`;
  const air = Math.max(0, 90 - Math.max(a[17], a[21]));
  const spread = Math.abs(a[16] - a[20]) / 2 + 9;
  return {
    la: limb(sx, sy, 6),
    ra: limb(sx, sy, 10),
    ll: limb(a[4], a[5], 14),
    rl: limb(a[4], a[5], 18),
    to: `M${n1(a[4])} ${n1(a[5])}L${n1(a[2])} ${n1(a[3])}`,
    hx: n1(a[0]),
    hy: n1(a[1]),
    shx: n1((a[16] + a[20]) / 2),
    shrx: n1(Math.max(3, spread * (1 - Math.min(1, air / 26)))),
  };
}

function boxRect(box, mirror) {
  if (!box) return "";
  const [x0, x1, top] = box;
  const x = mirror ? 100 - x1 : x0;
  const y = top + 3.3;
  return `<rect class="bx" x="${n1(x)}" y="${n1(y)}" width="${n1(x1 - x0)}" height="${n1(FLOOR_LINE - y)}" rx="2"/>`;
}

/**
 * Inline SVG of exercise `s` at cycle position `t`. The class names are what the loop updates.
 * The view starts 5 units above the pose canvas: a figure standing on a box puts its head there.
 */
export function figureSvg(s, t, mirror = false) {
  const g = geometry(poseAt(s.plyo.frames, t), mirror);
  const hasBox = !!s.plyo.box;
  return `<svg viewBox="0 -5 100 100" aria-hidden="true"><line class="mat" x1="10" y1="${FLOOR_LINE}" x2="90" y2="${FLOOR_LINE}"/>${boxRect(s.plyo.box, mirror)}${hasBox ? "" : `<ellipse class="sh" cx="${g.shx}" cy="${FLOOR_LINE}" rx="${g.shrx}" ry="1.7"/>`}<g class="bk"><path class="la" d="${g.la}"/><path class="ll" d="${g.ll}"/></g><path class="to" d="${g.to}"/><path class="rl" d="${g.rl}"/><path class="ra" d="${g.ra}"/><circle class="hd" r="6.4" cx="${g.hx}" cy="${g.hy}"/></svg>`;
}

function refs(el) {
  const q = (c) => el.querySelector(c);
  return { svg: q("svg"), sh: q(".sh"), la: q(".la"), ll: q(".ll"), to: q(".to"), rl: q(".rl"), ra: q(".ra"), hd: q(".hd") };
}

function draw(el, s, t, mirror) {
  const r = el.__refs;
  const g = geometry(poseAt(s.plyo.frames, t), mirror);
  r.la.setAttribute("d", g.la);
  r.ra.setAttribute("d", g.ra);
  r.ll.setAttribute("d", g.ll);
  r.rl.setAttribute("d", g.rl);
  r.to.setAttribute("d", g.to);
  r.hd.setAttribute("cx", g.hx);
  r.hd.setAttribute("cy", g.hy);
  if (r.sh) {
    r.sh.setAttribute("cx", g.shx);
    r.sh.setAttribute("rx", g.shrx);
  }
}

function update(el, now) {
  const s = stretch(el.dataset.fig);
  if (!s?.plyo) return;
  const mirror = el.dataset.mirror === "1";
  const sig = `${s.id}|${mirror}`;
  if (el.__sig !== sig || !el.__refs?.svg?.isConnected) {
    // New element, or the same element now shows another exercise: rebuild so the box prop matches.
    if (el.__sig && el.__sig !== sig) el.innerHTML = figureSvg(s, 0, mirror);
    el.__sig = sig;
    el.__refs = refs(el);
    el.__held = null;
    if (!el.__refs.svg) return;
  }
  const hold = el.dataset.hold || "";
  if (hold === "pause") return; // freeze mid-move
  if (hold) {
    // Resting: stand at the first keyframe until work starts again.
    if (el.__held !== sig) {
      draw(el, s, 0, mirror);
      el.__held = sig;
    }
    return;
  }
  el.__held = null;
  draw(el, s, (now % s.plyo.cycleMs) / s.plyo.cycleMs, mirror);
}

let running = false;
/** Starts the animation loop for every `.fig[data-anim]` under `root`. Safe to call more than once. */
export function startFigures(root) {
  if (running || reducedMotion()) return;
  running = true;
  const frame = (now) => {
    root.querySelectorAll(".fig[data-anim]").forEach((el) => update(el, now));
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
