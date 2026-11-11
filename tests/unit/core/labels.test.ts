import { describe, expect, it } from 'vitest';
import { humanize } from '../../../src/core/labels';

describe('humanize', () => {
  const cases: Array<[string, string]> = [
    ['name', 'Name'],
    ['fatherName', 'Father Name'],
    ['dob', 'Dob'],
    ['bloodGroup', 'Blood Group'],
    ['pincode', 'Pincode'],
    ['agree', 'Agree'],
    ['shoeSize', 'Shoe Size'],
  ];

  for (const [input, expected] of cases) {
    it(`${JSON.stringify(input)} -> ${JSON.stringify(expected)}`, () => {
      expect(humanize(input)).toBe(expected);
    });
  }
});
