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
