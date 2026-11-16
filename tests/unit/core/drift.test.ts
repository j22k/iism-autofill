import { describe, expect, it } from 'vitest';
import { findEmptyRequired, findMissingFields } from '../../../src/core/drift';

describe('findMissingFields', () => {
  it('is empty when every mapped id exists', () => {
    expect(findMissingFields(() => true)).toEqual([]);
  });
  it('lists ids the page no longer has', () => {
    expect(findMissingFields((id) => id !== 'txtName')).toEqual(['txtName']);
  });
});

describe('findEmptyRequired', () => {
  it('only reports required, non-readonly fields', () => {
    const ids = findEmptyRequired(() => true);
    expect(ids).toContain('txtName');
    expect(ids).not.toContain('txtDomicile');
  });
  it('is empty when nothing is empty', () => {
    expect(findEmptyRequired(() => false)).toEqual([]);
  });
});
