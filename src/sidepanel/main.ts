// Side panel shell (E1, C1): page-detected status, profile dropdown, Autofill/Reset
// buttons. The actual fill engine (C2-C7) and reset behavior (C8) land in T-032/T-034
// — until then Autofill/Reset are real, present controls, but honestly disabled rather
// than wired to do nothing.
import { isAdmissionUrl } from '../core/pageDetect';
import { createEmptyProfile, mergeProfile, profileDisplayName } from '../core/profile';
import { loadProfile } from '../shared/storage';

const DISABLED_REASON = 'Coming in a later update';

// Listeners registered by the most recent initSidePanel() call, so a second call on
// the same page (there's no real use case today, but the function is exported and
// callable directly, including by tests) removes the old ones instead of
// accumulating listeners that close over now-detached DOM nodes.
let activeListeners: {
  onActivated: (activeInfo: chrome.tabs.TabActiveInfo) => void;
  onUpdated: (tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => void;
} | null = null;

export async function initSidePanel(root: HTMLElement): Promise<void> {
  if (activeListeners) {
    chrome.tabs.onActivated.removeListener(activeListeners.onActivated);
    chrome.tabs.onUpdated.removeListener(activeListeners.onUpdated);
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
  autofillButton.title = DISABLED_REASON;
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
  disabledNote.textContent = `Autofill and Reset: ${DISABLED_REASON.toLowerCase()}.`;
  root.appendChild(disabledNote);

  async function refreshStatus(): Promise<void> {
    // tab.url is only populated when this extension has permission for that tab's URL
    // (manifest.json's host_permissions, matched by hostname — no `tabs` permission
    // needed or held). For any other tab it comes back undefined, which
    // isAdmissionUrl correctly treats as not-ready.
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    status.textContent = isAdmissionUrl(tab?.url)
      ? 'On the IISM admission form.'
      : 'Not on the IISM admission form — open it to use Autofill.';
  }

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
  chrome.tabs.onActivated.addListener(onActivated);
  chrome.tabs.onUpdated.addListener(onUpdated);
  activeListeners = { onActivated, onUpdated };

  await refreshStatus();
  await renderProfile();
}

const app = document.getElementById('app');
if (app) {
  void initSidePanel(app);
}
