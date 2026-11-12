// Low-level DOM primitives for filling the admission form (docs/03-architecture.md's
// "Key technical decisions"). These only apply an already-decided value/file — they
// never decide WHICH value to use (that's core/match.ts) and never orchestrate a fill
// run across postback reloads (that's the service worker, T-032).

// blur deliberately doesn't bubble, matching real browser blur semantics (unlike
// focusout) — confirmed against tests/fixtures/admission.html, which has no `onblur`
// anywhere, so this asymmetry with input/change's bubbling never actually matters for
// this site, but it's kept accurate rather than uniformly bubbling for its own sake.
function dispatchFillEvents(element: HTMLElement, { blur = true }: { blur?: boolean } = {}): void {
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  if (blur) {
    element.dispatchEvent(new Event('blur'));
  }
}

// Uses the native property setter rather than a plain assignment so this still works
// correctly even if something has replaced the instance's own `value`/`checked`
// accessor (defensive — this plain WebForms page doesn't do that itself, but the
// native-setter + dispatched-events pattern is what reliably triggers the page's own
// onchange-driven postback regardless). `value`/`checked` are accessors on
// HTMLInputElement.prototype/HTMLSelectElement.prototype for every element this module
// ever receives, so the setter is always found — if it's ever missing, that means
// something is deeply wrong with the element we were handed, and this is about to
// write to the live admission form, so it fails loudly rather than silently falling
// back to a plain assignment that could do the wrong thing unnoticed.
function setNativeProperty<T>(element: HTMLElement, property: string, value: T): void {
  const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), property);
  if (!descriptor?.set) {
    throw new Error(`setNativeProperty: no native "${property}" setter on ${element.tagName}`);
  }
  descriptor.set.call(element, value);
}

// Tries each selector in order (core/fieldMap.ts's FieldDef.selectors — `#id` first,
// then the `[name=...]` fallbacks the architecture doc calls for) and returns the
// first match. No label-text tier here: that's a dynamic per-call decision the
// executor (T-032) hasn't needed yet, since every field map entry's `#id` selector has
// matched in the fixture so far.
export function findElement(selectors: readonly string[]): Element | null {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      return element;
    }
  }
  return null;
}

export function setValue(element: HTMLInputElement, value: string | boolean): void {
  if (element.type === 'checkbox') {
    setNativeProperty(element, 'checked', Boolean(value));
  } else {
    setNativeProperty(element, 'value', String(value));
  }
  dispatchFillEvents(element);
}

// `value` is an already-resolved <option> value (core/match.ts + the live option list
// decide which one, before this is ever called) — this only applies it. Fires nothing
// and returns false if no such option exists, since that means the caller resolved
// against a stale/wrong option list, not that there's a value to half-apply.
export function selectOption(select: HTMLSelectElement, value: string): boolean {
  const exists = Array.from(select.options).some((option) => option.value === value);
  if (!exists) {
    return false;
  }
  setNativeProperty(select, 'value', value);
  dispatchFillEvents(select);
  return true;
}

export type AssignFile = (input: HTMLInputElement, file: File) => void;

// jsdom has no DataTransfer, and a real <input>.files setter rejects anything that
// isn't a genuine browser FileList — so the actual assignment is injectable the same
// way image.ts's Encoder and documents.ts's createThumbnailUrl are, with this real
// DataTransfer-based implementation as the production default.
// TODO(T-031/T-035): this function itself has zero test coverage anywhere in the repo
// — jsdom can't exercise it, and there's no real-browser/fixture test yet. Covered by
// the Playwright e2e fixture once T-031 (fixture server) and T-035 (e2e) land.
export const defaultAssignFile: AssignFile = (input, file) => {
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);
  input.files = dataTransfer.files;
};

// docs/04-field-map.md: "Setting the file input and firing change is what the page
// expects" — only input+change, deliberately no blur (unlike setValue/selectOption).
export function attachFile(
  input: HTMLInputElement,
  blob: Blob,
  filename: string,
  assignFile: AssignFile = defaultAssignFile,
): void {
  const file = new File([blob], filename, { type: blob.type });
  assignFile(input, file);
  dispatchFillEvents(input, { blur: false });
}

// Not currently called anywhere in the T-032 data path: content/index.ts relies entirely
// on the service worker treating a fresh READY-on-reinjection as the reload signal
// (src/core/fillRun.ts), since polling from inside the content script can't observe a
// reload that's about to tear that very script down. Kept — a primitive this module
// already exists for and is still unit-tested — in case a future need for an in-page
// reload wait (as opposed to the orchestrator's cross-reload wait) comes up.
export interface WaitForReloadOptions {
  // Called once per poll; the wait resolves once this returns the same value on two
  // consecutive polls (not just once) AND document.readyState is 'complete' — matching
  // CLAUDE.md's "poll document.readyState + value stability" wording. Defaults to a
  // constant, so omitting it just waits for readyState alone.
  // Compared with Object.is, so return a primitive (string/number/boolean) or a stable
  // reference — e.g. a dropdown's populated option *count*, not a freshly `.map()`'d
  // array of its options on every call, which would never compare equal to itself and
  // so would always time out instead of detecting stability.
  readValue?: () => unknown;
  timeoutMs?: number;
  pollIntervalMs?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForReload(options: WaitForReloadOptions = {}): Promise<boolean> {
  const { readValue = () => true, timeoutMs = 10_000, pollIntervalMs = 100 } = options;
  const deadline = Date.now() + timeoutMs;
  const UNSET = Symbol('unset');
  let previous: unknown = UNSET;

  while (Date.now() < deadline) {
    if (document.readyState === 'complete') {
      const current = readValue();
      if (previous !== UNSET && Object.is(current, previous)) {
        return true;
      }
      previous = current;
    } else {
      previous = UNSET;
    }
    await sleep(pollIntervalMs);
  }
  return false;
}
