// Resolves a FillStep's raw value from the profile, for every step kind except
// 'file' (whose Blob payload only the service worker can read, from IndexedDB —
// src/background/service-worker.ts handles that half directly). Pure and
// chrome-free: text/select fields pass through as a string, checkboxes coerce to a
// boolean, and DOB converts from its stored ISO form to dd/MM/yyyy "at fill time" per
// profile.ts's own comment on `personal.dob`.
import { getByPath } from './fieldMap';
import { isoToFormDate } from './dateFormat';
import type { FillStep } from './planner';
import type { Profile } from './profile';

const DOB_ID = 'txtDateOfBirth';

export function resolveStepValue(profile: Profile, step: FillStep): string | boolean {
  const raw = getByPath(profile, step.source);
  if (step.id === DOB_ID) {
    return isoToFormDate(String(raw ?? '')) ?? '';
  }
  if (step.kind === 'checkbox') {
    return Boolean(raw);
  }
  return String(raw ?? '');
}
