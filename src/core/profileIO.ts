// A5: export/import of the text profile as JSON (documents are not included — they live
// in IndexedDB and are re-added on the options page). Import never trusts the shape.
import { createEmptyProfile, mergeProfile, type Profile } from './profile';

const FORMAT = 'iism-form-filler-profile';

export function exportProfile(profile: Profile): string {
  return JSON.stringify({ format: FORMAT, version: 1, profile }, null, 2);
}

export function parseProfileImport(text: string): { ok: true; profile: Profile } | { ok: false; error: string } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Not valid JSON.' };
  }
  if (typeof data !== 'object' || data === null) {
    return { ok: false, error: 'Not a profile export.' };
  }
  const obj = data as { format?: unknown; profile?: unknown };
  if (obj.format !== FORMAT || typeof obj.profile !== 'object' || obj.profile === null) {
    return { ok: false, error: 'Not an IISM Form Filler profile export.' };
  }
  return { ok: true, profile: mergeProfile(createEmptyProfile(), obj.profile as Partial<Profile>) };
}
