// Side panel shell (E1, C1): page-detected status, profile dropdown, Autofill/Reset
// buttons. T-032 wires Autofill to a real fill run (C2-C6) via START_FILL/RUN_STATUS
// (src/shared/messages.ts); T-033 adds the structured per-field report (C7) — a summary
// line plus one row per field, shown on both a completed run and a failed one's partial
// progress. T-034 wires Reset to a real tab reload (C8, never the site's own btnReset —
// Hard Rule 7) and adds the pre-flight checklist (C11).
import { isAdmissionUrl } from '../core/pageDetect';
import { formatSummary, labelForStepId, summarizeReport } from '../core/fillReport';
import type { StepReport } from '../core/fillRun';
import { courseWarnings } from '../core/courseWarnings';
import { buildPlan, preflight } from '../core/planner';
import { getByPath } from '../core/fieldMap';
import { preflightChecklist } from '../core/preflightChecklist';
import { createEmptyProfile, mergeProfile, profileDisplayName } from '../core/profile';
import { listDocKeys } from '../shared/db';
import { loadProfile } from '../shared/storage';
import type {
  BackgroundToSidePanelMessage,
  CheckPageMessage,
  HighlightRequiredMessage,
  PageCheckResponse,
  ResetMessage,
  StartFillMessage,
} from '../shared/messages';

// Listeners registered by the most recent initSidePanel() call, so a second call on
// the same page (there's no real use case today, but the function is exported and
// callable directly, including by tests) removes the old ones instead of
// accumulating listeners that close over now-detached DOM nodes.
let activeListeners: {
  onActivated: (activeInfo: chrome.tabs.TabActiveInfo) => void;
  onUpdated: (tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => void;
  onMessage: (message: BackgroundToSidePanelMessage) => void;
} | null = null;

export async function initSidePanel(root: HTMLElement): Promise<void> {
  if (activeListeners) {
    chrome.tabs.onActivated.removeListener(activeListeners.onActivated);
    chrome.tabs.onUpdated.removeListener(activeListeners.onUpdated);
    chrome.runtime.onMessage.removeListener(activeListeners.onMessage);
    activeListeners = null;
  }

  root.innerHTML = '';

  const status = document.createElement('p');
  status.dataset.role = 'status';
  root.appendChild(status);

  const profileLabel = document.createElement('label');
  profileLabel.htmlFor = 'profile-select';
  profileLabel.textContent = 'Profile';
  root.appendChild(profileLabel);

  const profileSelect = document.createElement('select');
  profileSelect.id = 'profile-select';
  profileSelect.dataset.role = 'profile-select';
  // Only ever one profile right now (multi-profile switching is A4/T-041) — disabled
  // since there's nothing yet to switch between.
  profileSelect.disabled = true;
  root.appendChild(profileSelect);

  const autofillButton = document.createElement('button');
  autofillButton.type = 'button';
  autofillButton.textContent = 'Autofill';
  autofillButton.disabled = true;
  autofillButton.dataset.action = 'autofill';
  root.appendChild(autofillButton);

  const resetButton = document.createElement('button');
  resetButton.type = 'button';
  resetButton.textContent = 'Reset';
  resetButton.disabled = true;
  resetButton.dataset.action = 'reset';
  root.appendChild(resetButton);

  const previewButton = document.createElement('button');
  previewButton.type = 'button';
  previewButton.textContent = 'Preview (dry run)';
  previewButton.dataset.action = 'preview';
  root.appendChild(previewButton);

  const drift = document.createElement('p');
  drift.dataset.role = 'drift';
  drift.setAttribute('role', 'alert');
  root.appendChild(drift);

  const previewList = document.createElement('ul');
  previewList.dataset.role = 'preview';
  root.appendChild(previewList);

  // C9: shows what Autofill WOULD write, in order, without touching the page.
  previewButton.addEventListener('click', () => {
    void (async () => {
      previewList.innerHTML = '';
      const rawProfile = await loadProfile();
      const profile = rawProfile ? mergeProfile(createEmptyProfile(), rawProfile) : createEmptyProfile();
      const docs = new Set(await listDocKeys());
      for (const step of buildPlan(profile, docs)) {
        const li = document.createElement('li');
        const value = step.kind === 'file' ? '(file)' : String(getByPath(profile, step.source) ?? '');
        li.textContent = `${labelForStepId(step.id)}: ${value}`;
        previewList.appendChild(li);
      }
    })();
  });

  const preflightSection = document.createElement('div');
  preflightSection.dataset.role = 'preflight';
  root.appendChild(preflightSection);

  // C11: a checklist the user can see before ever clicking Autofill, not only the
  // reactive failure message startFill already sends if they click it anyway while
  // incomplete (src/background/service-worker.ts's own preflight check). Computed once
  // at init (profile/docs only change via the options page, a separate page context),
  // matching renderProfile's own refresh grain just below.
  async function renderPreflight(): Promise<void> {
    preflightSection.innerHTML = '';
    const rawProfile = await loadProfile();
    const profile = rawProfile ? mergeProfile(createEmptyProfile(), rawProfile) : createEmptyProfile();
    const availableDocs = new Set(await listDocKeys());
    const result = preflight(profile, availableDocs);

    for (const w of courseWarnings(profile)) {
      const note = document.createElement('p');
      note.dataset.role = 'course-warning';
      note.textContent = w;
      preflightSection.appendChild(note);
    }

    const missingCount = result.missingFields.length + result.missingDocs.length;
    const meter = document.createElement('p');
    meter.dataset.role = 'completeness';
    meter.textContent = missingCount === 0 ? 'Profile complete.' : `${missingCount} required item(s) missing.`;
    preflightSection.appendChild(meter);

    const summary = document.createElement('p');
    summary.textContent = result.ready
      ? 'All required fields and documents are present.'
      : 'Missing required before filling:';
    preflightSection.appendChild(summary);

    if (!result.ready) {
      const list = document.createElement('ul');
      for (const item of preflightChecklist(result)) {
        const li = document.createElement('li');
        li.dataset.kind = item.kind;
        li.textContent = item.label;
        list.appendChild(li);
      }
      preflightSection.appendChild(list);
    }
  }

  const fillStatus = document.createElement('p');
  fillStatus.dataset.role = 'fill-status';
  // A screen-reader user may well have the panel open from before the run started —
  // role="status"/aria-live announces the summary the moment it changes, instead of
  // requiring them to know to go re-read the panel after a run finishes.
  fillStatus.setAttribute('role', 'status');
  fillStatus.setAttribute('aria-live', 'polite');
  root.appendChild(fillStatus);

  const fillReport = document.createElement('ul');
  fillReport.dataset.role = 'fill-report';
  root.appendChild(fillReport);

  // Per-field detail (C7) — shown alongside the one-line summary on both a completed run
  // and a failed one's partial progress; cleared while a run is in progress or hasn't
  // started yet, so a stale report never lingers under a fresh "Running…".
  function renderReport(report: readonly StepReport[]): void {
    fillReport.innerHTML = '';
    for (const entry of report) {
      const item = document.createElement('li');
      item.dataset.fieldId = entry.id;
      item.dataset.status = entry.status;
      const label = labelForStepId(entry.id);
      item.textContent = entry.message ? `${label}: ${entry.status} (${entry.message})` : `${label}: ${entry.status}`;
      fillReport.appendChild(item);
    }
  }

  // Tracks the form-readiness half of Autofill's disabled state separately from the
  // run-in-progress half (set by the RUN_STATUS handler below) so neither overwrites the
  // other — e.g. a RUN_STATUS "done" arriving shouldn't re-enable Autofill on a tab that
  // has since navigated away from the admission form.
  let formReady = false;
  let runInProgress = false;

  function syncAutofillDisabled(): void {
    autofillButton.disabled = !formReady || runInProgress;
  }

  async function refreshStatus(): Promise<void> {
    // tab.url is only populated when this extension has permission for that tab's URL
    // (manifest.json's host_permissions, matched by hostname — no `tabs` permission
    // needed or held). For any other tab it comes back undefined, which
    // isAdmissionUrl correctly treats as not-ready.
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    formReady = isAdmissionUrl(tab?.url);
    status.textContent = formReady ? 'On the IISM admission form.' : 'Not on the IISM admission form — open it to use Autofill.';
    syncAutofillDisabled();
    // Unlike Autofill, Reset stays enabled during a run — bailing out of a stuck/running
    // fill (by reloading the page) is its most useful case, not something to block.
    resetButton.disabled = !formReady;
    drift.textContent = '';
    if (formReady && tab?.id !== undefined) {
      const check: CheckPageMessage = { type: 'CHECK_PAGE' };
      try {
        const res = (await chrome.tabs.sendMessage(tab.id, check)) as PageCheckResponse | undefined;
        if (res?.missing && res.missing.length > 0) {
          drift.textContent = `Warning: the form has changed - ${res.missing.length} expected field(s) not found: ${res.missing
            .map(labelForStepId)
            .join(', ')}. Check those by hand.`;
        }
      } catch {
        // content script not injected yet (page still loading) - nothing to report
      }
    }
  }

  autofillButton.addEventListener('click', () => {
    fillStatus.textContent = 'Running…';
    renderReport([]);
    runInProgress = true;
    syncAutofillDisabled();
    const message: StartFillMessage = { type: 'START_FILL' };
    void chrome.runtime.sendMessage(message).catch(() => {});
  });

  resetButton.addEventListener('click', () => {
    fillStatus.textContent = '';
    renderReport([]);
    runInProgress = false;
    syncAutofillDisabled();
    const message: ResetMessage = { type: 'RESET' };
    void chrome.runtime.sendMessage(message).catch(() => {});
  });

  async function renderProfile(): Promise<void> {
    profileSelect.innerHTML = '';
    const rawProfile = await loadProfile();
    // Merge only when something was actually saved — this still guards against a
    // stale/partial stored shape (e.g. a missing `personal` section) before
    // profileDisplayName reads `.personal.name`, without losing the "nothing saved
    // yet" case to a defaulted-but-technically-non-null empty profile.
    const profile = rawProfile ? mergeProfile(createEmptyProfile(), rawProfile) : null;
    const option = document.createElement('option');
    option.textContent = profileDisplayName(profile);
    profileSelect.appendChild(option);
  }

  // C13: after a run, outline any required field still empty on the live page.
  async function highlightRequired(): Promise<void> {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id === undefined) {
        return;
      }
      const msg: HighlightRequiredMessage = { type: 'HIGHLIGHT_REQUIRED' };
      const res = (await chrome.tabs.sendMessage(tab.id, msg)) as PageCheckResponse | undefined;
      if (res?.empty && res.empty.length > 0) {
        fillStatus.textContent += ` Still empty (outlined in red): ${res.empty.map(labelForStepId).join(', ')}.`;
      }
    } catch {
      // page mid-navigation - skip
    }
  }

  const onActivated = (): void => {
    void refreshStatus();
  };
  // onUpdated fires for every tab, on every status/title/favicon change — filter to
  // "this is the active tab and its navigation has finished" so a form reload doesn't
  // flicker the status through intermediate loading states, and so unrelated tabs
  // don't trigger pointless re-queries.
  const onUpdated = (_tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab): void => {
    if (changeInfo.status === 'complete' && tab.active) {
      void refreshStatus();
    }
  };
  const onMessage = (message: BackgroundToSidePanelMessage): void => {
    if (message.type !== 'RUN_STATUS') {
      return;
    }
    const { status: runStatus } = message;
    runInProgress = runStatus.phase === 'running';
    syncAutofillDisabled();
    switch (runStatus.phase) {
      case 'running':
        fillStatus.textContent = 'Running…';
        renderReport([]);
        break;
      case 'done':
        fillStatus.textContent = formatSummary(summarizeReport(runStatus.report));
        renderReport(runStatus.report);
        void highlightRequired();
        break;
      case 'failed':
        fillStatus.textContent = runStatus.message;
        renderReport(runStatus.report);
        break;
      default:
        // Exhaustiveness check: a new RunStatus phase (src/shared/messages.ts) must be
        // handled above, not silently fall through here.
        throw new Error(`initSidePanel: unhandled RUN_STATUS phase ${JSON.stringify(runStatus satisfies never)}`);
    }
  };

  chrome.tabs.onActivated.addListener(onActivated);
  chrome.tabs.onUpdated.addListener(onUpdated);
  chrome.runtime.onMessage.addListener(onMessage);
  activeListeners = { onActivated, onUpdated, onMessage };

  await refreshStatus();
  await renderProfile();
  await renderPreflight();
}

const app = document.getElementById('app');
if (app) {
  void initSidePanel(app);
}
