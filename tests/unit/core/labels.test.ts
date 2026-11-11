import { describe, expect, it } from 'vitest';
import { humanize, labelForPath } from '../../../src/core/labels';

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

describe('labelForPath', () => {
  const cases: Array<[string, string]> = [
    ['personal.fatherName', 'Father Name'],
    ['docs.dobProof', 'Dob Proof'],
    ['docs.guardianSignature', 'Guardian Signature'],
    ['bloodGroup', 'Blood Group'], // no dot — uses the whole identifier
  ];

  for (const [input, expected] of cases) {
    it(`${JSON.stringify(input)} -> ${JSON.stringify(expected)}`, () => {
      expect(labelForPath(input)).toBe(expected);
    });
  }
});
