// Injected on the admission form (manifest.json). Announces READY on every injection
// — including the re-injection after a postback reload, which is the service worker's
// only signal that a reload it was waiting on (src/core/fillRun.ts) has completed —
// and executes whatever single RUN_STEP the service worker sends, reporting the
// outcome back. Never decides what to fill or in what order; that's buildPlan's job
// (core/planner.ts) and the service worker's orchestration (background/service-worker.ts).
import { findEmptyRequired, findMissingFields } from '../core/drift';
import { executeStep } from './executeStep';
import type { BackgroundToContentMessage, ContentToBackgroundMessage } from '../shared/messages';

export function initContentScript(): void {
  const ready: ContentToBackgroundMessage = { type: 'READY' };
  // The service worker can be mid-restart (woken by the alarm that's about to deliver
  // this very reload's watchdog) when this fires — not an error worth surfacing, same as
  // service-worker.ts's own broadcast() swallowing its send failures.
  void chrome.runtime.sendMessage(ready).catch(() => {});

  chrome.runtime.onMessage.addListener((message: BackgroundToContentMessage, _sender, sendResponse) => {
    if (message.type === 'CHECK_PAGE') {
      sendResponse({ missing: findMissingFields((id) => document.getElementById(id) !== null) });
      return;
    }
    if (message.type === 'HIGHLIGHT_REQUIRED') {
      const empty = findEmptyRequired((id, kind) => {
        const el = document.getElementById(id);
        if (!el) {
          return false;
        }
        if (kind === 'file') {
          return ((el as HTMLInputElement).files?.length ?? 0) === 0;
        }
        const v = (el as HTMLInputElement).value;
        return v === '' || v === '0';
      });
      for (const id of empty) {
        document.getElementById(id)?.style.setProperty('outline', '2px solid #d93025');
      }
      const dobMessage = document.getElementById('lblDOBMsg')?.textContent?.trim() ?? '';
      sendResponse({ empty, ...(dobMessage ? { dobMessage } : {}) });
      return;
    }
    if (message.type !== 'RUN_STEP') {
      return;
    }
    const result = executeStep({
      id: message.id,
      kind: message.kind,
      value: message.value,
      ...(message.file !== undefined ? { file: message.file } : {}),
    });
    const resultMessage: ContentToBackgroundMessage = {
      type: 'STEP_RESULT',
      id: message.id,
      status: result.status,
      ...(result.message !== undefined ? { message: result.message } : {}),
    };
    void chrome.runtime.sendMessage(resultMessage).catch(() => {});
  });
}

// Only self-initializes when actually running as an injected content script — `chrome`
// is undefined at plain module-import time (e.g. under this file's own unit tests,
// which call initContentScript() themselves against a mocked chrome).
if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
  initContentScript();
}
