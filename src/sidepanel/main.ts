// Side panel shell (E1, C1): page-detected status, profile dropdown, Autofill/Reset
// buttons. T-032 wires Autofill to a real fill run (C2-C6) via START_FILL/RUN_STATUS
// (src/shared/messages.ts) — the structured per-field report display is T-033's job
// (C7); this only shows the run's phase and, on failure, its message. Reset stays a
// real, present, honestly-disabled control until T-034 (C8).
import { isAdmissionUrl } from '../core/pageDetect';
import { createEmptyProfile, mergeProfile, profileDisplayName } from '../core/profile';
import { loadProfile } from '../shared/storage';
import type { BackgroundToSidePanelMessage, StartFillMessage } from '../shared/messages';

const DISABLED_REASON = 'Coming in a later update';

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
  resetButton.title = DISABLED_REASON;
  resetButton.disabled = true;
  resetButton.dataset.action = 'reset';
  root.appendChild(resetButton);

  // A disabled <button>'s title tooltip only reaches a sighted mouse user who hovers
  // it — disabled buttons are skipped by Tab and most screen readers announce only
  // "disabled", not the title — so the reason is also shown as visible, non-interactive
  // text.
  const disabledNote = document.createElement('small');
  disabledNote.dataset.role = 'disabled-note';
  disabledNote.textContent = `Reset: ${DISABLED_REASON.toLowerCase()}.`;
  root.appendChild(disabledNote);

  const fillStatus = document.createElement('p');
  fillStatus.dataset.role = 'fill-status';
  root.appendChild(fillStatus);

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
  }

  autofillButton.addEventListener('click', () => {
    fillStatus.textContent = 'Running…';
    runInProgress = true;
    syncAutofillDisabled();
    const message: StartFillMessage = { type: 'START_FILL' };
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
    if (runStatus.phase === 'running') {
      fillStatus.textContent = 'Running…';
    } else if (runStatus.phase === 'done') {
      const ok = runStatus.report.filter((r) => r.status === 'ok').length;
      fillStatus.textContent = `Done: ${ok}/${runStatus.report.length} filled.`;
    } else {
      fillStatus.textContent = runStatus.message;
    }
  };

  chrome.tabs.onActivated.addListener(onActivated);
  chrome.tabs.onUpdated.addListener(onUpdated);
  chrome.runtime.onMessage.addListener(onMessage);
  activeListeners = { onActivated, onUpdated, onMessage };

  await refreshStatus();
  await renderProfile();
}

const app = document.getElementById('app');
if (app) {
  void initSidePanel(app);
}
