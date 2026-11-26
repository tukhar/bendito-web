// Voice cues and chimes with the Web Audio API, ported from CueEngine.kt and
// AudioDsp.kt. One AudioContext is shared for the whole app.
import { VOICES } from "./content.js";

const CORE_CLIPS = ["cue_get_ready", "cue_up_next", "cue_left_side", "cue_right_side", "cue_switch_sides", "cue_halfway", "cue_complete"];
const FADE_S = 0.035;

let ctx = null;
let master = null;
let chimes = null;
const clipCache = new Map(); // "ava/cobra" -> Promise<AudioBuffer|null>

function ensureContext() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC({ latencyHint: "interactive" });
    master = ctx.createGain();
    master.connect(ctx.destination);
    chimes = buildChimes(ctx.sampleRate);
  }
  return ctx;
}

/** Must be called from a user gesture at least once (iOS/Chrome autoplay rules). */
export function unlockAudio() {
  const c = ensureContext();
  if (c && c.state !== "running") c.resume().catch(() => {});
  return c;
}

// ---------------------------------------------------------------- chimes
const fadeIn = (i, len) => (len <= 0 ? 1 : i <= 0 ? 0 : i >= len ? 1 : 0.5 * (1 - Math.cos((Math.PI * i) / len)));
const softLimit = (x) => {
  const ax = Math.abs(x);
  if (ax <= 0.8) return x;
  return Math.sign(x) * (0.8 + 0.16 * Math.tanh((ax - 0.8) / 0.16));
};

function chimeBuffer(sr, ms, tailMs, fill) {
  const n = Math.max(1, Math.round((sr * ms) / 1000));
  const raw = new Float32Array(n);
  fill(raw, n);
  const tail = Math.min(Math.round((sr * tailMs) / 1000), Math.floor(n / 2));
  for (let i = 0; i < n; i++) {
    let v = raw[i];
    if (tail > 0 && i >= n - tail) v *= fadeIn(n - 1 - i, tail);
    raw[i] = softLimit(v);
  }
  raw[0] = 0;
  raw[n - 1] = 0;
  const buf = ctx.createBuffer(1, n, sr);
  buf.copyToChannel(raw, 0);
  return buf;
}

function buildChimes(sr) {
  const TAU = 2 * Math.PI;
  const att = (ms) => Math.max(1, Math.round((sr * ms) / 1000));
  return {
    start: chimeBuffer(sr, 650, 45, (raw, n) => {
      const a = att(12);
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const s = 0.55 * Math.sin(TAU * 523.25 * t) * Math.exp(-4.2 * t) +
          0.22 * Math.sin(TAU * 783.99 * t) * Math.exp(-6.5 * t) +
          0.14 * Math.sin(TAU * 1046.5 * t) * Math.exp(-8.5 * t);
        raw[i] = 0.34 * fadeIn(i, a) * s;
      }
    }),
    switch: chimeBuffer(sr, 700, 45, (raw, n) => {
      const a = att(10);
      const off = Math.round((sr * 130) / 1000);
      for (let i = 0; i < n; i++) {
        const t1 = i / sr;
        let v = fadeIn(i, a) * (0.65 * Math.sin(TAU * 440 * t1) * Math.exp(-6 * t1) + 0.2 * Math.sin(TAU * 880 * t1) * Math.exp(-8 * t1));
        if (i >= off) {
          const i2 = i - off;
          const t2 = i2 / sr;
          v += fadeIn(i2, a) * (0.65 * Math.sin(TAU * 554.37 * t2) * Math.exp(-5 * t2) + 0.2 * Math.sin(TAU * 1108.73 * t2) * Math.exp(-7.2 * t2));
        }
        raw[i] = 0.28 * v;
      }
    }),
    tick: chimeBuffer(sr, 90, 15, (raw, n) => {
      const a = att(5);
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const env = fadeIn(i, a) * Math.exp(-t / 0.022);
        raw[i] = 0.16 * env * (0.85 * Math.sin(TAU * 659.25 * t) + 0.15 * Math.sin(TAU * 1318.51 * t) * Math.exp(-t / 0.012));
      }
    }),
    complete: chimeBuffer(sr, 1250, 60, (raw, n) => {
      const a = att(10);
      const step = Math.round((sr * 110) / 1000);
      [523.25, 659.25, 783.99, 1046.5].forEach((f, k) => {
        for (let i = k * step; i < n; i++) {
          const local = i - k * step;
          const t = local / sr;
          raw[i] += 0.24 * fadeIn(local, a) * (0.72 * Math.sin(TAU * f * t) * Math.exp(-3.4 * t) + 0.18 * Math.sin(TAU * f * 2 * t) * Math.exp(-5 * t));
        }
      });
    }),
  };
}

// ---------------------------------------------------------------- clips
/** Trims AAC priming/padding: drop leading/trailing 4 ms blocks below -52 dBFS RMS. */
function trimSilence(buf) {
  const data = buf.getChannelData(0);
  const block = Math.max(1, Math.round(buf.sampleRate * 0.004));
  const loud = (start) => {
    let sum = 0;
    const end = Math.min(data.length, start + block);
    for (let i = start; i < end; i++) sum += data[i] * data[i];
    return Math.sqrt(sum / Math.max(1, end - start)) > 0.0025;
  };
  let s = 0;
  while (s < data.length && !loud(s)) s += block;
  let e = data.length;
  while (e > s && !loud(Math.max(s, e - block))) e -= block;
  const margin = block * 2;
  s = Math.max(0, s - margin);
  e = Math.min(data.length, e + margin);
  if (e - s <= 0 || (s === 0 && e === data.length)) return buf;
  const out = ctx.createBuffer(buf.numberOfChannels, e - s, buf.sampleRate);
  for (let c = 0; c < buf.numberOfChannels; c++) out.copyToChannel(buf.getChannelData(c).subarray(s, e), c);
  return out;
}

function loadClip(voiceDir, clipId) {
  const key = `${voiceDir}/${clipId}`;
  if (!clipCache.has(key)) {
    const p = fetch(`voice/${key}.m4a`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.statusText))))
      .then((ab) => new Promise((res, rej) => ensureContext().decodeAudioData(ab, res, rej)))
      .then(trimSilence)
      .catch(() => {
        clipCache.delete(key);
        return null;
      });
    clipCache.set(key, p);
  }
  return clipCache.get(key);
}

const sideClip = (side) => (side === "LEFT" ? "cue_left_side" : side === "RIGHT" ? "cue_right_side" : null);

// ---------------------------------------------------------------- cue engine
export class CueEngine {
  constructor(voiceStyle = "AVA") {
    this.voice = voiceStyle;
    this.generation = 0;
    this.muted = false;
    this.utterance = null; // { gain, sources }
    this.released = false;
  }

  get voiceDir() {
    return (VOICES[this.voice] || VOICES.AVA).dir;
  }

  setVoiceStyle(style) {
    this.voice = style;
  }

  setMuted(muted) {
    this.muted = muted;
    if (muted) {
      this.generation++;
      this.stopUtterance();
    }
  }

  fadeOutSpeech() {
    this.generation++;
    this.stopUtterance();
  }

  preload(stretchIds) {
    ensureContext();
    const dir = this.voiceDir;
    const ids = [...CORE_CLIPS, ...new Set(stretchIds)];
    // Sequential so the first cues are ready first and we don't flood the network.
    ids.reduce((p, id) => p.then(() => loadClip(dir, id)), Promise.resolve());
  }

  speakPrepare(stretchId, side) {
    const sc = sideClip(side);
    this.queue(sc ? ["cue_get_ready", stretchId, sc] : ["cue_get_ready", stretchId], sc ? [160, 140] : [160], 0);
  }
  speakUpNext(stretchId, side) {
    const sc = sideClip(side);
    this.queue(sc ? ["cue_up_next", stretchId, sc] : ["cue_up_next", stretchId], sc ? [160, 140] : [160], 0);
  }
  speakStretch(stretchId, side, delayMs = 0) {
    const sc = sideClip(side);
    this.queue(sc ? [stretchId, sc] : [stretchId], sc ? [140] : [], delayMs);
  }
  speakSwitchSides(delayMs = 0) { this.queue(["cue_switch_sides"], [], delayMs); }
  speakHalfway() { this.queue(["cue_halfway"], [], 0); }
  speakComplete(delayMs = 220) { this.queue(["cue_complete"], [], delayMs); }

  playPreview(style) {
    this.setVoiceStyle(style);
    unlockAudio();
    this.chime("start");
    this.queue(["cue_preview"], [], 180);
  }

  chime(name) {
    if (this.released || this.muted) return;
    const c = unlockAudio();
    if (!c || !chimes) return;
    const src = c.createBufferSource();
    src.buffer = chimes[name];
    src.connect(master);
    src.start();
  }

  stopUtterance() {
    const u = this.utterance;
    this.utterance = null;
    if (!u || !ctx) return;
    const t = ctx.currentTime;
    u.gain.gain.cancelScheduledValues(t);
    u.gain.gain.setValueAtTime(u.gain.gain.value, t);
    u.gain.gain.linearRampToValueAtTime(0, t + FADE_S);
    u.sources.forEach((s) => {
      try { s.stop(t + FADE_S + 0.01); } catch { /* already stopped */ }
    });
  }

  async queue(clipIds, pausesMs, delayMs) {
    if (this.released || this.muted) return;
    const gen = ++this.generation;
    const requestedAt = performance.now();
    const c = ensureContext();
    if (!c) return;
    const buffers = await Promise.all(clipIds.map((id) => loadClip(this.voiceDir, id)));
    if (this.released || gen !== this.generation) return;
    const parts = buffers.map((b, i) => [b, pausesMs[i - 1] ?? 140]).filter(([b]) => b);
    if (!parts.length) return;

    this.stopUtterance();
    unlockAudio();
    const gain = c.createGain();
    gain.connect(master);
    const waited = (performance.now() - requestedAt) / 1000;
    let t = c.currentTime + Math.max(0.03, delayMs / 1000 - waited) + FADE_S;
    gain.gain.setValueAtTime(0, c.currentTime);
    gain.gain.linearRampToValueAtTime(1, t);
    const sources = parts.map(([buf, pause], i) => {
      if (i > 0) t += pause / 1000;
      const src = c.createBufferSource();
      src.buffer = buf;
      src.connect(gain);
      src.start(t);
      t += buf.duration;
      return src;
    });
    this.utterance = { gain, sources };
  }

  release() {
    this.released = true;
    this.generation++;
    this.stopUtterance();
  }
}

export function vibrate(pattern) {
  try {
    navigator.vibrate?.(pattern);
  } catch { /* unsupported */ }
}
