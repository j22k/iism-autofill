import { describe, expect, it } from 'vitest';
import { formatSummary, labelForStepId, summarizeReport } from '../../../src/core/fillReport';
import type { StepReport } from '../../../src/core/fillRun';

function report(entries: Array<[string, StepReport['status']]>): StepReport[] {
  return entries.map(([id, status]) => ({ id, status }));
}

describe('summarizeReport', () => {
  it('counts each status and the total', () => {
    const summary = summarizeReport(
      report([
        ['txtName', 'ok'],
        ['txtFatherName', 'ok'],
        ['ddlVegetarianOrNon', 'skipped'],
        ['txtBloodGroup', 'failed'],
      ]),
    );
    expect(summary).toEqual({ ok: 2, skipped: 1, failed: 1, total: 4 });
  });

  it('returns all zeros for an empty report', () => {
    expect(summarizeReport([])).toEqual({ ok: 0, skipped: 0, failed: 0, total: 0 });
  });
});

describe('formatSummary', () => {
  it('reports a clean "filled N/N" with no breakdown when nothing was skipped or failed', () => {
    expect(formatSummary({ ok: 24, skipped: 0, failed: 0, total: 24 })).toBe('Filled 24/24.');
  });

  it('includes a skipped count when present', () => {
    expect(formatSummary({ ok: 21, skipped: 3, failed: 0, total: 24 })).toBe('Filled 21/24 — 3 skipped.');
  });

  it('includes a failed count when present', () => {
    expect(formatSummary({ ok: 20, skipped: 0, failed: 4, total: 24 })).toBe('Filled 20/24 — 4 failed.');
  });

  it('includes both skipped and failed counts together', () => {
    expect(formatSummary({ ok: 18, skipped: 3, failed: 3, total: 24 })).toBe('Filled 18/24 — 3 skipped, 3 failed.');
  });
});

describe('labelForStepId', () => {
  it('labels a step bound to a profile field by its section and source path', () => {
    expect(labelForStepId('txtName')).toBe('Basic — Name');
    expect(labelForStepId('ddlCourse')).toBe('Course — Type');
  });

  it('labels a file step by its section and docs.* source path', () => {
    expect(labelForStepId('FupPhototOfApplicant')).toBe('Photo — Photo');
  });

  it('disambiguates two different fields that would otherwise share a bare label', () => {
    // personal.name (txtName) and emergency.name (txtEmergencyContactName) both end in
    // "name" — without the section prefix these would be indistinguishable in a flat
    // per-field report list (the whole point of C7).
    expect(labelForStepId('txtName')).not.toBe(labelForStepId('txtEmergencyContactName'));
    expect(labelForStepId('txtEmergencyContactName')).toBe('Indemnity — Name');
  });

  it('still includes a section prefix for a readonly/computed field with no source path', () => {
    expect(labelForStepId('txtCourseFee')).toBe('Course — Txt Course Fee');
  });

  it('falls back to humanizing the raw id, with no section, for an unknown step id', () => {
    expect(labelForStepId('someUnknownStep')).toBe('Some Unknown Step');
  });
});
