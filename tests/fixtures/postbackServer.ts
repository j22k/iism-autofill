// Emulates the admission form's real server-side postback behavior for e2e tests
// (docs/03-architecture.md: Playwright intercepts requests to the admission domain via
// route interception and fulfills them with this — there is no real HTTP listener and
// never a real network call out of the extension itself).
//
// The real __doPostBack (tests/fixtures/admission.html) just sets
// __EVENTTARGET/__EVENTARGUMENT and does a literal form.submit() — a full-page POST and
// reload. That's why file inputs never survive it (universal browser behavior, not
// ASP.NET-specific) while every other field does (the real server echoes the posted
// values back via ViewState). Each postback is modeled as stateless and takes the
// FULL current form state, exactly like a real <form> submission would.
//
// CAVEAT: docs/04-field-map.md's T-001b (live-capturing the real Course Level/Schedule
// option values) is still open — the base fixture only has each dropdown's placeholder
// "Select..." option. The Level/Schedule options generated below are fictional
// placeholders that exist ONLY to exercise the Course -> Level -> Schedule cascade
// mechanism in tests, not verified site data. Replace with real values once T-001b
// lands.
import { JSDOM } from 'jsdom';

const PLACEHOLDER_LEVELS: Record<string, Array<{ value: string; label: string }>> = {
  '4': [
    { value: 'fixture-basic', label: 'Basic (fixture placeholder)' },
    { value: 'fixture-intermediate', label: 'Intermediate (fixture placeholder)' },
    { value: 'fixture-advanced', label: 'Advanced (fixture placeholder)' },
  ],
  '5': [
    { value: 'fixture-basic', label: 'Basic (fixture placeholder)' },
    { value: 'fixture-intermediate', label: 'Intermediate (fixture placeholder)' },
  ],
  '12': [{ value: 'fixture-moi', label: 'MOI (fixture placeholder)' }],
};

const PLACEHOLDER_SCHEDULES: Array<{ value: string; label: string }> = [
  { value: 'fixture-batch-1', label: 'Batch 1 (fixture placeholder)' },
  { value: 'fixture-batch-2', label: 'Batch 2 (fixture placeholder)' },
];

// jsdom (and real browsers) only reflect an <input>'s "value"/"checked" and a
// <select>'s chosen <option> into the LIVE PROPERTY, not back into the HTML attribute
// — so setting `.value`/`.checked` here would be invisible to dom.serialize(). Every
// mutation below goes through attributes directly instead. (Confirmed directly: an
// <option>'s `.value` IS attribute-reflected, which is why the cascade helpers below
// can still build fresh options with a plain `.value =`.)
function setSelectedOption(select: HTMLSelectElement, value: string): void {
  for (const option of Array.from(select.options)) {
    if (option.value === value) {
      option.setAttribute('selected', '');
    } else {
      option.removeAttribute('selected');
    }
  }
}

function resetSelectToPlaceholder(select: HTMLSelectElement): void {
  const placeholder = select.options[0];
  select.innerHTML = '';
  if (placeholder) {
    placeholder.setAttribute('selected', '');
    select.appendChild(placeholder);
  }
}

function populateOptions(
  document: Document,
  select: HTMLSelectElement,
  entries: Array<{ value: string; label: string }>,
): void {
  resetSelectToPlaceholder(select);
  for (const entry of entries) {
    const option = document.createElement('option');
    option.value = entry.value;
    option.textContent = entry.label;
    select.appendChild(option);
  }
}

// Deliberately tag/attribute checks, not `instanceof HTMLInputElement` etc. — `html`
// is parsed into its OWN separate jsdom realm (`new JSDOM(html)`), whose
// HTMLInputElement/HTMLSelectElement are different classes from this test runner's
// ambient jsdom-environment globals of the same name, so a cross-realm `instanceof`
// would always be false even for a genuine <input>.
function isFileInput(element: Element): boolean {
  return element.tagName === 'INPUT' && element.getAttribute('type') === 'file';
}

function applySubmittedValue(element: Element, value: string | boolean): void {
  if (element.tagName === 'INPUT' && element.getAttribute('type') === 'checkbox') {
    if (value) {
      element.setAttribute('checked', '');
    } else {
      element.removeAttribute('checked');
    }
  } else if (element.tagName === 'INPUT') {
    element.setAttribute('value', String(value));
  } else if (element.tagName === 'SELECT') {
    setSelectedOption(element as HTMLSelectElement, String(value));
  }
}

export function renderPostback(html: string, eventTarget: string, formValues: Record<string, string | boolean>): string {
  const dom = new JSDOM(html);
  const { document } = dom.window;

  // Text/select/checkbox survive — apply whatever was submitted for every field the
  // caller named (an unlisted field just keeps its base-HTML value, matching a real
  // postback where nothing touched it). A name that doesn't resolve to any element is a
  // caller bug (e.g. a typo'd field id) — fail loudly rather than silently doing
  // nothing, matching the precedent set in src/content/dom.ts's setNativeProperty.
  for (const [name, value] of Object.entries(formValues)) {
    const element = document.getElementById(name);
    if (!element) {
      throw new Error(`renderPostback: formValues has no matching element for "${name}"`);
    }
    // File inputs are the one exception: never let a "submitted" value reach them —
    // browsers never resubmit file input values across any navigation, postback or not.
    if (!isFileInput(element)) {
      applySubmittedValue(element, value);
    }
  }

  // __EVENTTARGET/__EVENTARGUMENT (tests/fixtures/admission.html) are intentionally
  // left untouched — nothing in this codebase reads them yet. Revisit if a future
  // T-035 e2e test or content-script code ever inspects them.

  if (eventTarget === 'ddlCourse') {
    const courseValue = String(formValues.ddlCourse ?? '0');
    const level = document.getElementById('ddlCourseLevel') as HTMLSelectElement | null;
    const schedule = document.getElementById('ddlScheduleCourse') as HTMLSelectElement | null;
    if (level) {
      populateOptions(document, level, PLACEHOLDER_LEVELS[courseValue] ?? []);
    }
    if (schedule) {
      resetSelectToPlaceholder(schedule);
    }
  } else if (eventTarget === 'ddlCourseLevel') {
    const schedule = document.getElementById('ddlScheduleCourse') as HTMLSelectElement | null;
    if (schedule) {
      populateOptions(document, schedule, PLACEHOLDER_SCHEDULES);
    }
  } else if (eventTarget === 'ddlScheduleCourse') {
    const dob = document.getElementById('txtDateOfBirth');
    if (dob && dob.tagName === 'INPUT') {
      dob.setAttribute('value', '');
    }
  }

  return dom.serialize();
}
