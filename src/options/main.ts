// Profile editor: autosave + inline validation (A1-A3), clear-all (A7). Document
// upload UI (B1-B3) is a separate module, added in T-022.
import { EDITABLE_FIELDS, getByPath, groupFieldsBySection, setByPath, type FieldDef } from '../core/fieldMap';
import { isoToFormDate } from '../core/dateFormat';
import { SITE_OPTIONS } from '../core/siteOptions';
import { labelForPath } from '../core/labels';
import { createEmptyProfile, mergeProfile } from '../core/profile';
import { validateProfile } from '../core/profileValidation';
import { exportProfile, parseProfileImport } from '../core/profileIO';
import { clearAll, loadProfile, saveProfile } from '../shared/storage';

const AUTOSAVE_DEBOUNCE_MS = 500;

// Hints for fields whose format isn't obvious (dropdown-backed ones are matched against
// the site's own option text, so type it the way the site shows it).
const PLACEHOLDERS: Record<string, string> = {
  'course.type': 'As shown on the site, e.g. Snow Skiing Courses at Gulmarg',
  'course.level': 'e.g. Basic',
  'course.batch': 'The batch/schedule text from the site',
  'course.state': 'e.g. Jammu and Kashmir',
  'personal.dob': 'YYYY-MM-DD',
  'contact.mobile': '10-digit mobile',
  'address.pincode': '6 digits',
  'education.qualification': 'e.g. Graduation',
  'medical.bloodGroup': 'e.g. O+',
};

export async function initOptionsPage(root: HTMLElement): Promise<void> {
  const profile = mergeProfile(createEmptyProfile(), await loadProfile());
  const errorElements = new Map<string, HTMLElement>();
  let saveTimeout: ReturnType<typeof setTimeout> | undefined;
  // Set synchronously the instant "Clear all data" is confirmed (before the `await
  // clearAll()` below), so an in-flight checkbox save or a newly-scheduled debounced
  // save can't race the clear and resurrect/overwrite with stale data.
  let isClearing = false;

  root.innerHTML = '';

  for (const [section, fields] of groupFieldsBySection(EDITABLE_FIELDS)) {
    const fieldset = document.createElement('fieldset');
    const legend = document.createElement('legend');
    legend.textContent = section;
    fieldset.appendChild(legend);

    for (const def of fields) {
      const { path, errorEl } = renderField(def, fieldset);
      errorElements.set(path, errorEl);
    }

    root.appendChild(fieldset);
  }

  // Explicit save (autosave still runs): flushes any pending debounce and confirms.
  const saveButton = document.createElement('button');
  saveButton.type = 'button';
  saveButton.dataset.action = 'save';
  saveButton.className = 'primary';
  saveButton.textContent = 'Save profile';
  const saveMessage = document.createElement('span');
  saveMessage.dataset.role = 'save-status';
  saveMessage.setAttribute('role', 'status');
  saveButton.addEventListener('click', () => {
    if (isClearing) {
      return;
    }
    if (saveTimeout !== undefined) {
      clearTimeout(saveTimeout);
      saveTimeout = undefined;
    }
    void saveProfile(profile).then(() => {
      const problems = validateProfile(profile).length;
      saveMessage.textContent =
        problems === 0
          ? `Saved at ${new Date().toLocaleTimeString()}.`
          : `Saved, but ${problems} field(s) still need attention (see the notes above).`;
      saveMessage.dataset.state = problems === 0 ? 'ok' : 'warn';
    });
  });
  root.appendChild(saveButton);
  root.appendChild(saveMessage);

  // A5: backup/restore of the text profile (documents are not included).
  const exportButton = document.createElement('button');
  exportButton.type = 'button';
  exportButton.dataset.action = 'export';
  exportButton.textContent = 'Export profile';
  exportButton.addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([exportProfile(profile)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'iism-profile.json';
    a.click();
    URL.revokeObjectURL(url);
  });
  root.appendChild(exportButton);

  const importInput = document.createElement('input');
  importInput.type = 'file';
  importInput.accept = 'application/json,.json';
  importInput.dataset.action = 'import';
  importInput.setAttribute('aria-label', 'Import profile');
  const importMessage = document.createElement('span');
  importMessage.setAttribute('role', 'status');
  importInput.addEventListener('change', () => {
    const file = importInput.files?.[0];
    if (!file) {
      return;
    }
    void file.text().then(async (text) => {
      const result = parseProfileImport(text);
      if (!result.ok) {
        importMessage.textContent = result.error;
        return;
      }
      await saveProfile(result.profile);
      await initOptionsPage(root);
    });
  });
  root.appendChild(importInput);
  root.appendChild(importMessage);

  const clearButton = document.createElement('button');
  clearButton.type = 'button';
  clearButton.dataset.action = 'clear-all';
  clearButton.textContent = 'Clear all data';
  clearButton.addEventListener('click', () => {
    if (window.confirm('Clear the saved profile and all documents? This cannot be undone.')) {
      isClearing = true;
      void handleClearAll();
    }
  });
  root.appendChild(clearButton);

  revalidateAll();

  function renderField(def: FieldDef & { source: string }, container: HTMLElement): { path: string; errorEl: HTMLElement } {
    const path = def.source;
    const wrapper = document.createElement('div');
    wrapper.className = 'field';

    const inputId = `field-${path}`;
    const errorId = `error-${path}`;

    const label = document.createElement('label');
    label.htmlFor = inputId;
    label.textContent = labelForPath(path);
    wrapper.appendChild(label);

    const input = document.createElement('input');
    input.id = inputId;
    input.dataset.path = path;
    input.setAttribute('aria-describedby', errorId);

    if (def.kind === 'checkbox') {
      input.type = 'checkbox';
      input.checked = Boolean(getByPath(profile, path));
      input.addEventListener('change', () => {
        setByPath(profile, path, input.checked);
        revalidate(path);
        if (!isClearing) {
          void saveProfile(profile);
        }
      });
    } else if (path === 'personal.dob') {
      // Native date picker: always yields yyyy-mm-dd, the format the profile stores.
      input.type = 'date';
      input.min = '1940-01-01';
      input.max = new Date().toISOString().slice(0, 10);
      input.value = String(getByPath(profile, path) ?? '');
      const formatHint = document.createElement('span');
      formatHint.dataset.role = 'dob-format';
      formatHint.className = 'hint';
      const updateHint = (): void => {
        const formatted = isoToFormDate(input.value);
        formatHint.textContent = formatted ? `Will be filled as ${formatted} (dd/MM/yyyy)` : 'Pick your date of birth';
      };
      updateHint();
      input.addEventListener('input', () => {
        setByPath(profile, path, input.value);
        updateHint();
        revalidate(path);
        scheduleSave();
      });
      wrapper.appendChild(input);
      wrapper.appendChild(formatHint);
    } else {
      input.type = 'text';
      const hint = PLACEHOLDERS[path];
      if (hint) {
        input.placeholder = hint;
      }
      input.value = String(getByPath(profile, path) ?? '');
      input.addEventListener('input', () => {
        setByPath(profile, path, input.value);
        revalidate(path);
        scheduleSave();
      });
    }
    if (!wrapper.contains(input)) {
      wrapper.appendChild(input);
    }

    // Site-known options (core/siteOptions.ts): a dropdown drives the text input, which stays
    // the single source of truth (and the "Other" fallback for anything not listed).
    const known = SITE_OPTIONS[path];
    if (known && input.type === 'text') {
      const select = document.createElement('select');
      select.dataset.selectFor = path;
      select.setAttribute('aria-label', labelForPath(path));
      const OTHER = '__other__';
      const addOption = (value: string, text: string): void => {
        const o = document.createElement('option');
        o.value = value;
        o.textContent = text;
        select.appendChild(o);
      };
      addOption('', 'Select...');
      for (const name of known) {
        addOption(name, name);
      }
      addOption(OTHER, 'Other (type it)');
      const sync = (): void => {
        const v = input.value;
        select.value = v === '' ? '' : known.includes(v) ? v : OTHER;
        input.hidden = select.value !== OTHER;
      };
      select.addEventListener('change', () => {
        input.value = select.value === OTHER ? (known.includes(input.value) ? '' : input.value) : select.value;
        input.hidden = select.value !== OTHER;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        if (select.value === OTHER) {
          input.focus();
        }
      });
      sync();
      wrapper.insertBefore(select, input);
    }

    const errorEl = document.createElement('span');
    errorEl.id = errorId;
    errorEl.className = 'error';
    errorEl.dataset.errorFor = path;
    errorEl.setAttribute('role', 'alert');
    wrapper.appendChild(errorEl);

    container.appendChild(wrapper);
    return { path, errorEl };
  }

  function revalidate(path: string): void {
    const message = validateProfile(profile).find((e) => e.path === path)?.message ?? '';
    const el = errorElements.get(path);
    if (el) {
      el.textContent = message;
    }
  }

  function revalidateAll(): void {
    const errors = validateProfile(profile);
    for (const [path, el] of errorElements) {
      el.textContent = errors.find((e) => e.path === path)?.message ?? '';
    }
  }

  function scheduleSave(): void {
    if (saveTimeout !== undefined) {
      clearTimeout(saveTimeout);
      saveTimeout = undefined;
    }
    if (isClearing) {
      return;
    }
    saveTimeout = setTimeout(() => {
      void saveProfile(profile);
    }, AUTOSAVE_DEBOUNCE_MS);
  }

  async function handleClearAll(): Promise<void> {
    if (saveTimeout !== undefined) {
      clearTimeout(saveTimeout);
      saveTimeout = undefined;
    }
    await clearAll();
    // A save could have been scheduled during the await above (e.g. a checkbox
    // 'change' firing while clearAll() was still pending) — clear it again so it
    // doesn't fire after we've just reset the draft back to empty.
    if (saveTimeout !== undefined) {
      clearTimeout(saveTimeout);
      saveTimeout = undefined;
    }
    const empty = createEmptyProfile();
    for (const def of EDITABLE_FIELDS) {
      const path = def.source;
      setByPath(profile, path, getByPath(empty, path));
      const input = root.querySelector<HTMLInputElement>(`[data-path="${path}"]`);
      if (!input) continue;
      if (def.kind === 'checkbox') {
        input.checked = Boolean(getByPath(profile, path));
      } else {
        input.value = String(getByPath(profile, path) ?? '');
      }
    }
    revalidateAll();
    isClearing = false;
  }
}

const app = document.getElementById('app');
if (app) {
  void initOptionsPage(app);
}
