import { describe, expect, it } from 'vitest';
import { courseWarnings } from '../../../src/core/courseWarnings';
import { createEmptyProfile } from '../../../src/core/profile';

describe('courseWarnings', () => {
  it('always reminds about one course per year', () => {
    expect(courseWarnings(createEmptyProfile())).toHaveLength(1);
  });
  it('adds a prerequisite warning for Intermediate/Advanced', () => {
    const p = createEmptyProfile();
    p.course.level = 'Advanced Ski Course';
    expect(courseWarnings(p)).toHaveLength(2);
  });
});
