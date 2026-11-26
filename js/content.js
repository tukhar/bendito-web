// Stretches, plyometric exercises, routines and labels. The raw data is
// generated from the Android app's Content.kt and PlyoContent.kt by
// scripts/build_web.py into content-data.js.
import { DATA } from "./content-data.js";

export const AREAS = [
  ["NECK", "Neck"],
  ["SHOULDERS", "Shoulders"],
  ["ARMS", "Arms & Wrists"],
  ["CHEST", "Chest"],
  ["BACK", "Back"],
  ["CORE", "Core"],
  ["HIPS", "Hips"],
  ["GLUTES", "Glutes"],
  ["HAMSTRINGS", "Hamstrings"],
  ["QUADS", "Quads"],
  ["CALVES", "Calves & Feet"],
  ["FULL_BODY", "Full Body"],
];
export const AREA_LABEL = Object.fromEntries(AREAS);

export const DIFFICULTIES = [
  ["BEGINNER", "Beginner"],
  ["INTERMEDIATE", "Intermediate"],
  ["ADVANCED", "Advanced"],
];
export const DIFFICULTY_LABEL = Object.fromEntries(DIFFICULTIES);

export const KINDS = [
  ["STRETCH", "Stretch"],
  ["YOGA", "Yoga pose"],
  ["MOBILITY", "Mobility"],
  ["ISOMETRIC", "Isometric"],
  ["RELAXATION", "Relaxation"],
  ["PLYOMETRIC", "Plyometric"],
];
export const KIND_LABEL = Object.fromEntries(KINDS);

export const CATEGORIES = {
  DAILY: { label: "Daily", blurb: "Quick routines for every part of your day" },
  RELIEF: { label: "Pain Relief", blurb: "Target tight, achy spots" },
  FLEXIBILITY: { label: "Flexibility", blurb: "Go deeper and increase your range" },
  SPORT: { label: "Sport & Recovery", blurb: "Warm up and recover from activity" },
  RELAX: { label: "Relax & Sleep", blurb: "Slow down, breathe and unwind" },
  EXPERT: { label: "Expert", blurb: "Challenging poses for experienced stretchers" },
  PLYO: { label: "Plyometrics", blurb: "Jump training for runners" },
  CUSTOM: { label: "My Routines", blurb: "Routines you built" },
};

export const VOICES = {
  AVA: { label: "Ava", subtitle: "Warm & calm", dir: "ava" },
  ANDREW: { label: "Andrew", subtitle: "Grounded & steady", dir: "andrew" },
};

const withAreas = (s) => ({ ...s, allAreas: new Set([...s.secondaryAreas, s.area]) });

/** Stretches only: what the stretch builder and the stretching side offer. */
export const stretches = DATA.stretches.map(withAreas);
/** Plyometric exercises; each carries a `plyo` spec (sets, rest, impact, keyframes). */
export const plyoExercises = (DATA.plyoExercises || []).map(withAreas);
/** Everything the library shows: stretches first, then plyometric exercises. */
export const allExercises = [...stretches, ...plyoExercises];
const byId = new Map(allExercises.map((s) => [s.id, s]));
/** Looks up a stretch or a plyometric exercise. */
export const stretch = (id) => byId.get(id) || null;

export const plyoWorkouts = (DATA.plyoWorkouts || []).map((r) => ({ ...r, isCustom: false }));
export const builtInRoutines = [...DATA.routines.map((r) => ({ ...r, isCustom: false })), ...plyoWorkouts];
export const builtInRoutineIds = new Set(builtInRoutines.map((r) => r.id));

export const photo = (stretchId) => `img/${stretchId}.jpg`;

/**
 * Total time for a routine, as Content.durationSeconds. Stretches add a transition between
 * items. Plyometric exercises run every set (on each side, when bilateral) with their own rest
 * after each one, except that the routine does not end on a rest.
 */
export function durationSeconds(items, transitionSeconds = 0) {
  let total = 0;
  items.forEach((it, index) => {
    const s = stretch(it.stretchId);
    const sides = s?.bilateral ? 2 : 1;
    const last = index === items.length - 1;
    if (s?.plyo) {
      const bouts = Math.max(1, it.sets ?? 1) * sides;
      total += bouts * it.seconds + (it.restSeconds ?? 0) * (last ? bouts - 1 : bouts);
    } else {
      total += it.seconds * sides + (last ? 0 : transitionSeconds);
    }
  });
  return total;
}

// ---------------------------------------------------------------- plyometrics (PlyoContent.kt)
export const PLYO_LEVELS = [
  ["BEGINNER", "Foundation"],
  ["INTERMEDIATE", "Build"],
  ["ADVANCED", "Advanced"],
];
export const PLYO_LEVEL_LABEL = Object.fromEntries(PLYO_LEVELS);
export const levelLabel = (s) => (s.plyo ? PLYO_LEVEL_LABEL : DIFFICULTY_LABEL)[s.difficulty];
export const IMPACT_LABEL = { LOW: "Low", MODERATE: "Moderate", HIGH: "High" };

export const PLYO_SESSIONS_PER_WEEK = 2;
export const PLYO_RECOVERY_DAYS = 2;
/** Limits the playlist builder steps within: [min, max, step]. */
export const PLYO_RANGE = { sets: [1, 6, 1], seconds: [5, 60, 5], restSeconds: [10, 120, 5] };

/** Where a session's load sits against the usual 80 to 140 contacts-per-session coaching range. */
export const LOAD_BANDS = [
  { id: "LIGHT", label: "Light", advice: "Good for a pre-run primer or a first week.", below: 80 },
  { id: "MODERATE", label: "Moderate", advice: "A solid session. Leave 48 hours before the next one.", below: 140 },
  { id: "HIGH", label: "High", advice: "For experienced jumpers. Keep it to once a week.", below: 200 },
  { id: "TOO_MUCH", label: "Too much", advice: "Cut a few sets or drop an exercise.", below: Infinity },
];

export const isPlyoItems = (items) => items.some((it) => stretch(it.stretchId)?.plyo);
export const isPlyoRoutine = (r) => r.category === "PLYO" || isPlyoItems(r.items);

/** A routine item with the exercise's own default sets, work and rest. */
export const defaultItem = (s) =>
  s.plyo
    ? { stretchId: s.id, seconds: s.defaultSeconds, sets: s.plyo.sets, restSeconds: s.plyo.restSeconds }
    : { stretchId: s.id, seconds: s.defaultSeconds };

/** Storage shape of an item: stretches keep only seconds, plyometric exercises add sets and rest. */
export function plainItem(i) {
  const base = { stretchId: i.stretchId, seconds: i.seconds };
  return stretch(i.stretchId)?.plyo ? { ...base, sets: Math.max(1, i.sets ?? 1), restSeconds: Math.max(0, i.restSeconds ?? 0) } : base;
}

const bouts = (it, s) => Math.max(1, it.sets ?? 1) * (s.bilateral ? 2 : 1);

/** Work bouts the player runs: one per set, doubled for exercises done on each side. */
export const totalSets = (items) =>
  items.reduce((n, it) => {
    const s = stretch(it.stretchId);
    return s?.plyo ? n + bouts(it, s) : n;
  }, 0);

/** Session load: estimated ground contacts, weighted by how hard each landing is. */
export const plyoLoad = (items) =>
  Math.round(
    items.reduce((sum, it) => {
      const s = stretch(it.stretchId);
      return s?.plyo ? sum + bouts(it, s) * it.seconds * s.plyo.contactsPerSecond * s.plyo.loadWeight : sum;
    }, 0),
  );

export const loadBand = (load) => LOAD_BANDS.find((b) => load < b.below);

const LEVEL_ORDER = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];
/** The hardest level among a workout's exercises. */
export const plyoLevel = (items) =>
  LEVEL_ORDER[Math.max(0, ...items.map((it) => LEVEL_ORDER.indexOf(stretch(it.stretchId)?.difficulty ?? "BEGINNER")))];

/** "3 × 15 s" for an item, with "per side" on bilateral exercises. */
export const doseLabel = (it, s) => `${Math.max(1, it.sets ?? 1)} × ${it.seconds} s${s.bilateral ? " per side" : ""}`;

/** The pose (22 numbers) at cycle position t in 0..1, eased between keyframes like Poses.kt poseAt. */
export function poseAt(frames, t) {
  if (frames.length === 1) return frames[0][1];
  const c = Math.min(1, Math.max(0, t));
  let i = 0;
  while (i < frames.length - 2 && c > frames[i + 1][0]) i++;
  const [t0, a] = frames[i];
  const [t1, b] = frames[i + 1];
  const span = t1 - t0;
  if (!(span > 0)) return b;
  const u = (c - t0) / span;
  if (u <= 0) return a; // exactly the keyframe, no float drift
  if (u >= 1) return b;
  const e = 0.5 - 0.5 * Math.cos(Math.PI * u);
  return a.map((v, k) => v + (b[k] - v) * e);
}

export function areasOf(items) {
  const counts = new Map();
  for (const it of items) {
    const a = stretch(it.stretchId)?.area;
    if (a) counts.set(a, (counts.get(a) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([a]) => a);
}

/** Java's String.hashCode, so custom routines get the same colour as on Android. */
export function javaHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return h;
}

export function customToRoutine(c) {
  return {
    id: c.id,
    name: c.name,
    subtitle: isPlyoItems(c.items) ? "Custom workout" : "Custom routine",
    category: "CUSTOM",
    items: c.items,
    isCustom: true,
    hue: Math.abs(javaHash(c.id)) % 12,
  };
}

// ---------------------------------------------------------------- palette
const LIGHT = [
  ["#FFE5D9", "#E4572E", "#3E1B11"],
  ["#DCF0EC", "#2A7B76", "#113331"],
  ["#E6ECFA", "#3D65B8", "#15274D"],
  ["#FCE9C8", "#D18217", "#3D2606"],
  ["#EDE4FA", "#6E4DB8", "#27174A"],
  ["#E1F2DF", "#397D45", "#14331A"],
  ["#FCE2EB", "#C44974", "#421425"],
  ["#E0F1F8", "#27779B", "#0E2F3E"],
  ["#F5E9D9", "#A66832", "#38220E"],
  ["#E6EAF2", "#4B5E82", "#1B2333"],
  ["#E8F3D6", "#5D8A2D", "#22360E"],
  ["#F7E4F5", "#9C4694", "#381435"],
];
const DARK = [
  ["#3A241E", "#F4815E", "#FCEAE4"],
  ["#1D3331", "#5FC2BB", "#E1F5F3"],
  ["#202B42", "#7CA4F2", "#E6EEFC"],
  ["#382C18", "#F0AD4E", "#FDF2DF"],
  ["#2C233D", "#B398F0", "#F0EAFC"],
  ["#1E3222", "#6EC47D", "#E3F5E6"],
  ["#3B212C", "#EC7EA3", "#FCE8EF"],
  ["#1B303B", "#63B9DE", "#E1F3FA"],
  ["#33281E", "#D6945A", "#F7ECE1"],
  ["#232938", "#8FA4CC", "#E8ECF5"],
  ["#26331B", "#97C961", "#EDF6E2"],
  ["#352134", "#D980D0", "#F7E6F5"],
];

/** Inline CSS custom properties for a routine's swatch, with light and dark values. */
export function swatchStyle(hue) {
  const i = ((hue % 12) + 12) % 12;
  const [lc, la, lo] = LIGHT[i];
  const [dc, da, dn] = DARK[i];
  return `--sw-c:${lc};--sw-a:${la};--sw-o:${lo};--sw-dc:${dc};--sw-da:${da};--sw-do:${dn}`;
}
