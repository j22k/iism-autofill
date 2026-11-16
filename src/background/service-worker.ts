// Orchestrates the fill run and persists run state across content-script reloads
// (docs/03-architecture.md). The actual decision logic (what to send next, when to
// retry, when to give up) is core/fillRun.ts's pure reducer — this file is only the
// thin wiring that executes its effects against real chrome APIs: loading the
// profile/docs, pushing RUN_STEP to the tab, persisting {tabId, run} to
// chrome.storage.session so a fresh service-worker instance (evicted mid-run, or just
// restarted) can pick up exactly where it left off the moment the next READY/
// STEP_RESULT/TIMEOUT arrives — reduceRun doesn't care whether its RunState argument
// came from memory or was just read back from storage.
import { isAdmissionUrl } from '../core/pageDetect';
import { extensionForMimeType } from '../core/image';
import { buildPlan, GUARDIAN_DOC, preflight, SIGNATURE_DOC, type FillStep } from '../core/planner';
import { reduceRun, startRun, type RunEffect, type RunEvent, type RunState } from '../core/fillRun';
import { resolveStepValue } from '../core/resolveStepValue';
import type { Profile } from '../core/profile';
import { getDoc, listDocKeys } from '../shared/db';
import { blobToBase64 } from '../shared/fileTransfer';
import { loadProfile } from '../shared/storage';
import type {
  BackgroundToContentMessage,
  BackgroundToSidePanelMessage,
  ContentToBackgroundMessage,
  RunStepMessage,
  SidePanelToBackgroundMessage,
} from '../shared/messages';

const SESSION_KEY = 'fillRun';

export interface PersistedRun {
  tabId: number;
  run: RunState;
}

export interface ServiceWorkerDeps {
  loadProfile: () => Promise<Profile | null>;
  listDocKeys: () => Promise<string[]>;
  getDoc: (key: string) => Promise<Blob | null>;
  sendToTab: (tabId: number, message: BackgroundToContentMessage) => Promise<void>;
  broadcast: (message: BackgroundToSidePanelMessage) => void;
  getSession: () => Promise<PersistedRun | null>;
  setSession: (run: PersistedRun | null) => Promise<void>;
  // Backed by chrome.alarms in production (ADR-0003), not setTimeout — a plain in-memory
  // timer is destroyed the moment MV3 evicts an idle service worker (well under the 60s
  // watchdog window), which would strand a run at phase:'running' forever with nothing
  // left to time it out. Keyed by tabId so re-arming (e.g. on retry) replaces, not stacks,
  // any still-pending watchdog for that tab.
  armWatchdog: (tabId: number) => Promise<void> | void;
  disarmWatchdog: (tabId: number) => Promise<void> | void;
  // C8: a plain tab reload, never chrome.tabs.sendMessage'ing the page to click its own
  // btnReset (Hard Rule 7).
  reloadTab: (tabId: number) => Promise<void>;
}

async function buildRunStepMessage(
  step: FillStep,
  profile: Profile,
  getDocFn: ServiceWorkerDeps['getDoc'],
): Promise<RunStepMessage> {
  if (step.kind !== 'file') {
    return { type: 'RUN_STEP', id: step.id, kind: step.kind, value: resolveStepValue(profile, step) };
  }
  const blob =
    (await getDocFn(step.source)) ?? (step.source === GUARDIAN_DOC ? await getDocFn(SIGNATURE_DOC) : null);
  if (!blob) {
    // Shouldn't happen — buildPlan only emits a file step when availableDocs already
    // has it — but if the doc vanished between planning and sending (e.g. "Clear all
    // data" mid-run), send it with no payload; executeStep reports that as a clean
    // "failed" rather than the service worker guessing at a substitute.
    return { type: 'RUN_STEP', id: step.id, kind: step.kind, value: null };
  }
  const base64 = await blobToBase64(blob);
  // options/documents.ts always stores an actual File (which does have .name), so this
  // fallback is defensive-only against a bare Blob and currently unreachable in practice.
  const namedBlob = blob as Blob & { name?: string };
  const filename = namedBlob.name || `${step.id}.${extensionForMimeType(blob.type)}`;
  return { type: 'RUN_STEP', id: step.id, kind: step.kind, value: null, file: { base64, mimeType: blob.type, filename } };
}

export function createFillOrchestrator(deps: ServiceWorkerDeps) {
  // Serializes the four operations below per tabId. Each one reads chrome.storage.session
  // and conditionally writes it back — without this, two concurrent calls for the same
  // tab (e.g. a RESET click arriving while a STEP_RESULT is mid-flight) can both read the
  // same pre-write session, and the later write silently clobbers the earlier one. The
  // specific case this was written for: handleContentMessage reads the still-running
  // session, then reset() reads that same session and clears it — but
  // handleContentMessage's own dispatch() finishes afterwards and re-persists the
  // (now-stale) running state it already had in hand, resurrecting a run the user just
  // cancelled. Queuing each call behind the previous one for that tabId (regardless of
  // success/failure) closes this without needing a storage-level compare-and-swap.
  const tabLocks = new Map<number, Promise<unknown>>();

  function withTabLock<T>(tabId: number, fn: () => Promise<T>): Promise<T> {
    const previous = tabLocks.get(tabId) ?? Promise.resolve();
    const settled = previous.then(fn, fn);
    tabLocks.set(tabId, settled.then(undefined, () => undefined));
    return settled;
  }

  async function finish(tabId: number): Promise<void> {
    await deps.disarmWatchdog(tabId);
    await deps.setSession(null);
  }

  async function applyEffects(tabId: number, run: RunState, effects: RunEffect[]): Promise<void> {
    for (const effect of effects) {
      switch (effect.type) {
        case 'SEND_STEP': {
          const profile = await deps.loadProfile();
          if (!profile) {
            await finish(tabId);
            deps.broadcast({
              type: 'RUN_STATUS',
              status: { phase: 'failed', message: 'Profile was cleared while a fill run was in progress.', report: run.report },
            });
            return;
          }
          const message = await buildRunStepMessage(effect.step, profile, deps.getDoc);
          try {
            await deps.sendToTab(tabId, message);
          } catch (error) {
            // The tab can be unreachable for entirely expected reasons — mid-navigation
            // during a postback is exactly when a retry resend is most likely to land.
            // Treat it as this one step failing rather than letting the rejection escape
            // this loop unhandled: an uncaught throw here would skip the ARM_WATCHDOG
            // effect still queued after this one, leaving the already-persisted
            // {tabId, run} stuck at phase:'running' with no watchdog left to time it out.
            const reason = error instanceof Error ? error.message : String(error);
            await dispatch(tabId, run, {
              type: 'STEP_RESULT',
              id: effect.step.id,
              status: 'failed',
              message: `Could not reach the page: ${reason}`,
            });
            return;
          }
          break;
        }
        case 'ARM_WATCHDOG':
          await deps.armWatchdog(tabId);
          break;
        case 'DONE':
          await finish(tabId);
          deps.broadcast({ type: 'RUN_STATUS', status: { phase: 'done', report: effect.report } });
          return;
        case 'FAILED':
          await finish(tabId);
          deps.broadcast({ type: 'RUN_STATUS', status: { phase: 'failed', message: effect.message, report: effect.report } });
          return;
      }
    }
  }

  async function dispatch(tabId: number, run: RunState, event: RunEvent): Promise<void> {
    const { state, effects } = reduceRun(run, event);
    if (state.phase === 'running') {
      await deps.setSession({ tabId, run: state });
      deps.broadcast({ type: 'RUN_STATUS', status: { phase: 'running' } });
    }
    await applyEffects(tabId, state, effects);
  }

  async function handleWatchdogFiredImpl(tabId: number): Promise<void> {
    const persisted = await deps.getSession();
    if (!persisted || persisted.tabId !== tabId) {
      return; // run already finished (or belongs to a different tab) — stale alarm
    }
    await dispatch(tabId, persisted.run, { type: 'TIMEOUT' });
  }

  async function startFillImpl(tabId: number): Promise<void> {
    const profile = await deps.loadProfile();
    if (!profile) {
      deps.broadcast({ type: 'RUN_STATUS', status: { phase: 'failed', message: 'No profile saved yet.', report: [] } });
      return;
    }
    const availableDocs = new Set(await deps.listDocKeys());
    const check = preflight(profile, availableDocs);
    if (!check.ready) {
      const missing = [...check.missingFields, ...check.missingDocs].join(', ');
      deps.broadcast({
        type: 'RUN_STATUS',
        status: { phase: 'failed', message: `Missing required before filling: ${missing}`, report: [] },
      });
      return;
    }

    const steps = buildPlan(profile, availableDocs);
    const { state, effects } = startRun(steps);
    if (state.phase === 'running') {
      await deps.setSession({ tabId, run: state });
    }
    deps.broadcast({ type: 'RUN_STATUS', status: { phase: 'running' } });
    await applyEffects(tabId, state, effects);
  }

  // Cancels this tab's own in-progress run, if any — a run belonging to a different tab
  // (multi-tab isolation, same as handleContentMessage) is left alone — then reloads it.
  // A plain reload clears whatever the user had typed/selected without ever touching the
  // site's own btnReset, and leaving a cancelled run's session behind would have the next
  // READY (from the reload this very call triggers) resurrect a run that's meant to be over.
  async function resetImpl(tabId: number): Promise<void> {
    const persisted = await deps.getSession();
    if (persisted && persisted.tabId === tabId) {
      await finish(tabId);
    }
    await deps.reloadTab(tabId);
  }

  async function handleContentMessageImpl(tabId: number, message: ContentToBackgroundMessage): Promise<void> {
    const persisted = await deps.getSession();
    if (!persisted || persisted.tabId !== tabId) {
      return; // no run in progress for this tab — e.g. a page load with no Autofill requested
    }
    const event: RunEvent =
      message.type === 'READY'
        ? { type: 'READY' }
        : {
            type: 'STEP_RESULT',
            id: message.id,
            status: message.status,
            ...(message.message !== undefined ? { message: message.message } : {}),
          };
    await dispatch(tabId, persisted.run, event);
  }

  return {
    startFill: (tabId: number) => withTabLock(tabId, () => startFillImpl(tabId)),
    handleContentMessage: (tabId: number, message: ContentToBackgroundMessage) =>
      withTabLock(tabId, () => handleContentMessageImpl(tabId, message)),
    handleWatchdogFired: (tabId: number) => withTabLock(tabId, () => handleWatchdogFiredImpl(tabId)),
    reset: (tabId: number) => withTabLock(tabId, () => resetImpl(tabId)),
  };
}

const WATCHDOG_ALARM_PREFIX = 'fillRunWatchdog:';
// 1 minute = docs/03-architecture.md's "60s" watchdog window, and comfortably above
// Chrome's ~30s floor on a packed extension's minimum alarm delay (ADR-0003).
const WATCHDOG_DELAY_MINUTES = 1;

function watchdogAlarmName(tabId: number): string {
  return `${WATCHDOG_ALARM_PREFIX}${tabId}`;
}

function createRealDeps(): ServiceWorkerDeps {
  return {
    loadProfile,
    listDocKeys,
    getDoc,
    sendToTab: async (tabId, message) => {
      await chrome.tabs.sendMessage(tabId, message);
    },
    broadcast: (message) => {
      // No listener (side panel closed) is not an error — swallow it rather than let
      // an unhandled rejection surface for something nobody needed to hear.
      void chrome.runtime.sendMessage(message).catch(() => {});
    },
    getSession: async () => {
      const result = await chrome.storage.session.get(SESSION_KEY);
      return (result[SESSION_KEY] as PersistedRun | undefined) ?? null;
    },
    setSession: async (run) => {
      if (run === null) {
        await chrome.storage.session.remove(SESSION_KEY);
      } else {
        await chrome.storage.session.set({ [SESSION_KEY]: run });
      }
    },
    // chrome.alarms, not setTimeout (ADR-0003) — survives the service worker being
    // evicted while a run waits on a postback's READY. The alarm is identified by name,
    // not an in-memory handle, so it (and the watchdog it represents) outlives this
    // particular worker instance; handleWatchdogFired re-derives everything it needs from
    // chrome.storage.session when it fires, whether that's in this instance or a fresh one.
    armWatchdog: async (tabId) => {
      await chrome.alarms.create(watchdogAlarmName(tabId), { delayInMinutes: WATCHDOG_DELAY_MINUTES });
    },
    disarmWatchdog: async (tabId) => {
      await chrome.alarms.clear(watchdogAlarmName(tabId));
    },
    reloadTab: async (tabId) => {
      await chrome.tabs.reload(tabId);
    },
  };
}

// Guarded the same way as content/index.ts: `chrome` is undefined at plain
// module-import time under this file's own unit tests, which call
// createFillOrchestrator(...) directly against injected deps instead.
if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
  const orchestrator = createFillOrchestrator(createRealDeps());
  // Registered unconditionally at module load (same pattern as the onMessage listener
  // below) so a fresh service-worker instance — started specifically to deliver this
  // alarm after the previous instance was evicted — still catches it.
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (!alarm.name.startsWith(WATCHDOG_ALARM_PREFIX)) {
      return;
    }
    const tabId = Number(alarm.name.slice(WATCHDOG_ALARM_PREFIX.length));
    void orchestrator.handleWatchdogFired(tabId);
  });
  async function activeAdmissionTabId(): Promise<number | null> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !isAdmissionUrl(tab.url)) {
      return null;
    }
    return tab.id;
  }

  chrome.runtime.onMessage.addListener((message: SidePanelToBackgroundMessage | ContentToBackgroundMessage, sender) => {
    if (message.type === 'START_FILL') {
      void (async () => {
        const tabId = await activeAdmissionTabId();
        if (tabId === null) {
          void chrome.runtime
            .sendMessage({
              type: 'RUN_STATUS',
              status: { phase: 'failed', message: 'Open the IISM admission form page first.', report: [] },
            })
            .catch(() => {});
          return;
        }
        await orchestrator.startFill(tabId);
      })();
      return;
    }
    if (message.type === 'RESET') {
      void (async () => {
        const tabId = await activeAdmissionTabId();
        if (tabId === null) {
          return; // nothing on the admission form to reset
        }
        await orchestrator.reset(tabId);
      })();
      return;
    }
    const tabId = sender.tab?.id;
    if (tabId === undefined) {
      return; // READY/STEP_RESULT only ever come from the content script, which always has a tab
    }
    void orchestrator.handleContentMessage(tabId, message);
  });
}
