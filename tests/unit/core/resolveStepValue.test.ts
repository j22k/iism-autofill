import { describe, expect, it } from 'vitest';
import { resolveStepValue } from '../../../src/core/resolveStepValue';
import type { FillStep } from '../../../src/core/planner';
import type { Profile } from '../../../src/core/profile';

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    course: { type: '', level: '', batch: '', state: '' },
    personal: { name: 'Test Name', fatherName: '', nationality: '', dob: '2005-06-15', domicile: '' },
    address: { house: '', street: '', city: '', pincode: '' },
    contact: { mobile: '', email: '' },
    education: { qualification: '' },
    medical: { bloodGroup: '' },
    emergency: { name: '', phone: '' },
    declaration: { agree: true },
    ...overrides,
  };
}

function step(id: string, source: string, kind: FillStep['kind']): FillStep {
  return { id, source, kind, awaitReload: false };
}

describe('resolveStepValue', () => {
  it('returns a plain string value for a text field', () => {
    const value = resolveStepValue(profile(), step('txtName', 'personal.name', 'text'));
    expect(value).toBe('Test Name');
  });

  it('coerces a checkbox field to a boolean', () => {
    const value = resolveStepValue(profile(), step('chkIAgree', 'declaration.agree', 'checkbox'));
    expect(value).toBe(true);
  });

  it('defaults a missing value to an empty string for text/select fields', () => {
    const value = resolveStepValue(profile(), step('txtFatherName', 'personal.fatherName', 'text'));
    expect(value).toBe('');
  });

  it('formats the DOB field to dd/MM/yyyy (dateFormat.ts), not the stored ISO string', () => {
    const value = resolveStepValue(profile(), step('txtDateOfBirth', 'personal.dob', 'text'));
    expect(value).toBe('15/06/2005');
  });

  it('falls back to an empty string for an invalid/missing DOB rather than throwing', () => {
    const value = resolveStepValue(profile({ personal: { ...profile().personal, dob: '' } }), step('txtDateOfBirth', 'personal.dob', 'text'));
    expect(value).toBe('');
  });
});
