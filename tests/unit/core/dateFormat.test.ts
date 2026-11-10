import { describe, expect, it } from 'vitest';
import { isoToFormDate } from '../../../src/core/dateFormat';

describe('isoToFormDate', () => {
  const cases: Array<[string, string | null]> = [
    ['2005-06-15', '15/06/2005'],
    ['2000-02-29', '29/02/2000'], // leap year
    ['1900-01-01', '01/01/1900'], // inclusive lower boundary
    ['2099-12-31', '31/12/2099'], // inclusive upper boundary
    ['1900-02-29', null], // 1900 is not a leap year
    ['2024-02-30', null], // Feb never has 30 days
    ['2024-13-01', null], // invalid month
    ['1899-05-01', null], // below supported range
    ['2101-05-01', null], // above supported range
    ['not-a-date', null],
    ['2024-5-5', null], // must be zero-padded ISO
    ['', null],
    [' 2005-06-15 ', '15/06/2005'], // tolerates surrounding whitespace
  ];

  for (const [input, expected] of cases) {
    it(`${JSON.stringify(input)} -> ${JSON.stringify(expected)}`, () => {
      expect(isoToFormDate(input)).toBe(expected);
    });
  }
});
