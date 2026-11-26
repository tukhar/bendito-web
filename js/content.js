// Stretches, routines and labels. The raw data is generated from the Android
// app's Content.kt by scripts/build_web.py into content-data.js.
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
];
export const KIND_LABEL = Object.fromEntries(KINDS);

export const CATEGORIES = {
  DAILY: { label: "Daily", blurb: "Quick routines for every part of your day" },
  RELIEF: { label: "Pain Relief", blurb: "Target tight, achy spots" },
  FLEXIBILITY: { label: "Flexibility", blurb: "Go deeper and increase your range" },
  SPORT: { label: "Sport & Recovery", blurb: "Warm up and recover from activity" },
  RELAX: { label: "Relax & Sleep", blurb: "Slow down, breathe and unwind" },
  EXPERT: { label: "Expert", blurb: "Challenging poses for experienced stretchers" },
  CUSTOM: { label: "My Routines", blurb: "Routines you built" },
};

export const VOICES = {
  AVA: { label: "Ava", subtitle: "Warm & calm", dir: "ava" },
  ANDREW: { label: "Andrew", subtitle: "Grounded & steady", dir: "andrew" },
};

export const stretches = DATA.stretches.map((s) => ({
  ...s,
  allAreas: new Set([...s.secondaryAreas, s.area]),
}));
const byId = new Map(stretches.map((s) => [s.id, s]));
export const stretch = (id) => byId.get(id) || null;

export const builtInRoutines = DATA.routines.map((r) => ({ ...r, isCustom: false }));
export const builtInRoutineIds = new Set(builtInRoutines.map((r) => r.id));

export const photo = (stretchId) => `img/${stretchId}.jpg`;

export function durationSeconds(items, transitionSeconds = 0) {
  if (!items.length) return 0;
  const work = items.reduce((sum, it) => sum + it.seconds * (stretch(it.stretchId)?.bilateral ? 2 : 1), 0);
  return work + transitionSeconds * (items.length - 1);
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
    subtitle: "Custom routine",
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
