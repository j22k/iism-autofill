import { describe, expect, it } from 'vitest';
import { isValidDob, isValidEmail, isValidPincode, normalizePhone } from '../../../src/core/profile';

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
