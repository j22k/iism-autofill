import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initSidePanel } from '../../../src/sidepanel/main';

type OnActivatedListener = () => void;
type OnUpdatedListener = (tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => void;
type OnMessageListener = (message: unknown) => void;

let currentUrl: string | undefined;
let activatedListeners: OnActivatedListener[];
let updatedListeners: OnUpdatedListener[];
let runtimeMessageListeners: OnMessageListener[];
let sentMessages: unknown[];

function createChromeMock() {
  let profileStore: Record<string, unknown> = {};
  activatedListeners = [];
  updatedListeners = [];
  runtimeMessageListeners = [];
  sentMessages = [];
  return {
    tabs: {
      query: vi.fn(async () => (EMPTY_TAB_LIST ? [] : [{ id: 1, url: currentUrl }])),
      onActivated: {
        addListener: vi.fn((cb: OnActivatedListener) => activatedListeners.push(cb)),
        removeListener: vi.fn((cb: OnActivatedListener) => {
          activatedListeners = activatedListeners.filter((l) => l !== cb);
        }),
      },
      onUpdated: {
        addListener: vi.fn((cb: OnUpdatedListener) => updatedListeners.push(cb)),
        removeListener: vi.fn((cb: OnUpdatedListener) => {
          updatedListeners = updatedListeners.filter((l) => l !== cb);
        }),
      },
    },
    runtime: {
      sendMessage: vi.fn((message: unknown) => {
        sentMessages.push(message);
        return Promise.resolve();
      }),
      onMessage: {
        addListener: vi.fn((cb: OnMessageListener) => runtimeMessageListeners.push(cb)),
        removeListener: vi.fn((cb: OnMessageListener) => {
          runtimeMessageListeners = runtimeMessageListeners.filter((l) => l !== cb);
        }),
      },
    },
    storage: {
      local: {
        get: vi.fn(async (key?: string | string[]) => {
          if (key === undefined) return { ...profileStore };
          const keys = Array.isArray(key) ? key : [key];
          const result: Record<string, unknown> = {};
          for (const k of keys) {
            if (k in profileStore) result[k] = profileStore[k];
          }
          return result;
        }),
        set: vi.fn(async (items: Record<string, unknown>) => {
          profileStore = { ...profileStore, ...items };
        }),
        remove: vi.fn(async () => {}),
        clear: vi.fn(async () => {}),
      },
    },
  };
}

let EMPTY_TAB_LIST = false;

beforeEach(() => {
  currentUrl = 'https://example.com/';
  EMPTY_TAB_LIST = false;
  document.body.innerHTML = '<div id="app"></div>';
  vi.stubGlobal('chrome', createChromeMock());
});

function root(): HTMLElement {
  return document.getElementById('app') as HTMLElement;
}

async function setStoredProfile(partial: { name?: string; missingPersonal?: boolean }): Promise<void> {
  const profile: Record<string, unknown> = {
    course: { type: '', level: '', batch: '', state: '' },
    address: { house: '', street: '', city: '', pincode: '' },
    contact: { mobile: '', email: '' },
    education: { qualification: '' },
    medical: { bloodGroup: '' },
    emergency: { name: '', phone: '' },
    declaration: { agree: false },
  };
  if (!partial.missingPersonal) {
    profile.personal = { name: partial.name ?? '', fatherName: '', nationality: '', dob: '' };
  }
  await chrome.storage.local.set({ profile });
}

describe('initSidePanel', () => {
  it('shows a not-ready status when the active tab is not the admission form', async () => {
    currentUrl = 'https://example.com/';
    await initSidePanel(root());
    expect(root().querySelector('[data-role="status"]')?.textContent).toMatch(/Not on the IISM admission form/);
  });

  it('shows a ready status when the active tab is the admission form', async () => {
    currentUrl = 'https://admission.iismgulmarg.in/Default.aspx';
    await initSidePanel(root());
    expect(root().querySelector('[data-role="status"]')?.textContent).toMatch(/On the IISM admission form/);
  });

  it('treats an undefined tab url (no host permission) as not-ready', async () => {
    currentUrl = undefined;
    await initSidePanel(root());
    expect(root().querySelector('[data-role="status"]')?.textContent).toMatch(/Not on the IISM admission form/);
  });

  it('treats no active tab at all (empty query result) as not-ready', async () => {
    EMPTY_TAB_LIST = true;
    await initSidePanel(root());
    expect(root().querySelector('[data-role="status"]')?.textContent).toMatch(/Not on the IISM admission form/);
  });

  it('shows a placeholder in the profile dropdown when no profile is saved', async () => {
    await initSidePanel(root());
    const select = root().querySelector<HTMLSelectElement>('[data-role="profile-select"]');
    expect(select?.disabled).toBe(true);
    expect(select?.options).toHaveLength(1);
    expect(select?.options[0]?.textContent).toBe('No profile saved yet');
  });

  it('associates the profile dropdown with a visible label', async () => {
    await initSidePanel(root());
    const select = root().querySelector<HTMLSelectElement>('[data-role="profile-select"]');
    expect(select?.id).toBeTruthy();
    expect(root().querySelector(`label[for="${select?.id}"]`)?.textContent).toBeTruthy();
  });

  it("shows the saved profile's name in the dropdown", async () => {
    await setStoredProfile({ name: 'Test Name' });
    await initSidePanel(root());
    const select = root().querySelector<HTMLSelectElement>('[data-role="profile-select"]');
    expect(select?.options[0]?.textContent).toBe('Test Name');
  });

  it('falls back to a placeholder label when the saved profile has no name yet', async () => {
    await setStoredProfile({ name: '' });
    await initSidePanel(root());
    const select = root().querySelector<HTMLSelectElement>('[data-role="profile-select"]');
    expect(select?.options[0]?.textContent).toBe('Unnamed profile');
  });

  it('does not crash when a stored profile is missing the personal section entirely', async () => {
    await setStoredProfile({ missingPersonal: true });
    await initSidePanel(root());
    const select = root().querySelector<HTMLSelectElement>('[data-role="profile-select"]');
    expect(select?.options[0]?.textContent).toBe('Unnamed profile');
  });

  it('renders Reset as present but disabled, with a visible explanation (Reset ships in T-034)', async () => {
    await initSidePanel(root());
    const reset = root().querySelector<HTMLButtonElement>('[data-action="reset"]');
    expect(reset?.disabled).toBe(true);
    expect(root().querySelector('[data-role="disabled-note"]')?.textContent).toBeTruthy();
  });

  it('disables Autofill when not on the admission form', async () => {
    currentUrl = 'https://example.com/';
    await initSidePanel(root());
    const autofill = root().querySelector<HTMLButtonElement>('[data-action="autofill"]');
    expect(autofill?.disabled).toBe(true);
  });

  it('enables Autofill when on the admission form', async () => {
    currentUrl = 'https://admission.iismgulmarg.in/Default.aspx';
    await initSidePanel(root());
    const autofill = root().querySelector<HTMLButtonElement>('[data-action="autofill"]');
    expect(autofill?.disabled).toBe(false);
  });

  it('sends START_FILL when Autofill is clicked', async () => {
    currentUrl = 'https://admission.iismgulmarg.in/Default.aspx';
    await initSidePanel(root());
    const autofill = root().querySelector<HTMLButtonElement>('[data-action="autofill"]');
    autofill?.click();
    expect(sentMessages).toEqual([{ type: 'START_FILL' }]);
  });

  it('shows a running status after Autofill is clicked', async () => {
    currentUrl = 'https://admission.iismgulmarg.in/Default.aspx';
    await initSidePanel(root());
    root().querySelector<HTMLButtonElement>('[data-action="autofill"]')?.click();
    expect(root().querySelector('[data-role="fill-status"]')?.textContent).toMatch(/running/i);
  });

  it('disables Autofill immediately on click, preventing a duplicate/overlapping run', async () => {
    currentUrl = 'https://admission.iismgulmarg.in/Default.aspx';
    await initSidePanel(root());
    const autofill = root().querySelector<HTMLButtonElement>('[data-action="autofill"]');
    autofill?.click();
    expect(autofill?.disabled).toBe(true);
  });

  it('re-enables Autofill once a RUN_STATUS done message arrives, while still on the form', async () => {
    currentUrl = 'https://admission.iismgulmarg.in/Default.aspx';
    await initSidePanel(root());
    const autofill = root().querySelector<HTMLButtonElement>('[data-action="autofill"]');
    autofill?.click();
    expect(autofill?.disabled).toBe(true);

    for (const listener of runtimeMessageListeners) {
      listener({ type: 'RUN_STATUS', status: { phase: 'done', report: [] } });
    }
    expect(autofill?.disabled).toBe(false);
  });

  it('re-enables Autofill once a RUN_STATUS failed message arrives', async () => {
    currentUrl = 'https://admission.iismgulmarg.in/Default.aspx';
    await initSidePanel(root());
    const autofill = root().querySelector<HTMLButtonElement>('[data-action="autofill"]');
    autofill?.click();

    for (const listener of runtimeMessageListeners) {
      listener({ type: 'RUN_STATUS', status: { phase: 'failed', message: 'oops', report: [] } });
    }
    expect(autofill?.disabled).toBe(false);
  });

  it('keeps Autofill disabled after a done run if the tab has since navigated away from the form', async () => {
    currentUrl = 'https://admission.iismgulmarg.in/Default.aspx';
    await initSidePanel(root());
    const autofill = root().querySelector<HTMLButtonElement>('[data-action="autofill"]');
    autofill?.click();

    currentUrl = 'https://example.com/'; // navigated away mid-run
    for (const listener of updatedListeners) {
      listener(1, { status: 'complete' }, { active: true } as chrome.tabs.Tab);
    }
    await Promise.resolve();
    await Promise.resolve();

    for (const listener of runtimeMessageListeners) {
      listener({ type: 'RUN_STATUS', status: { phase: 'done', report: [] } });
    }
    expect(autofill?.disabled).toBe(true);
  });

  it('shows a summary line when a RUN_STATUS done message arrives', async () => {
    await initSidePanel(root());
    for (const listener of runtimeMessageListeners) {
      listener({ type: 'RUN_STATUS', status: { phase: 'done', report: [{ id: 'txtName', status: 'ok' }] } });
    }
    expect(root().querySelector('[data-role="fill-status"]')?.textContent).toBe('Filled 1/1.');
  });

  it('renders one report row per field, labeled and with its status, on a done run', async () => {
    await initSidePanel(root());
    for (const listener of runtimeMessageListeners) {
      listener({
        type: 'RUN_STATUS',
        status: {
          phase: 'done',
          report: [
            { id: 'txtName', status: 'ok' },
            { id: 'ddlVegetarianOrNon', status: 'skipped', message: 'no value in profile' },
            { id: 'txtBloodGroup', status: 'failed', message: 'no element found' },
          ],
        },
      });
    }
    const rows = root().querySelectorAll<HTMLLIElement>('[data-role="fill-report"] li');
    expect(rows).toHaveLength(3);
    expect(rows[0]?.dataset.status).toBe('ok');
    expect(rows[0]?.textContent).toBe('Basic — Name: ok');
    expect(rows[1]?.dataset.status).toBe('skipped');
    expect(rows[1]?.textContent).toBe('ID — Diet: skipped (no value in profile)');
    expect(rows[2]?.dataset.status).toBe('failed');
    expect(rows[2]?.textContent).toBe('ID — Blood Group: failed (no element found)');
  });

  it('shows the failure message and any partial report when a RUN_STATUS failed message arrives', async () => {
    await initSidePanel(root());
    for (const listener of runtimeMessageListeners) {
      listener({
        type: 'RUN_STATUS',
        status: {
          phase: 'failed',
          message: 'Missing required before filling: txtName',
          report: [{ id: 'ddlCourse', status: 'ok' }],
        },
      });
    }
    expect(root().querySelector('[data-role="fill-status"]')?.textContent).toMatch(/Missing required before filling: txtName/);
    expect(root().querySelectorAll('[data-role="fill-report"] li')).toHaveLength(1);
  });

  it('clears the previous report when a new run starts', async () => {
    currentUrl = 'https://admission.iismgulmarg.in/Default.aspx';
    await initSidePanel(root());
    for (const listener of runtimeMessageListeners) {
      listener({ type: 'RUN_STATUS', status: { phase: 'done', report: [{ id: 'txtName', status: 'ok' }] } });
    }
    expect(root().querySelectorAll('[data-role="fill-report"] li')).toHaveLength(1);

    root().querySelector<HTMLButtonElement>('[data-action="autofill"]')?.click();
    expect(root().querySelectorAll('[data-role="fill-report"] li')).toHaveLength(0);
  });

  it('ignores a RUN_STATUS message after the panel has been re-initialized (old listener removed)', async () => {
    await initSidePanel(root());
    const firstRoundListeners = [...runtimeMessageListeners];
    await initSidePanel(root());
    expect(runtimeMessageListeners).toHaveLength(1);
    expect(runtimeMessageListeners[0]).not.toBe(firstRoundListeners[0]);
  });

  it('refreshes status when the active tab changes', async () => {
    currentUrl = 'https://example.com/';
    await initSidePanel(root());
    expect(root().querySelector('[data-role="status"]')?.textContent).toMatch(/Not on the IISM admission form/);

    currentUrl = 'https://admission.iismgulmarg.in/';
    for (const listener of activatedListeners) listener();
    await Promise.resolve();
    await Promise.resolve();

    expect(root().querySelector('[data-role="status"]')?.textContent).toMatch(/On the IISM admission form/);
  });

  it('refreshes status on tab navigation completing in the active tab', async () => {
    currentUrl = 'https://admission.iismgulmarg.in/';
    await initSidePanel(root());
    expect(root().querySelector('[data-role="status"]')?.textContent).toMatch(/On the IISM admission form/);

    currentUrl = 'https://example.com/';
    for (const listener of updatedListeners) {
      listener(1, { status: 'complete' }, { active: true } as chrome.tabs.Tab);
    }
    await Promise.resolve();
    await Promise.resolve();

    expect(root().querySelector('[data-role="status"]')?.textContent).toMatch(/Not on the IISM admission form/);
  });

  it('ignores onUpdated firings for a background tab or a still-loading tab', async () => {
    currentUrl = 'https://admission.iismgulmarg.in/';
    await initSidePanel(root());

    currentUrl = 'https://example.com/'; // would flip status if a refresh happened
    for (const listener of updatedListeners) {
      listener(2, { status: 'loading' }, { active: true } as chrome.tabs.Tab);
      listener(3, { status: 'complete' }, { active: false } as chrome.tabs.Tab);
    }
    await Promise.resolve();
    await Promise.resolve();

    expect(root().querySelector('[data-role="status"]')?.textContent).toMatch(/On the IISM admission form/);
  });

  it('removes its previous listeners instead of accumulating them when initialized again', async () => {
    await initSidePanel(root());
    expect(activatedListeners).toHaveLength(1);
    expect(updatedListeners).toHaveLength(1);

    await initSidePanel(root());
    expect(activatedListeners).toHaveLength(1);
    expect(updatedListeners).toHaveLength(1);
  });
});
