import { describe, expect, it } from 'vitest';
import { matchOption } from '../../../src/core/match';

describe('matchOption', () => {
  it('matches exactly', () => {
    expect(matchOption('ski', ['ski', 'snowboard'])).toEqual({ status: 'matched', option: 'ski' });
  });

  it('exact match wins over a fuzzy tier that would also match other options', () => {
    expect(matchOption('ski', ['ski', 'skiing', 'ski advanced'])).toEqual({
      status: 'matched',
      option: 'ski',
    });
  });

  it('matches case-insensitively and trims, including a trailing space in the option', () => {
    // docs/04-field-map.md: "LADAKH " has a trailing space in the real ddlState options.
    expect(matchOption('LADAKH', ['PUNJAB', 'LADAKH ', 'DELHI'])).toEqual({
      status: 'matched',
      option: 'LADAKH ',
    });
  });

  it('is ambiguous when two options normalize to the same case-insensitive value', () => {
    const result = matchOption('delhi', ['DELHI', 'Delhi']);
    expect(result.status).toBe('ambiguous');
    if (result.status === 'ambiguous') {
      expect(result.options).toEqual(['DELHI', 'Delhi']);
    }
  });

  it('matches fuzzily when the input is a unique substring of one option', () => {
    expect(matchOption('Basic', ['Basic Course Level 1', 'Advanced'])).toEqual({
      status: 'matched',
      option: 'Basic Course Level 1',
    });
  });

  it('is ambiguous when fuzzy matching hits multiple options (e.g. state name variants)', () => {
    const options = ['ANDHRA PRADESH (NEW)', 'ANDHRA PRADESH (OLD)', 'ANDHRA PRADESH (UT)'];
    const result = matchOption('Andhra Pradesh', options);
    expect(result.status).toBe('ambiguous');
    if (result.status === 'ambiguous') {
      expect(result.options).toEqual(options);
    }
  });

  it('is none when nothing matches at any tier', () => {
    expect(matchOption('xyz', ['foo', 'bar'])).toEqual({ status: 'none' });
  });

  it('is none for an empty input', () => {
    expect(matchOption('', ['foo'])).toEqual({ status: 'none' });
  });

  it('is none for a whitespace-only input', () => {
    expect(matchOption('   ', ['foo'])).toEqual({ status: 'none' });
  });

  it('is none for an empty options list', () => {
    expect(matchOption('foo', [])).toEqual({ status: 'none' });
  });

  it('is ambiguous when the exact tier itself finds duplicate options', () => {
    expect(matchOption('X', ['X', 'X'])).toEqual({ status: 'ambiguous', options: ['X', 'X'] });
  });

  it('case-insensitive match wins over a fuzzy tier that would also match other options', () => {
    // "Ski" uniquely matches at the CI tier and never reaches the fuzzy tier, which
    // would otherwise also match "Skiing" and produce ambiguous.
    expect(matchOption('ski', ['Ski', 'Skiing'])).toEqual({ status: 'matched', option: 'Ski' });
  });

  it('normalizes hyphens to spaces so "Non Vegetarian" matches "Non-Vegetarian"', () => {
    expect(matchOption('Non Vegetarian', ['Vegetarian', 'Non-Vegetarian'])).toEqual({
      status: 'matched',
      option: 'Non-Vegetarian',
    });
  });

  it('is ambiguous when a short fuzzy input matches multiple long option strings', () => {
    // Documents the fuzzy tier's deliberate permissiveness (see comment in match.ts):
    // "ski" is a substring of both location variants, and ambiguous is the safe outcome.
    const options = ['Snow Skiing Courses at Gulmarg', 'Snow Skiing Courses at Kargil'];
    expect(matchOption('ski', options)).toEqual({ status: 'ambiguous', options });
  });

  it('trims surrounding whitespace on the input before the case-insensitive tier', () => {
    expect(matchOption(' ski ', ['ski', 'snowboard'])).toEqual({ status: 'matched', option: 'ski' });
  });
});
