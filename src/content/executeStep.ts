// Executes one resolved fill step against the live page. Thin by design (CLAUDE.md's
// code style): dropdown matching lives in core/match.ts, event-dispatch/file-attach
// primitives live in content/dom.ts, DOB formatting already happened before this was
// called (dateFormat.ts, at the service-worker layer) — this module only wires them
// together and turns the outcome into the StepReport shape src/core/fillRun.ts expects
// back as a STEP_RESULT message.
import { getFieldById, type FieldKind } from '../core/fieldMap';
import { matchOption } from '../core/match';
import type { StepStatus } from '../core/fillRun';
import { base64ToBlob } from '../shared/fileTransfer';
import type { FilePayload } from '../shared/messages';
import { attachFile, findElement, selectOption, setValue, type AssignFile } from './dom';

export interface ExecuteStepInput {
  id: string;
  kind: FieldKind;
  value: string | boolean | null;
  file?: FilePayload;
}

export interface ExecuteStepResult {
  status: StepStatus;
  message?: string;
}

export interface ExecuteStepDeps {
  assignFile?: AssignFile;
}

export function executeStep(input: ExecuteStepInput, deps: ExecuteStepDeps = {}): ExecuteStepResult {
  const def = getFieldById(input.id);
  if (!def) {
    return { status: 'failed', message: `executeStep: unknown field id "${input.id}"` };
  }
  if (def.kind === 'readonly') {
    return { status: 'skipped', message: 'readonly field — never filled' };
  }

  const element = findElement(def.selectors);
  if (!element) {
    return { status: 'failed', message: `executeStep: no element found for "${input.id}"` };
  }

  switch (input.kind) {
    case 'text':
    case 'checkbox': {
      if (!(element instanceof HTMLInputElement)) {
        return { status: 'failed', message: `executeStep: "${input.id}" is not an input element` };
      }
      // docs/03-architecture.md: "skip a field whose current value already equals target" —
      // a re-run (e.g. after adding a missing document) shouldn't redispatch change on,
      // and risk re-posting-back, a field that's already correct.
      if (input.kind === 'checkbox') {
        const target = Boolean(input.value);
        if (element.checked === target) {
          return { status: 'skipped', message: 'already correct' };
        }
        setValue(element, target);
      } else {
        const target = String(input.value ?? '');
        if (element.value === target) {
          return { status: 'skipped', message: 'already correct' };
        }
        setValue(element, target);
      }
      return { status: 'ok' };
    }
    case 'select': {
      if (!(element instanceof HTMLSelectElement)) {
        return { status: 'failed', message: `executeStep: "${input.id}" is not a select element` };
      }
      const raw = String(input.value ?? '').trim();
      if (raw === '') {
        return { status: 'skipped', message: 'no value in profile' };
      }
      const optionLabels = Array.from(element.options).map((option) => option.textContent ?? '');
      const match = matchOption(raw, optionLabels);
      if (match.status === 'none') {
        // Deliberately doesn't echo `raw` (the profile's actual value) back — this
        // message reaches the side panel's fill report (T-033), and a profile value
        // (course/level/state/diet/etc.) has no business ending up there.
        return { status: 'skipped', message: 'no matching option found' };
      }
      if (match.status === 'ambiguous') {
        return { status: 'failed', message: `ambiguous match — matches: ${match.options.join(', ')}` };
      }
      const optionEl = Array.from(element.options).find((option) => (option.textContent ?? '') === match.option);
      if (!optionEl) {
        return { status: 'failed', message: `executeStep: could not select matched option for "${input.id}"` };
      }
      if (element.value === optionEl.value) {
        return { status: 'skipped', message: 'already correct' };
      }
      if (!selectOption(element, optionEl.value)) {
        return { status: 'failed', message: `executeStep: could not select matched option for "${input.id}"` };
      }
      return { status: 'ok' };
    }
    case 'file': {
      if (!(element instanceof HTMLInputElement) || !input.file) {
        return { status: 'failed', message: `executeStep: missing file payload for "${input.id}"` };
      }
      const blob = base64ToBlob(input.file.base64, input.file.mimeType);
      attachFile(element, blob, input.file.filename, deps.assignFile);
      return { status: 'ok' };
    }
    case 'readonly':
      return { status: 'skipped', message: 'readonly field — never filled' };
  }
}
