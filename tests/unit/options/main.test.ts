import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initOptionsPage } from '../../../src/options/main';
import { EDITABLE_FIELDS } from '../../../src/core/fieldMap';
import type { Profile } from '../../../src/core/profile';

function createChromeStorageMock() {
  let store: Record<string, unknown> = {};
  return {
    storage: {
      local: {
        get: vi.fn(async (key?: string | string[]) => {
          if (key === undefined) {
            return { ...store };
          }
          const keys = Array.isArray(key) ? key : [key];
          const result: Record<string, unknown> = {};
          for (const k of keys) {
            if (k in store) {
              result[k] = store[k];
            }
          }
          return result;
        }),
        set: vi.fn(async (items: Record<string, unknown>) => {
          store = { ...store, ...items };
        }),
        remove: vi.fn(async (key: string | string[]) => {
          for (const k of Array.isArray(key) ? key : [key]) {
            delete store[k];
          }
        }),
        clear: vi.fn(async () => {
          store = {};
        }),
      },
    },
  };
}

let chromeMock: ReturnType<typeof createChromeStorageMock>;

beforeEach(() => {
  chromeMock = createChromeStorageMock();
  vi.stubGlobal('chrome', chromeMock);
  document.body.innerHTML = '<div id="app"></div>';
});

function root(): HTMLElement {
  return document.getElementById('app') as HTMLElement;
}

describe('initOptionsPage', () => {
  it('renders an input for every required Profile field, grouped by section', async () => {
    await initOptionsPage(root());
    expect(root().querySelector('input[data-path="personal.name"]')).not.toBeNull();
    expect(root().querySelector('input[data-path="contact.email"]')).not.toBeNull();
    expect(root().querySelector('input[data-path="declaration.agree"]')?.getAttribute('type')).toBe('checkbox');
  });

  it('renders a select-kind field (e.g. course.type) as a plain text input, never a guessed <select>', async () => {
    await initOptionsPage(root());
    expect(root().querySelector('input[data-path="course.type"]')?.getAttribute('type')).toBe('text');
    expect(root().querySelector('select')).toBeNull();
  });

  it('renders exactly one input per editable field — no file/readonly fields sneak in', async () => {
    await initOptionsPage(root());
    expect(root().querySelectorAll('input[data-path]')).toHaveLength(EDITABLE_FIELDS.length);
    expect(root().querySelector('input[data-path="docs.photo"]')).toBeNull();
  });

  it('associates each error span with its input via aria-describedby', async () => {
    await initOptionsPage(root());
    const input = root().querySelector<HTMLInputElement>('input[data-path="personal.name"]');
    const describedBy = input?.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy ?? '')).toBe(root().querySelector('[data-error-for="personal.name"]'));
  });

  it('shows an inline error for an invalid email and clears it when fixed', async () => {
    await initOptionsPage(root());
    const input = root().querySelector<HTMLInputElement>('input[data-path="contact.email"]');
    expect(input).not.toBeNull();
    if (!input) return;

    input.value = 'not-an-email';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(root().querySelector('[data-error-for="contact.email"]')?.textContent).toBe('Enter a valid email address');

    input.value = 'test@example.com';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(root().querySelector('[data-error-for="contact.email"]')?.textContent).toBe('');
  });

  it('shows a Required error on load for an empty required field', async () => {
    await initOptionsPage(root());
    expect(root().querySelector('[data-error-for="personal.name"]')?.textContent).toBe('Required');
  });

  it('autosaves after a debounced delay following text input, not immediately', async () => {
    vi.useFakeTimers();
    await initOptionsPage(root());
    const input = root().querySelector<HTMLInputElement>('input[data-path="personal.name"]');
    expect(input).not.toBeNull();
    if (!input) return;

    input.value = 'New Name';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(chromeMock.storage.local.set).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);
    expect(chromeMock.storage.local.set).toHaveBeenCalled();
    const lastCall = chromeMock.storage.local.set.mock.calls.at(-1)?.[0] as { profile: Profile } | undefined;
    expect(lastCall?.profile.personal.name).toBe('New Name');
    vi.useRealTimers();
  });

  it('saves a checkbox change without waiting for the debounce', async () => {
    await initOptionsPage(root());
    const checkbox = root().querySelector<HTMLInputElement>('input[data-path="declaration.agree"]');
    expect(checkbox).not.toBeNull();
    if (!checkbox) return;

    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    expect(chromeMock.storage.local.set).toHaveBeenCalled();
    const lastCall = chromeMock.storage.local.set.mock.calls.at(-1)?.[0] as { profile: Profile } | undefined;
    expect(lastCall?.profile.declaration.agree).toBe(true);
  });

  it('clears storage only when confirm() returns true', async () => {
    await initOptionsPage(root());
    const button = root().querySelector<HTMLButtonElement>('[data-action="clear-all"]');
    expect(button).not.toBeNull();
    if (!button) return;

    vi.spyOn(window, 'confirm').mockReturnValueOnce(false);
    button.click();
    await Promise.resolve();
    expect(chromeMock.storage.local.remove).not.toHaveBeenCalled();

    vi.spyOn(window, 'confirm').mockReturnValueOnce(true);
    button.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(chromeMock.storage.local.remove).toHaveBeenCalled();
  });

  it('resets rendered input values/checked state back to empty after a confirmed clear', async () => {
    await initOptionsPage(root());
    const nameInput = root().querySelector<HTMLInputElement>('input[data-path="personal.name"]');
    const agreeCheckbox = root().querySelector<HTMLInputElement>('input[data-path="declaration.agree"]');
    if (!nameInput || !agreeCheckbox) throw new Error('fields not rendered');

    nameInput.value = 'Test Name';
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    agreeCheckbox.checked = true;
    agreeCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();

    vi.spyOn(window, 'confirm').mockReturnValueOnce(true);
    root().querySelector<HTMLButtonElement>('[data-action="clear-all"]')?.click();
    // clearAll() also clears IndexedDB docs via fake-indexeddb, whose request callbacks
    // resolve on a real timer tick rather than a plain microtask — a *fixed* sleep here
    // flakes under parallel-test load (not enough CPU time in the window), so poll for
    // the actual outcome instead, same "readiness, not a fixed wait" principle this
    // project applies to the real page's postback reloads (content/dom.ts's
    // waitForReload).
    await vi.waitFor(() => {
      if (nameInput.value !== '' || agreeCheckbox.checked) {
        throw new Error('clear-all has not finished resetting the form yet');
      }
    });

    expect(nameInput.value).toBe('');
    expect(agreeCheckbox.checked).toBe(false);
  });

  it('does not let a save in flight when Clear is confirmed resurrect data afterwards', async () => {
    vi.useFakeTimers();
    await initOptionsPage(root());
    const nameInput = root().querySelector<HTMLInputElement>('input[data-path="personal.name"]');
    const agreeCheckbox = root().querySelector<HTMLInputElement>('input[data-path="declaration.agree"]');
    if (!nameInput || !agreeCheckbox) throw new Error('fields not rendered');

    // Schedule a debounced save, then confirm Clear before it would have fired, then
    // toggle the checkbox (an immediate-save path) in the same tick as the confirm.
    nameInput.value = 'Stale Name';
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));

    vi.spyOn(window, 'confirm').mockReturnValueOnce(true);
    root().querySelector<HTMLButtonElement>('[data-action="clear-all"]')?.click();
    agreeCheckbox.checked = true;
    agreeCheckbox.dispatchEvent(new Event('change', { bubbles: true }));

    await vi.advanceTimersByTimeAsync(1000);

    const setCalls = chromeMock.storage.local.set.mock.calls as Array<[{ profile: Profile }]>;
    for (const [{ profile }] of setCalls) {
      expect(profile.personal.name).not.toBe('Stale Name');
    }
    vi.useRealTimers();
  });
});

describe('date picker and explicit save', () => {
  it('renders DOB as a native date input and shows the dd/MM/yyyy it will fill', async () => {
    await initOptionsPage(root());
    const dob = root().querySelector<HTMLInputElement>('input[data-path="personal.dob"]') as HTMLInputElement;
    expect(dob.type).toBe('date');
    dob.value = '2000-01-15';
    dob.dispatchEvent(new Event('input', { bubbles: true }));
    expect(root().querySelector('[data-role="dob-format"]')?.textContent).toContain('15/01/2000');
  });

  it('Save profile persists immediately and reports problems', async () => {
    await initOptionsPage(root());
    const name = root().querySelector<HTMLInputElement>('input[data-path="personal.name"]') as HTMLInputElement;
    name.value = 'Saved Now';
    name.dispatchEvent(new Event('input', { bubbles: true }));
    (root().querySelector('[data-action="save"]') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(root().querySelector('[data-role="save-status"]')?.textContent).toContain('Saved'));
    const stored = (await chromeMock.storage.local.get('profile')) as { profile: Profile };
    expect(stored.profile.personal.name).toBe('Saved Now');
    expect(root().querySelector('[data-role="save-status"]')?.textContent).toContain('need attention');
  });
});
