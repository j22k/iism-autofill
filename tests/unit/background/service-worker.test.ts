import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFillOrchestrator, type PersistedRun, type ServiceWorkerDeps } from '../../../src/background/service-worker';
import { getFieldById } from '../../../src/core/fieldMap';
import type { Profile } from '../../../src/core/profile';
import type { BackgroundToContentMessage, BackgroundToSidePanelMessage } from '../../../src/shared/messages';
import { testBlob } from '../shared/testBlob';

const TAB_ID = 7;

function completeProfile(): Profile {
  return {
    course: { type: 'ski', level: 'Basic', batch: 'batch-1', state: 'JAMMU AND KASHMIR' },
    personal: { name: 'Test Name', fatherName: 'Father Name', nationality: 'Indian', dob: '2005-06-15', domicile: 'Testville' },
    address: { house: 'H.No. 1', street: 'Main St', city: 'Testville', pincode: '560001' },
    contact: { mobile: '9876543210', email: 'test@example.com' },
    education: { qualification: 'Graduation' },
    medical: { diet: 'Vegetarian', bloodGroup: 'O+' },
    emergency: { name: 'Emergency Contact', phone: '9876543211' },
    declaration: { agree: false },
  };
}

const ALL_DOCS = [
  'docs.dobProof',
  'docs.domicileProof',
  'docs.educationProof',
  'docs.adventureCert',
  'docs.employmentProof',
  'docs.photo',
  'docs.signature',
  'docs.guardianSignature',
];

interface TestHarness {
  deps: ServiceWorkerDeps;
  sendToTab: ReturnType<typeof vi.fn>;
  broadcast: ReturnType<typeof vi.fn>;
  getSession: () => Promise<PersistedRun | null>;
  onWatchdogFire: { current: (tabId: number) => void };
}

// Fakes the real chrome.alarms-backed watchdog (ADR-0003) with plain setTimeout, injected
// through the same armWatchdog/disarmWatchdog seam — these tests only need to pin down
// the state machine's timing/retry behavior, not exercise real alarms. The fake needs a
// reference to the orchestrator it's arming a watchdog for, which doesn't exist yet when
// deps are built — createOrchestrator() below wires onWatchdogFire.current once it does.
function createHarness(
  options: { profile?: Profile | null; docs?: string[]; sendToTab?: ServiceWorkerDeps['sendToTab'] } = {},
): TestHarness {
  const sendToTab = vi.fn(options.sendToTab ?? (async () => {}));
  const broadcast = vi.fn();
  let session: PersistedRun | null = null;
  const watchdogTimers = new Map<number, ReturnType<typeof setTimeout>>();
  const onWatchdogFire: { current: (tabId: number) => void } = { current: () => {} };

  const deps: ServiceWorkerDeps = {
    loadProfile: async () => (options.profile === undefined ? completeProfile() : options.profile),
    listDocKeys: async () => options.docs ?? ALL_DOCS,
    getDoc: async () => testBlob([1, 2, 3], 'image/png'),
    sendToTab,
    broadcast,
    getSession: async () => session,
    setSession: async (run) => {
      session = run;
    },
    armWatchdog: (tabId) => {
      const existing = watchdogTimers.get(tabId);
      if (existing !== undefined) clearTimeout(existing);
      watchdogTimers.set(
        tabId,
        setTimeout(() => onWatchdogFire.current(tabId), 60_000),
      );
    },
    disarmWatchdog: (tabId) => {
      const existing = watchdogTimers.get(tabId);
      if (existing !== undefined) {
        clearTimeout(existing);
        watchdogTimers.delete(tabId);
      }
    },
  };

  return { deps, sendToTab, broadcast, getSession: async () => session, onWatchdogFire };
}

function createOrchestrator(harness: TestHarness): ReturnType<typeof createFillOrchestrator> {
  const orchestrator = createFillOrchestrator(harness.deps);
  harness.onWatchdogFire.current = (tabId) => {
    void orchestrator.handleWatchdogFired(tabId);
  };
  return orchestrator;
}

function lastRunStep(sendToTab: ReturnType<typeof vi.fn>): BackgroundToContentMessage & { type: 'RUN_STEP' } {
  const call = sendToTab.mock.calls.at(-1);
  if (!call) throw new Error('sendToTab was never called');
  return call[1];
}

function lastStatus(broadcast: ReturnType<typeof vi.fn>): BackgroundToSidePanelMessage['status'] {
  const call = broadcast.mock.calls.at(-1);
  if (!call) throw new Error('broadcast was never called');
  return (call[0] as BackgroundToSidePanelMessage).status;
}

describe('createFillOrchestrator — startFill gating', () => {
  it('fails immediately with no profile, never sending a step', async () => {
    const harness = createHarness({ profile: null });
    const { sendToTab, broadcast } = harness;
    const orchestrator = createOrchestrator(harness);

    await orchestrator.startFill(TAB_ID);

    expect(sendToTab).not.toHaveBeenCalled();
    expect(lastStatus(broadcast)).toEqual({ phase: 'failed', message: 'No profile saved yet.', report: [] });
  });

  it('fails immediately when preflight is not ready, naming the missing field', async () => {
    const profile = completeProfile();
    profile.personal.name = '';
    const harness = createHarness({ profile });
    const { sendToTab, broadcast } = harness;
    const orchestrator = createOrchestrator(harness);

    await orchestrator.startFill(TAB_ID);

    expect(sendToTab).not.toHaveBeenCalled();
    const status = lastStatus(broadcast);
    expect(status.phase).toBe('failed');
    expect((status as { message: string }).message).toContain('txtName');
  });
});

describe('createFillOrchestrator — happy path', () => {
  it('sends the first step and broadcasts running', async () => {
    const harness = createHarness();
    const { sendToTab, broadcast } = harness;
    const orchestrator = createOrchestrator(harness);

    await orchestrator.startFill(TAB_ID);

    expect(sendToTab).toHaveBeenCalledTimes(1);
    expect(lastRunStep(sendToTab).id).toBe('ddlCourse');
    expect(lastStatus(broadcast)).toEqual({ phase: 'running' });
  });

  it('holds a postback step open on STEP_RESULT ok and only advances once READY arrives', async () => {
    const harness = createHarness();
    const { sendToTab } = harness;
    const orchestrator = createOrchestrator(harness);
    await orchestrator.startFill(TAB_ID);
    expect(lastRunStep(sendToTab).id).toBe('ddlCourse');

    await orchestrator.handleContentMessage(TAB_ID, { type: 'STEP_RESULT', id: 'ddlCourse', status: 'ok' });
    expect(sendToTab).toHaveBeenCalledTimes(1); // still waiting on the reload, no next step sent yet

    await orchestrator.handleContentMessage(TAB_ID, { type: 'READY' });
    expect(sendToTab).toHaveBeenCalledTimes(2);
    expect(lastRunStep(sendToTab).id).toBe('ddlCourseLevel');
  });

  it('drives a full plan through to DONE using the real buildPlan/reduceRun/resolveStepValue wiring', async () => {
    const harness = createHarness();
    const { sendToTab, broadcast } = harness;
    const orchestrator = createOrchestrator(harness);
    await orchestrator.startFill(TAB_ID);

    for (let i = 0; i < 40; i++) {
      const status = lastStatus(broadcast);
      if (status.phase !== 'running') break;
      const sent = lastRunStep(sendToTab);
      const def = getFieldById(sent.id);
      if (def?.postback) {
        await orchestrator.handleContentMessage(TAB_ID, { type: 'READY' });
      } else {
        await orchestrator.handleContentMessage(TAB_ID, { type: 'STEP_RESULT', id: sent.id, status: 'ok' });
      }
    }

    const finalStatus = lastStatus(broadcast);
    expect(finalStatus.phase).toBe('done');
    expect((finalStatus as { report: unknown[] }).report.length).toBeGreaterThan(0);
    expect((finalStatus as { report: { status: string }[] }).report.every((r) => r.status === 'ok')).toBe(true);
  });

  it('sends a base64 file payload for a file step, built from the stored Blob', async () => {
    const profile = completeProfile();
    const harness = createHarness({ profile, docs: ['docs.photo', 'docs.signature', 'docs.dobProof', 'docs.educationProof', 'docs.guardianSignature'] });
    const { sendToTab, broadcast } = harness;
    const orchestrator = createOrchestrator(harness);
    await orchestrator.startFill(TAB_ID);

    for (let i = 0; i < 40; i++) {
      const status = lastStatus(broadcast);
      if (status.phase !== 'running') break;
      const sent = lastRunStep(sendToTab);
      if (sent.kind === 'file') break;
      const def = getFieldById(sent.id);
      if (def?.postback) {
        await orchestrator.handleContentMessage(TAB_ID, { type: 'READY' });
      } else {
        await orchestrator.handleContentMessage(TAB_ID, { type: 'STEP_RESULT', id: sent.id, status: 'ok' });
      }
    }

    const fileStep = lastRunStep(sendToTab);
    expect(fileStep.kind).toBe('file');
    expect(fileStep.file?.mimeType).toBe('image/png');
    expect(fileStep.file?.base64).toBe(Buffer.from([1, 2, 3]).toString('base64'));
    expect(fileStep.file?.filename).toMatch(/\.png$/);
  });
});

describe('createFillOrchestrator — multi-tab isolation', () => {
  it('ignores a content message from a tab that is not the one running a fill', async () => {
    const harness = createHarness();
    const { sendToTab } = harness;
    const orchestrator = createOrchestrator(harness);
    await orchestrator.startFill(TAB_ID);
    expect(sendToTab).toHaveBeenCalledTimes(1);

    await orchestrator.handleContentMessage(999, { type: 'STEP_RESULT', id: 'ddlCourse', status: 'ok' });
    expect(sendToTab).toHaveBeenCalledTimes(1); // unaffected

    await orchestrator.handleContentMessage(999, { type: 'READY' });
    expect(sendToTab).toHaveBeenCalledTimes(1);
  });

  it('ignores a content message when no run is in progress at all', async () => {
    const harness = createHarness();
    const { sendToTab } = harness;
    const orchestrator = createOrchestrator(harness);

    await orchestrator.handleContentMessage(TAB_ID, { type: 'READY' });
    expect(sendToTab).not.toHaveBeenCalled();
  });
});

describe('createFillOrchestrator — watchdog', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('retries once by resending the same step after 60s of silence', async () => {
    const harness = createHarness();
    const { sendToTab } = harness;
    const orchestrator = createOrchestrator(harness);
    await orchestrator.startFill(TAB_ID);
    expect(sendToTab).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(60_000);

    expect(sendToTab).toHaveBeenCalledTimes(2);
    expect(lastRunStep(sendToTab).id).toBe('ddlCourse'); // same step, resent
  });

  it('fails and clears the session after the retry also times out', async () => {
    const harness = createHarness();
    const { sendToTab, broadcast } = harness;
    const orchestrator = createOrchestrator(harness);
    await orchestrator.startFill(TAB_ID);

    await vi.advanceTimersByTimeAsync(60_000); // 1st timeout -> retry
    await vi.advanceTimersByTimeAsync(60_000); // 2nd timeout -> fail

    expect(sendToTab).toHaveBeenCalledTimes(2); // no third send
    const status = lastStatus(broadcast);
    expect(status.phase).toBe('failed');
    expect((status as { message: string }).message).toContain('ddlCourse');
    expect(await harness.getSession()).toBeNull();
  });

  it('disarms the previous watchdog so a stale timer never fires after the run has already finished', async () => {
    const harness = createHarness();
    const { sendToTab, broadcast } = harness;
    const orchestrator = createOrchestrator(harness);
    await orchestrator.startFill(TAB_ID);

    // Resolve the step quickly (well before the 60s watchdog would fire) and let the
    // whole plan run to completion.
    for (let i = 0; i < 40; i++) {
      const status = lastStatus(broadcast);
      if (status.phase !== 'running') break;
      const sent = lastRunStep(sendToTab);
      const def = getFieldById(sent.id);
      if (def?.postback) {
        await orchestrator.handleContentMessage(TAB_ID, { type: 'READY' });
      } else {
        await orchestrator.handleContentMessage(TAB_ID, { type: 'STEP_RESULT', id: sent.id, status: 'ok' });
      }
    }
    expect(lastStatus(broadcast).phase).toBe('done');
    const broadcastCountAtDone = broadcast.mock.calls.length;

    await vi.advanceTimersByTimeAsync(60_000); // would have been the watchdog, if still armed

    expect(broadcast.mock.calls.length).toBe(broadcastCountAtDone); // nothing new fired
  });

  it('does not resend an already-succeeded postback step on timeout, only re-arms and waits for READY', async () => {
    const harness = createHarness();
    const { sendToTab, broadcast } = harness;
    const orchestrator = createOrchestrator(harness);
    await orchestrator.startFill(TAB_ID);
    expect(lastRunStep(sendToTab).id).toBe('ddlCourse');

    await orchestrator.handleContentMessage(TAB_ID, { type: 'STEP_RESULT', id: 'ddlCourse', status: 'ok' });
    expect(sendToTab).toHaveBeenCalledTimes(1); // holding, waiting for the reload's READY

    await vi.advanceTimersByTimeAsync(60_000); // the reload is just slow, not stuck

    expect(sendToTab).toHaveBeenCalledTimes(1); // still no resend — ddlCourse already succeeded
    expect(lastStatus(broadcast)).toEqual({ phase: 'running' });

    await orchestrator.handleContentMessage(TAB_ID, { type: 'READY' }); // the slow reload finally arrives
    expect(sendToTab).toHaveBeenCalledTimes(2);
    expect(lastRunStep(sendToTab).id).toBe('ddlCourseLevel');
  });

  it('turns a sendToTab rejection during a retry into a failed step result instead of crashing the effects loop', async () => {
    let callCount = 0;
    const sendToTab = vi.fn(async () => {
      callCount += 1;
      if (callCount === 2) {
        throw new Error('Could not establish connection. Receiving end does not exist.');
      }
    });
    const harness = createHarness({ sendToTab });
    const orchestrator = createOrchestrator(harness);
    await orchestrator.startFill(TAB_ID);
    expect(sendToTab).toHaveBeenCalledTimes(1);

    // Watchdog fires -> retry resend (call #2) -> rejects, mid-navigation-style.
    await vi.advanceTimersByTimeAsync(60_000);

    // Must not have thrown (an unhandled rejection would otherwise abort this loop) and
    // must have moved on: ddlCourse recorded as failed, and the next step already sent
    // with a fresh watchdog armed, rather than leaving the run stuck with none.
    expect(sendToTab).toHaveBeenCalledTimes(3);
    const persisted = await harness.getSession();
    expect(persisted?.run.report).toEqual([
      { id: 'ddlCourse', status: 'failed', message: 'Could not reach the page: Could not establish connection. Receiving end does not exist.' },
    ]);
    expect(persisted?.run.phase).toBe('running');
  });
});

describe('createFillOrchestrator — resuming after a fresh instance (simulating SW eviction/restart)', () => {
  it('a brand-new orchestrator continues correctly once it reads the persisted session', async () => {
    let session: PersistedRun | null = null;
    const sendToTab = vi.fn(async () => {});
    const broadcast = vi.fn();
    const watchdogTimers = new Map<number, ReturnType<typeof setTimeout>>();
    const baseDeps: Omit<ServiceWorkerDeps, 'getSession' | 'setSession'> = {
      loadProfile: async () => completeProfile(),
      listDocKeys: async () => ALL_DOCS,
      getDoc: async () => testBlob([1, 2, 3], 'image/png'),
      sendToTab,
      broadcast,
      // Unused by this test (it drives the run via handleContentMessage, never lets the
      // watchdog fire) but still needs a real implementation to satisfy ServiceWorkerDeps.
      armWatchdog: (tabId) => {
        watchdogTimers.set(tabId, setTimeout(() => {}, 60_000));
      },
      disarmWatchdog: (tabId) => {
        const existing = watchdogTimers.get(tabId);
        if (existing !== undefined) clearTimeout(existing);
      },
    };
    const sharedStorage: Pick<ServiceWorkerDeps, 'getSession' | 'setSession'> = {
      getSession: async () => session,
      setSession: async (run) => {
        session = run;
      },
    };

    const first = createFillOrchestrator({ ...baseDeps, ...sharedStorage });
    await first.startFill(TAB_ID);
    expect(lastRunStep(sendToTab).id).toBe('ddlCourse');

    // Simulate the service worker being evicted and a fresh one taking over — a new
    // orchestrator instance, sharing only the persisted storage.
    const second = createFillOrchestrator({ ...baseDeps, ...sharedStorage });
    await second.handleContentMessage(TAB_ID, { type: 'READY' }); // the reload's READY, after ddlCourse's postback

    expect(sendToTab).toHaveBeenCalledTimes(2);
    expect(lastRunStep(sendToTab).id).toBe('ddlCourseLevel');
  });
});
