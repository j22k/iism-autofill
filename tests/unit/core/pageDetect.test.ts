import { describe, expect, it } from 'vitest';
import { isAdmissionUrl } from '../../../src/core/pageDetect';

describe('isAdmissionUrl', () => {
  const cases: Array<[string | undefined, boolean]> = [
    ['https://admission.iismgulmarg.in/', true],
    ['https://admission.iismgulmarg.in/Default.aspx', true],
    ['http://admission.iismgulmarg.in/', true], // scheme-agnostic: this is a UI hint, not a security boundary
    ['https://admission.iismgulmarg.in.evil.com/', false],
    ['https://evil.com/admission.iismgulmarg.in', false],
    ['https://example.com/', false],
    [undefined, false], // chrome strips `url` for tabs outside our host permissions
    ['', false],
    ['not a url', false],
  ];

  for (const [input, expected] of cases) {
    it(`${JSON.stringify(input)} -> ${expected}`, () => {
      expect(isAdmissionUrl(input)).toBe(expected);
    });
  }
});
