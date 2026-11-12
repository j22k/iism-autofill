import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attachFile, findElement, selectOption, setValue, waitForReload } from '../../../src/content/dom';

function captureEvents(element: EventTarget): string[] {
  const seen: string[] = [];
  for (const type of ['input', 'change', 'blur']) {
    element.addEventListener(type, () => seen.push(type));
  }
  return seen;
}

describe('setValue', () => {
  it('sets a text input value and fires input, change, blur in order', () => {
    const input = document.createElement('input');
    input.type = 'text';
    const seen = captureEvents(input);

    setValue(input, 'Test Name');

    expect(input.value).toBe('Test Name');
    expect(seen).toEqual(['input', 'change', 'blur']);
  });

  it('checks a checkbox and fires input, change, blur', () => {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    const seen = captureEvents(checkbox);

    setValue(checkbox, true);

    expect(checkbox.checked).toBe(true);
    expect(seen).toEqual(['input', 'change', 'blur']);
  });

  it('unchecks a checkbox', () => {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = true;

    setValue(checkbox, false);

    expect(checkbox.checked).toBe(false);
  });
});

describe('selectOption', () => {
  function buildSelect(values: string[]): HTMLSelectElement {
    const select = document.createElement('select');
    for (const value of values) {
      const option = document.createElement('option');
      option.value = value;
      select.appendChild(option);
    }
    return select;
  }

  it('sets the value and fires input, change, blur when the option exists', () => {
    const select = buildSelect(['1', '38']);
    const seen = captureEvents(select);

    const result = selectOption(select, '38');

    expect(result).toBe(true);
    expect(select.value).toBe('38');
    expect(seen).toEqual(['input', 'change', 'blur']);
  });

  it('returns false and fires no events when the option does not exist', () => {
    const select = buildSelect(['1', '38']);
    select.value = '1';
    const seen = captureEvents(select);

    const result = selectOption(select, '999');

    expect(result).toBe(false);
    expect(select.value).toBe('1'); // unchanged
    expect(seen).toEqual([]);
  });

  it('returns false for a select with no options yet (e.g. Level/Schedule before a postback fills them, docs/04-field-map.md)', () => {
    const select = buildSelect([]);
    const seen = captureEvents(select);

    const result = selectOption(select, 'Basic');

    expect(result).toBe(false);
    expect(seen).toEqual([]);
  });
});

describe('attachFile', () => {
  it('builds a File from the blob and hands it to assignFile, then fires input and change (no blur)', () => {
    const input = document.createElement('input');
    input.type = 'file';
    const seen = captureEvents(input);
    const blob = new Blob([new Uint8Array(10)], { type: 'image/png' });
    const assignFile = vi.fn();

    attachFile(input, blob, 'photo.png', assignFile);

    expect(assignFile).toHaveBeenCalledTimes(1);
    const [assignedInput, assignedFile] = assignFile.mock.calls[0] as [HTMLInputElement, File];
    expect(assignedInput).toBe(input);
    expect(assignedFile.name).toBe('photo.png');
    expect(assignedFile.type).toBe('image/png');
    expect(assignedFile.size).toBe(10);
    expect(seen).toEqual(['input', 'change']);
  });
});

describe('findElement', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('returns the first selector that matches, in order', () => {
    document.body.innerHTML = '<input id="txtName" name="txtName" />';
    const result = findElement(['#txtName', '[name="txtName"]']);
    expect(result).toBe(document.getElementById('txtName'));
  });

  it('falls through to a later selector when an earlier one matches nothing', () => {
    document.body.innerHTML = '<input name="txtName" />'; // no id
    const result = findElement(['#txtName', '[name="txtName"]']);
    expect(result).toBe(document.querySelector('[name="txtName"]'));
  });

  it('returns null when no selector matches anything', () => {
    document.body.innerHTML = '<div></div>';
    expect(findElement(['#txtName', '[name="txtName"]'])).toBeNull();
  });
});

describe('waitForReload', () => {
  const originalReadyState = Object.getOwnPropertyDescriptor(Document.prototype, 'readyState');

  function setReadyState(value: DocumentReadyState): void {
    Object.defineProperty(document, 'readyState', { value, configurable: true });
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    if (originalReadyState) {
      Object.defineProperty(Document.prototype, 'readyState', originalReadyState);
    }
  });

  it('resolves false (times out) if readyState never reaches complete', async () => {
    setReadyState('loading');
    const promise = waitForReload({ readValue: () => 'same', pollIntervalMs: 10, timeoutMs: 100 });

    await vi.advanceTimersByTimeAsync(200);

    expect(await promise).toBe(false);
  });

  it('resolves true once readyState is complete and the read value stops changing', async () => {
    setReadyState('complete');
    const sequence = ['a', 'b', 'b', 'b'];
    let i = 0;
    const readValue = vi.fn(() => sequence[Math.min(i++, sequence.length - 1)]);

    const promise = waitForReload({ readValue, pollIntervalMs: 10, timeoutMs: 1000 });
    await vi.advanceTimersByTimeAsync(100);

    expect(await promise).toBe(true);
  });

  it('resolves false if the value keeps changing until the timeout', async () => {
    setReadyState('complete');
    let n = 0;
    const readValue = () => `v${n++}`;

    const promise = waitForReload({ readValue, pollIntervalMs: 10, timeoutMs: 100 });
    await vi.advanceTimersByTimeAsync(200);

    expect(await promise).toBe(false);
  });

  it('defaults to trivially stable (resolves true as soon as readyState is complete) when no readValue is given', async () => {
    setReadyState('complete');
    const promise = waitForReload({ pollIntervalMs: 10, timeoutMs: 1000 });

    await vi.advanceTimersByTimeAsync(30);

    expect(await promise).toBe(true);
  });
});
