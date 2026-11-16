// D4: if the site renames/removes a field, fail loudly before a fill instead of silently
// skipping it. `exists` is injected (document.getElementById in the content script).
import { FIELD_MAP } from './fieldMap';

export function findMissingFields(exists: (id: string) => boolean): string[] {
  return FIELD_MAP.filter((def) => !exists(def.id)).map((def) => def.id);
}

// C13: required fields still empty on the live page (after a fill). `isEmpty` is injected.
export function findEmptyRequired(isEmpty: (id: string, kind: string) => boolean): string[] {
  return FIELD_MAP.filter((def) => def.required && def.kind !== 'readonly' && isEmpty(def.id, def.kind)).map((def) => def.id);
}
