import { describe, expect, it } from 'vitest';
import { matchOption } from '../../../src/core/match';
import { SITE_OPTIONS } from '../../../src/core/siteOptions';
import { createEmptyProfile } from '../../../src/core/profile';
import { getByPath } from '../../../src/core/fieldMap';

describe('SITE_OPTIONS', () => {
  it('only keys real profile paths', () => {
    for (const path of Object.keys(SITE_OPTIONS)) {
      expect(getByPath(createEmptyProfile(), path), path).not.toBeUndefined();
    }
  });
  it('every listed option matches itself exactly against the list', () => {
    for (const [path, list] of Object.entries(SITE_OPTIONS)) {
      for (const name of list) {
        expect(matchOption(name, [...list]), `${path}: ${name}`).toEqual({ status: 'matched', option: name });
      }
    }
  });
});
