// Typed message contracts between the side panel, the service worker, and the content
// script (docs/03-architecture.md's component list). Discriminated on `type` so each
// side's chrome.runtime.onMessage listener can distinguish senders without relying on
// MessageSender shape (content scripts and the extension's own pages both end up
// calling chrome.runtime.sendMessage).
import type { StepReport } from '../core/fillRun';
import type { FieldKind } from '../core/fieldMap';

// Content script -> service worker.

// Announced once on initial injection and again every time a postback tears down and
// re-injects the content script — the service worker's only signal that a reload it
// was waiting on has actually completed (src/core/fillRun.ts's READY event).
export interface ReadyMessage {
  type: 'READY';
}

export interface StepResultMessage {
  type: 'STEP_RESULT';
  id: string;
  status: StepReport['status'];
  message?: string;
}

export type ContentToBackgroundMessage = ReadyMessage | StepResultMessage;

// Service worker -> content script.

export interface FilePayload {
  base64: string;
  mimeType: string;
  filename: string;
}

// Deliberately carries only the resolved value (and, for a file step, its payload) —
// not field metadata like selectors/acceptedTypes. The content script already has
// core/fieldMap.ts bundled in and looks `id` up itself, so the wire format doesn't
// duplicate data that's already available on both sides.
export interface RunStepMessage {
  type: 'RUN_STEP';
  id: string;
  kind: FieldKind;
  value: string | boolean | null;
  file?: FilePayload;
}

export type BackgroundToContentMessage = RunStepMessage;

// Side panel -> service worker.

export interface StartFillMessage {
  type: 'START_FILL';
}

// C8: never clicks the site's own btnReset (Hard Rule 7 — it posts back). A plain tab
// reload clears unsubmitted form state just as well, without ever touching it. Also
// cancels any fill run in progress for that tab (disarms its watchdog, clears its
// persisted session) rather than leaving one to keep running against a page that's
// about to disappear out from under it.
export interface ResetMessage {
  type: 'RESET';
}

export type SidePanelToBackgroundMessage = StartFillMessage | ResetMessage;

// Service worker -> side panel.

export type RunStatus =
  | { phase: 'running' }
  | { phase: 'done'; report: StepReport[] }
  | { phase: 'failed'; message: string; report: StepReport[] };

export interface RunStatusMessage {
  type: 'RUN_STATUS';
  status: RunStatus;
}

export type BackgroundToSidePanelMessage = RunStatusMessage;
