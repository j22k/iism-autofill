// Pure fill-run state machine (docs/03-architecture.md's "Fill run state machine").
// Knows nothing about chrome.*, tabs, or storage — it only turns (state, event) into
// (next state, effects to perform). The service worker (T-032's thin wiring layer)
// executes those effects and feeds results back in as events. Because this is a pure
// function of its inputs, "resume after reload" is just "call reduceRun with whatever
// RunState was persisted" — no separate resume code path is needed (see the
// `resumability` describe block in the test file).
import type { FillStep } from './planner';

export type StepStatus = 'ok' | 'skipped' | 'failed';

export interface StepReport {
  id: string;
  status: StepStatus;
  message?: string;
}

export type RunEvent =
  | { type: 'READY' }
  | { type: 'STEP_RESULT'; id: string; status: StepStatus; message?: string }
  | { type: 'TIMEOUT' };

export type RunEffect =
  | { type: 'SEND_STEP'; step: FillStep }
  | { type: 'ARM_WATCHDOG' }
  | { type: 'DONE'; report: StepReport[] }
  | { type: 'FAILED'; report: StepReport[]; message: string };

export interface RunState {
  steps: readonly FillStep[];
  index: number;
  retries: number;
  report: StepReport[];
  phase: 'running' | 'done' | 'failed';
  // Set as soon as a step with awaitReload===true is sent — not only after seeing an
  // "ok" result — because the page's postback can tear down the content script before
  // it gets a chance to report back at all. A bare READY must still count as implicit
  // success in that race; see `pendingResult` below for the case where the explicit
  // result DOES arrive first.
  awaitingReload: boolean;
  // An explicit STEP_RESULT already received for the current awaitReload step, held
  // until the reload-confirming READY arrives (or used as-is if the result turns out
  // not to need a reload after all, e.g. a failed dropdown match that never posts back).
  pendingResult: StepReport | null;
}

export interface RunResult {
  state: RunState;
  effects: RunEffect[];
}

const MAX_RETRIES = 1;

// noUncheckedIndexedAccess makes `steps[index]` read as FillStep | undefined even
// right after a bounds check — this centralizes the one real invariant (every index
// this module ever hands to `steps[...]` was already bounds-checked) instead of
// scattering non-null assertions, and still fails loudly if that invariant is ever
// broken rather than silently asserting past a real bug.
function requireStep(steps: readonly FillStep[], index: number): FillStep {
  const step = steps[index];
  if (!step) {
    throw new Error(`fillRun: step index ${index} out of bounds (steps.length=${steps.length})`);
  }
  return step;
}

function enterStep(steps: readonly FillStep[], index: number, report: StepReport[], retries = 0): RunResult {
  if (index >= steps.length) {
    const state: RunState = { steps, index, retries: 0, report, phase: 'done', awaitingReload: false, pendingResult: null };
    return { state, effects: [{ type: 'DONE', report }] };
  }
  const step = requireStep(steps, index);
  const state: RunState = { steps, index, retries, report, phase: 'running', awaitingReload: step.awaitReload, pendingResult: null };
  return { state, effects: [{ type: 'SEND_STEP', step }, { type: 'ARM_WATCHDOG' }] };
}

export function startRun(steps: readonly FillStep[]): RunResult {
  return enterStep(steps, 0, []);
}

function currentStep(state: RunState): FillStep {
  return requireStep(state.steps, state.index);
}

function settle(state: RunState, result: StepReport): RunResult {
  return enterStep(state.steps, state.index + 1, [...state.report, result]);
}

export function reduceRun(state: RunState, event: RunEvent): RunResult {
  if (state.phase !== 'running') {
    return { state, effects: [] };
  }
  const step = currentStep(state);

  switch (event.type) {
    case 'STEP_RESULT': {
      if (event.id !== step.id) {
        return { state, effects: [] }; // stale/mismatched result — ignore
      }
      const result: StepReport = { id: step.id, status: event.status, ...(event.message !== undefined ? { message: event.message } : {}) };
      if (!state.awaitingReload || event.status !== 'ok') {
        // Either this step never expected a reload, or it failed/was skipped before
        // one could happen — either way, no reload is coming; settle now.
        return settle(state, result);
      }
      // Succeeded and a reload is expected imminently — hold the result and keep
      // waiting for the READY that confirms it actually happened.
      return { state: { ...state, pendingResult: result }, effects: [{ type: 'ARM_WATCHDOG' }] };
    }
    case 'READY': {
      if (!state.awaitingReload) {
        return { state, effects: [] }; // not expecting a reload right now — ignore
      }
      return settle(state, state.pendingResult ?? { id: step.id, status: 'ok' });
    }
    case 'TIMEOUT': {
      if (state.retries < MAX_RETRIES) {
        // The step itself already succeeded (pendingResult holds an 'ok') and we're only
        // waiting on the reload-confirming READY — resending SEND_STEP would reapply the
        // value and redispatch `change` on a field that's already correct, risking a second
        // genuine postback trigger if it lands mid-navigation. Just keep waiting.
        if (state.pendingResult?.status === 'ok') {
          const state2: RunState = { ...state, retries: state.retries + 1 };
          return { state: state2, effects: [{ type: 'ARM_WATCHDOG' }] };
        }
        const state2: RunState = { ...state, retries: state.retries + 1, awaitingReload: step.awaitReload, pendingResult: null };
        return { state: state2, effects: [{ type: 'SEND_STEP', step }, { type: 'ARM_WATCHDOG' }] };
      }
      const result: StepReport = { id: step.id, status: 'failed', message: 'Timed out waiting for the page to respond.' };
      const report = [...state.report, result];
      const failed: RunState = { ...state, report, phase: 'failed' };
      return { state: failed, effects: [{ type: 'FAILED', report, message: `Timed out on "${step.id}".` }] };
    }
  }
}
