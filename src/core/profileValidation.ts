import { FIELD_MAP, getByPath } from './fieldMap';
import { isValidDob, isValidEmail, isValidPincode, normalizePhone, type Profile } from './profile';

export interface FieldError {
  path: string;
  message: string;
}

// Keyed by Profile path rather than site field id, since this validates the profile
// itself (options page), not a specific DOM field.
const FORMAT_VALIDATORS: Record<string, (value: string) => string | null> = {
  'contact.mobile': (value) => (normalizePhone(value) === null ? 'Enter a valid 10-digit mobile number' : null),
  'contact.email': (value) => (isValidEmail(value) ? null : 'Enter a valid email address'),
  'address.pincode': (value) => (isValidPincode(value) ? null : 'Enter a valid 6-digit pincode'),
  'personal.dob': (value) => (isValidDob(value) ? null : 'Enter a valid date'),
};

// The site's own maxlength per text box (verified against tests/fixtures/admission.html):
// 50 for every free-text box except street (250). Phones/pincode/DOB have their own
// format validators above (a pasted "+91 98765-43210" is fine - it normalizes).
const MAX_LENGTH_DEFAULT = 50;
const MAX_LENGTH_OVERRIDES: Record<string, number> = { 'address.street': 250 };
const SKIP_LENGTH_CHECK = new Set(['contact.mobile', 'emergency.phone', 'address.pincode', 'personal.dob', 'contact.email']);

// Reuses FIELD_MAP as the single source of truth for which Profile paths are editable
// and required, so this can never drift from the site's own field map. File/readonly
// entries are the site's upload fields and computed display fields, not Profile text
// leaves, so they're excluded here (handled separately by the document manager).
export function validateProfile(profile: Profile): FieldError[] {
  const errors: FieldError[] = [];
  for (const def of FIELD_MAP) {
    if (def.kind === 'file' || def.kind === 'readonly' || def.source === null) {
      continue;
    }
    const value = getByPath(profile, def.source);

    if (def.kind === 'checkbox') {
      // Only chkIAgree is a checkbox today, and it's required:false — this branch is
      // otherwise dormant, but written correctly (not just "not string") so a future
      // required checkbox doesn't get permanently flagged "Required" while checked.
      if (typeof value !== 'boolean') {
        errors.push({ path: def.source, message: 'Invalid stored value' });
      } else if (def.required && value === false) {
        errors.push({ path: def.source, message: 'Required' });
      }
      continue;
    }

    // undefined is the normal "not set" state for an optional leaf that was never
    // merged against createEmptyProfile()'s defaults — distinct from a wrong-type
    // leaf (e.g. a stale schema storing a number/object), which we flag instead of
    // silently coercing (coercing would let `String(value)` render "[object Object]"
    // and then get silently saved back over the original value on the next edit).
    if (value === undefined) {
      if (def.required) {
        errors.push({ path: def.source, message: 'Required' });
      }
      continue;
    }
    if (typeof value !== 'string') {
      errors.push({ path: def.source, message: 'Invalid stored value' });
      continue;
    }
    if (def.required && value === '') {
      errors.push({ path: def.source, message: 'Required' });
      continue;
    }
    if (value === '') {
      continue;
    }
    if (def.kind === 'text' && !SKIP_LENGTH_CHECK.has(def.source)) {
      const max = MAX_LENGTH_OVERRIDES[def.source] ?? MAX_LENGTH_DEFAULT;
      if (value.length > max) {
        errors.push({ path: def.source, message: `Too long - the site allows at most ${max} characters (you have ${value.length})` });
        continue;
      }
    }
    const message = FORMAT_VALIDATORS[def.source]?.(value) ?? null;
    if (message !== null) {
      errors.push({ path: def.source, message });
    }
  }
  return errors;
}
