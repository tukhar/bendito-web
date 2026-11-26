// Guided player state machine, ported from PlayerEngine.kt (PlayerController).
import { stretch } from "./content.js";

export const SIDE_LABEL = { NONE: "", LEFT: "Left side", RIGHT: "Right side" };

/**
 * Flattens routine items into the steps the player runs. Bilateral stretches become a left and a
 * right step. Plyometric exercises become one step per set (per side when bilateral), each
 * followed by the item's own rest (`restAfterSec`; null means the ordinary transition applies).
 */
export function expandSteps(items) {
  const out = [];
  items.forEach((item, itemIndex) => {
    const s = stretch(item.stretchId);
    if (!s) return;
    const durationSec = Math.max(5, item.seconds);
    const isPlyo = !!s.plyo;
    const setCount = isPlyo ? Math.max(1, item.sets ?? 1) : 1;
    const restAfterSec = isPlyo ? Math.max(0, item.restSeconds ?? 0) : null;
    const sides = s.bilateral ? ["LEFT", "RIGHT"] : ["NONE"];
    for (let set = 1; set <= setCount; set++) {
      for (const side of sides) out.push({ itemIndex, stretch: s, durationSec, side, set, setCount, restAfterSec, isPlyo });
    }
  });
  return out;
}

const PREP_SECONDS = 3;

export class PlayerController {
  /**
   * @param {object} o
   * @param {(ev: {type: string, step?: object, previous?: object, announceName?: boolean, secondsRemaining?: number}) => void} o.onCue
   * @param {(elapsedActiveSec: number, completedSteps: number) => void} o.onComplete
   */
  constructor({ routineId, routineName, items, transitionSeconds, onCue = () => {}, onComplete = () => {}, startItemIndex = 0, onChange = () => {} }) {
    this.steps = expandSteps(items);
    this.transitionSeconds = transitionSeconds;
    this.onCue = onCue;
    this.onComplete = onComplete;
    this.onChange = onChange;
    this.started = false;
    this.completionDispatched = false;
    this.timer = null;
    const found = this.steps.findIndex((s) => s.itemIndex >= startItemIndex);
    this.initialIndex = found >= 0 ? found : 0;
    const base = {
      routineId,
      routineName,
      steps: this.steps,
      currentIndex: 0,
      phase: "PREPARE",
      remainingSec: PREP_SECONDS,
      stepTotalSec: PREP_SECONDS,
      isPaused: false,
      elapsedActiveSec: 0,
      completedSteps: 0,
      showInstructions: false,
      savedSessionId: null,
      feeling: 0,
      isSwitchingSides: false,
      // True while a TRANSITION is the rest between plyometric sets; currentStep is what comes next.
      isRest: false,
    };
    this.state = this.steps.length
      ? { ...base, currentIndex: this.initialIndex }
      : { ...base, phase: "COMPLETED", remainingSec: 0, stepTotalSec: 0 };
  }

  get currentStep() { return this.state.steps[this.state.currentIndex] || null; }
  get nextStep() { return this.state.steps[this.state.currentIndex + 1] || null; }
  get totalPoses() { return this.steps.reduce((m, s) => Math.max(m, s.itemIndex + 1), 0); }
  get currentPoseNumber() { return (this.currentStep?.itemIndex ?? 0) + 1; }
  get progressFraction() {
    const { stepTotalSec, remainingSec } = this.state;
    return stepTotalSec <= 0 ? 0 : Math.min(1, Math.max(0, remainingSec / stepTotalSec));
  }

  set(patch) {
    this.state = { ...this.state, ...patch };
    this.onChange(this.state);
  }

  /** Starts a wall-clock driven 1 Hz ticker that catches up if the tab was throttled. */
  start() {
    if (!this.steps.length) {
      this.dispatchCompleteIfNeeded();
      return;
    }
    if (!this.started) {
      this.started = true;
      this.onCue({ type: "Prepare", step: this.steps[this.initialIndex] });
    }
    if (this.timer) return;
    let last = performance.now();
    let acc = 0;
    this.timer = setInterval(() => {
      const now = performance.now();
      const dt = now - last;
      last = now;
      if (this.state.isPaused || this.state.phase === "COMPLETED") {
        acc = 0;
        return;
      }
      acc += dt;
      let guard = 0;
      while (acc >= 1000 && guard++ < 600) {
        acc -= 1000;
        this.tickOneSecond();
      }
    }, 200);
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
  }

  tickOneSecond() {
    const cur = this.state;
    if (cur.isPaused || cur.phase === "COMPLETED") return;
    const step = this.currentStep;
    if (!step) return;

    const nextRemaining = cur.remainingSec - 1;
    // Rest between plyometric sets is part of the workout, so it counts toward session time.
    const counts = cur.phase === "ACTIVE" || (cur.phase === "TRANSITION" && cur.isRest);
    const nextElapsed = counts ? cur.elapsedActiveSec + 1 : cur.elapsedActiveSec;

    if (nextRemaining > 0) {
      this.set({ remainingSec: nextRemaining, elapsedActiveSec: nextElapsed });
      if (cur.phase === "ACTIVE") {
        if (!step.isPlyo && cur.stepTotalSec >= 12 && nextRemaining === Math.floor(cur.stepTotalSec / 2)) {
          this.onCue({ type: "Halfway", step });
        }
        if (nextRemaining >= 1 && nextRemaining <= 3) {
          this.onCue({ type: "CountdownTick", secondsRemaining: nextRemaining });
        }
      } else if (cur.phase === "TRANSITION" && cur.isRest && nextRemaining >= 1 && nextRemaining <= 3) {
        this.onCue({ type: "CountdownTick", secondsRemaining: nextRemaining });
      }
      return;
    }

    if (cur.phase === "PREPARE" || cur.phase === "TRANSITION") {
      // nextElapsed carries the final second of a plyo rest (it is unchanged for PREPARE and plain transitions).
      this.set({ phase: "ACTIVE", remainingSec: step.durationSec, stepTotalSec: step.durationSec, isSwitchingSides: false, isRest: false, elapsedActiveSec: nextElapsed });
      this.onCue({ type: "StartStretch", step, announceName: false });
      return;
    }

    if (cur.phase === "ACTIVE") {
      const nextCompleted = Math.max(cur.completedSteps, cur.currentIndex + 1);
      const nextIdx = cur.currentIndex + 1;
      if (nextIdx >= cur.steps.length) {
        this.set({ phase: "COMPLETED", remainingSec: 0, stepTotalSec: 0, elapsedActiveSec: nextElapsed, completedSteps: nextCompleted, isSwitchingSides: false });
        this.onCue({ type: "Complete" });
        this.dispatchCompleteIfNeeded();
        return;
      }
      const nextStep = cur.steps[nextIdx];
      const rest = step.restAfterSec;
      const isRest = rest != null;
      const switching = nextStep.side === "RIGHT" && nextStep.itemIndex === step.itemIndex && nextStep.set === step.set;
      const gap = Math.max(0, isRest ? rest : this.transitionSeconds);
      if (gap > 0) {
        this.set({ currentIndex: nextIdx, phase: "TRANSITION", remainingSec: gap, stepTotalSec: gap, elapsedActiveSec: nextElapsed, completedSteps: nextCompleted, isSwitchingSides: switching, isRest });
        if (isRest) {
          const isNewExercise = nextStep.itemIndex !== step.itemIndex;
          this.onCue({ type: "Rest", step: nextStep, previous: step, isNewExercise, isSwitchingSides: !isNewExercise && nextStep.side !== step.side && nextStep.set === step.set });
        } else {
          this.onCue({ type: switching ? "SwitchSides" : "UpNext", step: nextStep });
        }
      } else {
        this.set({ currentIndex: nextIdx, phase: "ACTIVE", remainingSec: nextStep.durationSec, stepTotalSec: nextStep.durationSec, elapsedActiveSec: nextElapsed, completedSteps: nextCompleted, isSwitchingSides: false });
        this.onCue(switching ? { type: "SwitchSides", step: nextStep } : { type: "StartStretch", step: nextStep, announceName: true });
      }
    }
  }

  togglePause() {
    if (this.state.phase === "COMPLETED") return;
    this.set({ isPaused: !this.state.isPaused });
  }

  skipTransition() {
    const step = this.currentStep;
    const { phase } = this.state;
    if (!step || (phase !== "PREPARE" && phase !== "TRANSITION")) return;
    this.set({ phase: "ACTIVE", remainingSec: step.durationSec, stepTotalSec: step.durationSec, isSwitchingSides: false, isRest: false });
    this.onCue({ type: "StartStretch", step, announceName: false });
  }

  next() {
    const cur = this.state;
    if (cur.phase === "COMPLETED") return;
    if (cur.phase === "TRANSITION") return this.skipTransition();
    if (cur.phase === "PREPARE") {
      // For a jump workout, Next during "Get ready" starts set 1 rather than skipping it.
      if (cur.steps[cur.currentIndex]?.isPlyo) return this.skipTransition();
      const nextIdx = cur.currentIndex + 1;
      if (nextIdx < cur.steps.length) {
        const nextStep = cur.steps[nextIdx];
        this.set({ currentIndex: nextIdx, phase: "ACTIVE", remainingSec: nextStep.durationSec, stepTotalSec: nextStep.durationSec, isSwitchingSides: false, isRest: false, isPaused: false });
        this.onCue({ type: "StartStretch", step: nextStep, announceName: true });
      } else {
        this.skipTransition();
      }
      return;
    }
    const nextIdx = cur.currentIndex + 1;
    const nextCompleted = Math.max(cur.completedSteps, cur.currentIndex + 1);
    if (nextIdx >= cur.steps.length) {
      this.set({ phase: "COMPLETED", remainingSec: 0, stepTotalSec: 0, completedSteps: nextCompleted, isSwitchingSides: false });
      this.onCue({ type: "Complete" });
      this.dispatchCompleteIfNeeded();
    } else {
      const nextStep = cur.steps[nextIdx];
      this.set({ currentIndex: nextIdx, phase: "ACTIVE", remainingSec: nextStep.durationSec, stepTotalSec: nextStep.durationSec, completedSteps: nextCompleted, isSwitchingSides: false, isRest: false, isPaused: false });
      this.onCue({ type: "StartStretch", step: nextStep, announceName: true });
    }
  }

  jumpToItem(itemIndex) {
    const cur = this.state;
    if (cur.phase === "COMPLETED" || !cur.steps.length) return;
    const targetIdx = cur.steps.findIndex((s) => s.itemIndex === itemIndex);
    if (targetIdx < 0) return;
    const t = cur.steps[targetIdx];
    this.set({ currentIndex: targetIdx, phase: "ACTIVE", remainingSec: t.durationSec, stepTotalSec: t.durationSec, isSwitchingSides: false, isRest: false, isPaused: false });
    this.onCue({ type: "StartStretch", step: t, announceName: true });
  }

  previous() {
    const cur = this.state;
    if (cur.phase === "COMPLETED" || !cur.steps.length) return;
    const elapsedInStep = cur.stepTotalSec - cur.remainingSec;
    if (cur.phase === "ACTIVE" && elapsedInStep > 3) {
      const step = this.currentStep;
      this.set({ remainingSec: step.durationSec, stepTotalSec: step.durationSec, isSwitchingSides: false });
      return;
    }
    const targetIdx = Math.max(0, cur.currentIndex - 1);
    const t = cur.steps[targetIdx];
    this.set({ currentIndex: targetIdx, phase: "ACTIVE", remainingSec: t.durationSec, stepTotalSec: t.durationSec, isSwitchingSides: false, isRest: false });
    this.onCue({ type: "StartStretch", step: t, announceName: true });
  }

  finishEarly() {
    if (this.state.phase === "COMPLETED") return;
    this.set({ phase: "COMPLETED", remainingSec: 0, stepTotalSec: 0, isSwitchingSides: false });
    this.onCue({ type: "Complete" });
    this.dispatchCompleteIfNeeded();
  }

  toggleInstructions() { this.set({ showInstructions: !this.state.showInstructions }); }
  setSavedSession(id) { this.set({ savedSessionId: id }); }
  setFeeling(f) { this.set({ feeling: f }); }

  dispatchCompleteIfNeeded() {
    if (this.completionDispatched) return;
    this.completionDispatched = true;
    this.onComplete(this.state.elapsedActiveSec, this.state.completedSteps);
  }
}
