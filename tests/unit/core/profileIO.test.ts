import { describe, expect, it } from 'vitest';
import { createEmptyProfile } from '../../../src/core/profile';
import { exportProfile, parseProfileImport } from '../../../src/core/profileIO';

describe('profile export/import', () => {
  it('round-trips', () => {
    const p = createEmptyProfile();
    p.personal.name = 'A B';
    const r = parseProfileImport(exportProfile(p));
    expect(r.ok && r.profile.personal.name).toBe('A B');
  });
  it('rejects junk', () => {
    expect(parseProfileImport('nope').ok).toBe(false);
    expect(parseProfileImport('{"a":1}').ok).toBe(false);
    expect(parseProfileImport('null').ok).toBe(false);
  });
  it('fills gaps in a partial import', () => {
    const r = parseProfileImport('{"format":"iism-form-filler-profile","version":1,"profile":{"personal":{"name":"X"}}}');
    expect(r.ok && r.profile.contact.mobile).toBe('');
  });
});
