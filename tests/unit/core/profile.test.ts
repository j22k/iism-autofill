import { describe, expect, it } from 'vitest';
import {
  createEmptyProfile,
  isValidDob,
  isValidEmail,
  isValidPincode,
  mergeProfile,
  normalizePhone,
  profileDisplayName,
  type Profile,
} from '../../../src/core/profile';

describe('normalizePhone', () => {
  const cases: Array<[string, string | null]> = [
    ['+91 98765-43210', '9876543210'],
    ['919876543210', '9876543210'],
    ['09876543210', '9876543210'],
    ['9876543210', '9876543210'],
    ['98765432100', null], // 11 digits, no recognizable prefix
    ['abc9876543210', null], // letters not allowed
    ['+1 1234567890', null], // 11 digits starting 1, not a 0/91 prefix
    ['123', null], // too short
    ['', null],
    ['910123456789', null], // strips "91" to "0123456789" — doesn't look like a real mobile number
    ['0000000000', null], // 10 digits but not a plausible mobile number (must start 6-9)
  ];

  for (const [input, expected] of cases) {
    it(`${JSON.stringify(input)} -> ${JSON.stringify(expected)}`, () => {
      expect(normalizePhone(input)).toBe(expected);
    });
  }
});

describe('isValidEmail', () => {
  const cases: Array<[string, boolean]> = [
    ['user@example.com', true],
    ["user.name+tag'x@sub.example.co.in", true],
    ['invalid@', false],
    ['invalid.com', false],
    ['', false],
    ['  user@example.com  ', true], // tolerate copy-paste whitespace
  ];

  for (const [input, expected] of cases) {
    it(`${JSON.stringify(input)} -> ${expected}`, () => {
      expect(isValidEmail(input)).toBe(expected);
    });
  }
});

describe('isValidPincode', () => {
  const cases: Array<[string, boolean]> = [
    ['560001', true],
    ['12345', false],
    ['1234567', false],
    ['abcdef', false],
    [' 560001 ', true],
    ['000001', false], // Indian PIN codes never start with 0
    ['', false],
  ];

  for (const [input, expected] of cases) {
    it(`${JSON.stringify(input)} -> ${expected}`, () => {
      expect(isValidPincode(input)).toBe(expected);
    });
  }
});

describe('isValidDob', () => {
  const cases: Array<[string, boolean]> = [
    ['2005-06-15', true],
    ['1900-01-01', true], // inclusive lower boundary
    ['2099-12-31', true], // inclusive upper boundary
    ['2000-02-29', true], // 2000 is a leap year
    ['1900-02-29', false], // 1900 is not a leap year (div by 100, not 400)
    ['2024-02-30', false], // Feb never has 30 days
    ['2024-13-01', false], // invalid month
    ['2024-00-10', false], // invalid month
    ['1899-05-01', false], // below supported range
    ['2101-05-01', false], // above supported range
    ['not-a-date', false],
    ['2024-5-5', false], // must be zero-padded ISO
    ['', false],
  ];

  for (const [input, expected] of cases) {
    it(`${JSON.stringify(input)} -> ${expected}`, () => {
      expect(isValidDob(input)).toBe(expected);
    });
  }
});

describe('createEmptyProfile', () => {
  it('returns every leaf as an empty string and declaration.agree as false', () => {
    expect(createEmptyProfile()).toEqual({
      course: { type: '', level: '', batch: '', state: '' },
      personal: { name: '', fatherName: '', nationality: '', dob: '', domicile: '' },
      address: { house: '', street: '', city: '', pincode: '' },
      contact: { mobile: '', email: '' },
      education: { qualification: '' },
      medical: { diet: '', bloodGroup: '', category: '', height: '', weight: '', waist: '', shoeSize: '' },
      emergency: { name: '', phone: '' },
      declaration: { agree: false },
    });
  });
});

describe('mergeProfile', () => {
  const empty = createEmptyProfile();

  it('returns the base profile unchanged when nothing was loaded', () => {
    expect(mergeProfile(empty, null)).toEqual(empty);
  });

  it('passes a fully-populated loaded profile through untouched', () => {
    const full: Profile = {
      course: { type: 'Ski', level: 'Basic', batch: 'Jan-2026', state: 'JAMMU AND KASHMIR' },
      personal: {
        name: 'Test Name',
        fatherName: 'Father Name',
        nationality: 'Indian',
        dob: '2005-06-15',
        domicile: 'Testville',
      },
      address: { house: 'H.No. 1', street: 'Main St', city: 'Testville', pincode: '560001' },
      contact: { mobile: '9876543210', email: 'test@example.com' },
      education: { qualification: 'Graduation' },
      medical: {
        diet: 'Vegetarian',
        bloodGroup: 'O+',
        category: 'General',
        height: '170',
        weight: '60',
        waist: '30',
        shoeSize: '9',
      },
      emergency: { name: 'Emergency Contact', phone: '9876543211' },
      declaration: { agree: true },
    };
    expect(mergeProfile(empty, full)).toEqual(full);
  });

  it('fills missing leaves from the base profile instead of leaving them undefined', () => {
    const partial = { personal: { name: 'Test Name' } } as unknown as Partial<Profile>;
    const merged = mergeProfile(empty, partial);
    expect(merged.personal.name).toBe('Test Name');
    expect(merged.personal.fatherName).toBe('');
    expect(merged.contact).toEqual(empty.contact);
  });
});

describe('profileDisplayName', () => {
  it('returns a placeholder when there is no profile', () => {
    expect(profileDisplayName(null)).toBe('No profile saved yet');
  });

  it("returns the profile's name when set", () => {
    const profile = createEmptyProfile();
    profile.personal.name = 'Test Name';
    expect(profileDisplayName(profile)).toBe('Test Name');
  });

  it('falls back to a placeholder when the profile has no name yet', () => {
    expect(profileDisplayName(createEmptyProfile())).toBe('Unnamed profile');
  });
});
