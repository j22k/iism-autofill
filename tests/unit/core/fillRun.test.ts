import { describe, expect, it } from 'vitest';
import { reduceRun, startRun, type RunState } from '../../../src/core/fillRun';
import type { FillStep } from '../../../src/core/planner';

function step(id: string, awaitReload: boolean): FillStep {
  return { id, source: `profile.${id}`, kind: awaitReload ? 'select' : 'text', awaitReload };
}

describe('startRun', () => {
  it('finishes immediately with DONE on an empty plan', () => {
    const { state, effects } = startRun([]);
    expect(state.phase).toBe('done');
    expect(effects).toEqual([{ type: 'DONE', report: [] }]);
  });

  it('sends the first step and arms the watchdog', () => {
    const steps = [step('txtName', false)];
    const { state, effects } = startRun(steps);
    expect(state.phase).toBe('running');
    expect(state.index).toBe(0);
    expect(effects).toEqual([{ type: 'SEND_STEP', step: steps[0] }, { type: 'ARM_WATCHDOG' }]);
  });
});

describe('reduceRun — non-postback steps', () => {
  it('settles immediately on STEP_RESULT ok and advances to the next step', () => {
    const steps = [step('txtName', false), step('txtFatherName', false)];
    const { state: s0 } = startRun(steps);
    const { state, effects } = reduceRun(s0, { type: 'STEP_RESULT', id: 'txtName', status: 'ok' });

    expect(state.index).toBe(1);
    expect(state.report).toEqual([{ id: 'txtName', status: 'ok', message: undefined }]);
    expect(effects).toEqual([{ type: 'SEND_STEP', step: steps[1] }, { type: 'ARM_WATCHDOG' }]);
  });

  it('settles on a failed result too (no reload expected either way) and finishes if last', () => {
    const steps = [step('txtName', false)];
    const { state: s0 } = startRun(steps);
    const { state, effects } = reduceRun(s0, {
      type: 'STEP_RESULT',
      id: 'txtName',
      status: 'failed',
      message: 'no element',
    });

    expect(state.phase).toBe('done');
    expect(state.report).toEqual([{ id: 'txtName', status: 'failed', message: 'no element' }]);
    expect(effects).toEqual([{ type: 'DONE', report: state.report }]);
  });
});

describe('reduceRun — postback steps', () => {
  it('holds the step open on STEP_RESULT ok, waiting for the reload-confirming READY', () => {
    const steps = [step('ddlCourse', true)];
    const { state: s0 } = startRun(steps);
    const { state, effects } = reduceRun(s0, { type: 'STEP_RESULT', id: 'ddlCourse', status: 'ok' });

    expect(state.phase).toBe('running');
    expect(state.index).toBe(0); // has not advanced yet
    expect(state.report).toEqual([]);
    expect(effects).toEqual([{ type: 'ARM_WATCHDOG' }]);
  });

  it('advances once READY arrives after a held ok result', () => {
    const steps = [step('ddlCourse', true)];
    const { state: s0 } = startRun(steps);
    const { state: s1 } = reduceRun(s0, { type: 'STEP_RESULT', id: 'ddlCourse', status: 'ok' });
    const { state, effects } = reduceRun(s1, { type: 'READY' });

    expect(state.phase).toBe('done');
    expect(state.report).toEqual([{ id: 'ddlCourse', status: 'ok', message: undefined }]);
    expect(effects).toEqual([{ type: 'DONE', report: state.report }]);
  });

  it('treats a bare READY with no prior STEP_RESULT as implicit success — the content script can be torn down by the reload before it manages to report back', () => {
    const steps = [step('ddlCourse', true)];
    const { state: s0 } = startRun(steps);
    const { state, effects } = reduceRun(s0, { type: 'READY' });

    expect(state.phase).toBe('done');
    expect(state.report).toEqual([{ id: 'ddlCourse', status: 'ok' }]);
    expect(effects).toEqual([{ type: 'DONE', report: state.report }]);
  });

  it('settles immediately on a failed/skipped result without waiting for a READY, since no reload will come', () => {
    const steps = [step('ddlCourse', true)];
    const { state: s0 } = startRun(steps);
    const { state, effects } = reduceRun(s0, {
      type: 'STEP_RESULT',
      id: 'ddlCourse',
      status: 'skipped',
      message: 'no matching option',
    });

    expect(state.phase).toBe('done');
    expect(state.report).toEqual([{ id: 'ddlCourse', status: 'skipped', message: 'no matching option' }]);
    expect(effects).toEqual([{ type: 'DONE', report: state.report }]);

    // A stray READY after settling (e.g. an unrelated page event) must not re-trigger anything.
    const { state: afterStray, effects: strayEffects } = reduceRun(state, { type: 'READY' });
    expect(afterStray).toBe(state);
    expect(strayEffects).toEqual([]);
  });

  it('runs a mixed plan: non-postback then postback-with-reload end to end', () => {
    const steps = [step('txtName', false), step('ddlCourse', true)];
    const { state: s0 } = startRun(steps);
    const { state: s1 } = reduceRun(s0, { type: 'STEP_RESULT', id: 'txtName', status: 'ok' });
    expect(s1.index).toBe(1);

    const { state: s2 } = reduceRun(s1, { type: 'STEP_RESULT', id: 'ddlCourse', status: 'ok' });
    expect(s2.phase).toBe('running'); // still waiting for the reload

    const { state: s3, effects } = reduceRun(s2, { type: 'READY' });
    expect(s3.phase).toBe('done');
    expect(s3.report).toEqual([
      { id: 'txtName', status: 'ok', message: undefined },
      { id: 'ddlCourse', status: 'ok', message: undefined },
    ]);
    expect(effects).toEqual([{ type: 'DONE', report: s3.report }]);
  });
});

describe('reduceRun — watchdog timeout', () => {
  it('retries once by resending the same step', () => {
    const steps = [step('ddlCourse', true)];
    const { state: s0 } = startRun(steps);
    const { state, effects } = reduceRun(s0, { type: 'TIMEOUT' });

    expect(state.phase).toBe('running');
    expect(state.index).toBe(0);
    expect(state.retries).toBe(1);
    expect(effects).toEqual([{ type: 'SEND_STEP', step: steps[0] }, { type: 'ARM_WATCHDOG' }]);
  });

  it('fails after the retry also times out, never looping a third time', () => {
    const steps = [step('ddlCourse', true)];
    const { state: s0 } = startRun(steps);
    const { state: s1 } = reduceRun(s0, { type: 'TIMEOUT' });
    const { state, effects } = reduceRun(s1, { type: 'TIMEOUT' });

    expect(state.phase).toBe('failed');
    expect(state.report).toEqual([
      { id: 'ddlCourse', status: 'failed', message: 'Timed out waiting for the page to respond.' },
    ]);
    expect(effects).toEqual([
      { type: 'FAILED', report: state.report, message: 'Timed out on "ddlCourse".' },
    ]);
  });

  it('on timeout, re-arms without resending when the step already succeeded and is only waiting on the reload READY', () => {
    const steps = [step('ddlCourse', true)];
    const { state: s0 } = startRun(steps);
    const { state: s1 } = reduceRun(s0, { type: 'STEP_RESULT', id: 'ddlCourse', status: 'ok' });
    expect(s1.pendingResult).toEqual({ id: 'ddlCourse', status: 'ok' });

    const { state, effects } = reduceRun(s1, { type: 'TIMEOUT' });

    expect(state.phase).toBe('running');
    expect(state.index).toBe(0);
    expect(state.retries).toBe(1);
    expect(state.pendingResult).toEqual({ id: 'ddlCourse', status: 'ok' }); // still held
    expect(effects).toEqual([{ type: 'ARM_WATCHDOG' }]); // no SEND_STEP — the step already succeeded

    // If the reload's READY finally arrives after this, it still settles correctly.
    const { state: done, effects: doneEffects } = reduceRun(state, { type: 'READY' });
    expect(done.phase).toBe('done');
    expect(doneEffects).toEqual([{ type: 'DONE', report: done.report }]);
  });

  it('fails after a second timeout even while only waiting on a held ok result\'s READY, never looping a third time', () => {
    const steps = [step('ddlCourse', true)];
    const { state: s0 } = startRun(steps);
    const { state: s1 } = reduceRun(s0, { type: 'STEP_RESULT', id: 'ddlCourse', status: 'ok' });
    const { state: s2 } = reduceRun(s1, { type: 'TIMEOUT' });
    const { state, effects } = reduceRun(s2, { type: 'TIMEOUT' });

    expect(state.phase).toBe('failed');
    expect(effects).toEqual([{ type: 'FAILED', report: state.report, message: 'Timed out on "ddlCourse".' }]);
  });

  it('resets the retry count once a later step starts', () => {
    const steps = [step('txtName', false), step('ddlCourse', true)];
    const { state: s0 } = startRun(steps);
    const { state: s1 } = reduceRun(s0, { type: 'TIMEOUT' }); // retry on step 0
    expect(s1.retries).toBe(1);
    const { state: s2 } = reduceRun(s1, { type: 'STEP_RESULT', id: 'txtName', status: 'ok' });
    expect(s2.index).toBe(1);
    expect(s2.retries).toBe(0);
  });
});

describe('reduceRun — defensive ignores', () => {
  it('ignores a STEP_RESULT whose id does not match the current step', () => {
    const steps = [step('ddlCourse', true)];
    const { state: s0 } = startRun(steps);
    const { state, effects } = reduceRun(s0, { type: 'STEP_RESULT', id: 'someOtherField', status: 'ok' });

    expect(state).toBe(s0);
    expect(effects).toEqual([]);
  });

  it('ignores a READY when no reload is being awaited', () => {
    const steps = [step('txtName', false)];
    const { state: s0 } = startRun(steps);
    const { state, effects } = reduceRun(s0, { type: 'READY' });

    expect(state).toBe(s0);
    expect(effects).toEqual([]);
  });

  it('ignores any further event once the run has finished', () => {
    const { state: done } = startRun([]);
    const { state, effects } = reduceRun(done, { type: 'READY' });

    expect(state).toBe(done);
    expect(effects).toEqual([]);
  });
});

describe('resumability', () => {
  it('reduceRun is a pure function of state — a RunState snapshot (e.g. reloaded from chrome.storage.session) resumes identically', () => {
    const steps = [step('ddlCourse', true), step('txtName', false)];
    const { state: live } = reduceRun(startRun(steps).state, { type: 'STEP_RESULT', id: 'ddlCourse', status: 'ok' });

    // Simulate persisting and reloading the state as plain JSON (what chrome.storage.session
    // actually round-trips), rather than reusing the same in-memory object.
    const restored = JSON.parse(JSON.stringify(live)) as RunState;

    const fromLive = reduceRun(live, { type: 'READY' });
    const fromRestored = reduceRun(restored, { type: 'READY' });
    expect(fromRestored.state).toEqual(fromLive.state);
    expect(fromRestored.effects).toEqual(fromLive.effects);
  });
});
