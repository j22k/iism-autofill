import { describe, expect, it } from 'vitest';
import { createEmptyProfile, type Profile } from '../../../src/core/profile';
import { validateProfile } from '../../../src/core/profileValidation';

function validProfile(): Profile {
  return {
    course: { type: 'Ski', level: 'Basic', batch: 'Jan-2026', state: 'JAMMU AND KASHMIR' },
    personal: { name: 'Test Name', fatherName: 'Father Name', nationality: 'Indian', dob: '2005-06-15' },
    address: { house: 'H.No. 1', street: 'Main St', city: 'Testville', pincode: '560001' },
    contact: { mobile: '9876543210', email: 'test@example.com' },
    education: { qualification: 'Graduation' },
    medical: { bloodGroup: 'O+' },
    emergency: { name: 'Emergency Contact', phone: '9876543211' },
    declaration: { agree: false },
  };
}

describe('validateProfile', () => {
  it('returns no errors for a fully valid profile', () => {
    expect(validateProfile(validProfile())).toEqual([]);
  });

  it('flags a required text field left empty', () => {
    const profile = validProfile();
    profile.personal.name = '';
    const errors = validateProfile(profile);
    expect(errors).toContainEqual({ path: 'personal.name', message: 'Required' });
  });

  it('does not flag an optional field left empty', () => {
    const profile = createEmptyProfile();
    profile.personal.name = 'Test Name';
    profile.personal.fatherName = 'Father Name';
    profile.personal.nationality = 'Indian';
    profile.personal.dob = '2005-06-15';
    profile.address = { house: 'H.No. 1', street: 'Main St', city: 'Testville', pincode: '560001' };
    profile.contact = { mobile: '9876543210', email: 'test@example.com' };
    profile.education.qualification = 'Graduation';
    profile.medical.bloodGroup = 'O+';
    profile.emergency = { name: 'Emergency Contact', phone: '9876543211' };
    profile.course = { type: 'Ski', level: 'Basic', batch: 'Jan-2026', state: 'JAMMU AND KASHMIR' };
    expect(validateProfile(profile)).toEqual([]); // personal.domicile, medical.diet etc stay ''
  });

  it('flags an invalid mobile number with a readable message', () => {
    const profile = validProfile();
    profile.contact.mobile = '12345';
    const errors = validateProfile(profile);
    expect(errors).toContainEqual({ path: 'contact.mobile', message: 'Enter a valid 10-digit mobile number' });
  });

  it('flags an invalid email', () => {
    const profile = validProfile();
    profile.contact.email = 'not-an-email';
    expect(validateProfile(profile)).toContainEqual({ path: 'contact.email', message: 'Enter a valid email address' });
  });

  it('flags an invalid pincode', () => {
    const profile = validProfile();
    profile.address.pincode = '12345';
    expect(validateProfile(profile)).toContainEqual({ path: 'address.pincode', message: 'Enter a valid 6-digit pincode' });
  });

  it('flags an invalid date of birth', () => {
    const profile = validProfile();
    profile.personal.dob = 'not-a-date';
    expect(validateProfile(profile)).toContainEqual({ path: 'personal.dob', message: 'Enter a valid date' });
  });

  it('never flags declaration.agree (not confirmed required by the site)', () => {
    const profile = validProfile();
    profile.declaration.agree = false;
    expect(validateProfile(profile).some((e) => e.path === 'declaration.agree')).toBe(false);
  });

  it('flags a wrong-type stored leaf (e.g. a stale schema storing a number) instead of silently coercing it', () => {
    const profile = validProfile();
    (profile.personal as unknown as { name: number }).name = 123;
    expect(validateProfile(profile)).toContainEqual({ path: 'personal.name', message: 'Invalid stored value' });
  });

  it('flags a non-boolean checkbox leaf as an invalid stored value', () => {
    const profile = validProfile();
    (profile.declaration as unknown as { agree: string }).agree = 'yes';
    expect(validateProfile(profile)).toContainEqual({ path: 'declaration.agree', message: 'Invalid stored value' });
  });
});

describe('site maxlength', () => {
  it('flags text over 50 chars but allows a long street', async () => {
    const { createEmptyProfile } = await import('../../../src/core/profile');
    const p = createEmptyProfile();
    p.personal.name = 'x'.repeat(51);
    p.address.street = 'y'.repeat(200);
    const errs = validateProfile(p);
    expect(errs.find((e) => e.path === 'personal.name')?.message).toContain('50');
    expect(errs.find((e) => e.path === 'address.street')?.message).toBe('Required'.length ? errs.find((e) => e.path === 'address.street')?.message : '');
    expect(errs.find((e) => e.path === 'address.street')?.message ?? '').not.toContain('Too long');
  });
});
