import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initContentScript } from '../../../src/content/index';

type Listener = (message: unknown) => void;

function createChromeMock() {
  const sendMessage = vi.fn(() => Promise.resolve());
  const listeners: Listener[] = [];
  return {
    chrome: {
      runtime: {
        id: 'test-extension-id',
        sendMessage,
        onMessage: {
          addListener: vi.fn((cb: Listener) => listeners.push(cb)),
        },
      },
    },
    sendMessage,
    listeners,
  };
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('initContentScript', () => {
  it('announces READY immediately on init', () => {
    const { chrome, sendMessage } = createChromeMock();
    vi.stubGlobal('chrome', chrome);

    initContentScript();

    expect(sendMessage).toHaveBeenCalledWith({ type: 'READY' });
  });

  it('executes a RUN_STEP message and replies with a matching STEP_RESULT', () => {
    document.body.innerHTML = '<input id="txtName" name="txtName" />';
    const { chrome, sendMessage, listeners } = createChromeMock();
    vi.stubGlobal('chrome', chrome);

    initContentScript();
    sendMessage.mockClear(); // drop the READY call from the assertion below
    listeners[0]?.({ type: 'RUN_STEP', id: 'txtName', kind: 'text', value: 'Test Name' });

    expect((document.getElementById('txtName') as HTMLInputElement).value).toBe('Test Name');
    expect(sendMessage).toHaveBeenCalledWith({ type: 'STEP_RESULT', id: 'txtName', status: 'ok', message: undefined });
  });

  it('replies with a failed STEP_RESULT when the step cannot be executed', () => {
    document.body.innerHTML = ''; // no element for txtName
    const { chrome, sendMessage, listeners } = createChromeMock();
    vi.stubGlobal('chrome', chrome);

    initContentScript();
    sendMessage.mockClear();
    listeners[0]?.({ type: 'RUN_STEP', id: 'txtName', kind: 'text', value: 'Test Name' });

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'STEP_RESULT', id: 'txtName', status: 'failed' }),
    );
  });

  it('ignores a message that is not RUN_STEP', () => {
    const { chrome, sendMessage, listeners } = createChromeMock();
    vi.stubGlobal('chrome', chrome);

    initContentScript();
    sendMessage.mockClear();
    listeners[0]?.({ type: 'SOME_OTHER_MESSAGE' });

    expect(sendMessage).not.toHaveBeenCalled();
  });
});

describe('page inspection messages', () => {
  it('CHECK_PAGE reports mapped fields missing from the page', () => {
    document.body.innerHTML = '<input id="txtName" />';
    const { chrome, listeners } = createChromeMock();
    vi.stubGlobal('chrome', chrome);
    initContentScript();
    const sendResponse = vi.fn();
    (listeners[0] as (m: unknown, s: unknown, r: (x: unknown) => void) => void)({ type: 'CHECK_PAGE' }, {}, sendResponse);
    const arg = sendResponse.mock.calls[0]?.[0] as { missing: string[] };
    expect(arg.missing).toContain('txtEmergencyContactName');
    expect(arg.missing).not.toContain('txtName');
  });

  it('HIGHLIGHT_REQUIRED outlines empty required fields only', () => {
    document.body.innerHTML = '<input id="txtName" value="" /><input id="txtNationality" value="Indian" />';
    const { chrome, listeners } = createChromeMock();
    vi.stubGlobal('chrome', chrome);
    initContentScript();
    const sendResponse = vi.fn();
    (listeners[0] as (m: unknown, s: unknown, r: (x: unknown) => void) => void)({ type: 'HIGHLIGHT_REQUIRED' }, {}, sendResponse);
    const arg = sendResponse.mock.calls[0]?.[0] as { empty: string[] };
    expect(arg.empty).toContain('txtName');
    expect(arg.empty).not.toContain('txtNationality');
    expect(document.getElementById('txtName')?.style.outline).toContain('solid');
    expect(document.getElementById('txtNationality')?.style.outline).toBe('');
  });
});
