import { describe, expect, it } from 'vitest';
import { preflightChecklist } from '../../../src/core/preflightChecklist';

describe('preflightChecklist', () => {
  it('returns an empty list when nothing is missing', () => {
    expect(preflightChecklist({ ready: true, missingFields: [], missingDocs: [] })).toEqual([]);
  });

  it('labels each missing field, prefixed with its section like the fill report', () => {
    const items = preflightChecklist({ ready: false, missingFields: ['txtName'], missingDocs: [] });
    expect(items).toEqual([{ id: 'txtName', kind: 'field', label: 'Basic — Name' }]);
  });

  it('labels each missing doc and tags it as a doc, not a field', () => {
    const items = preflightChecklist({ ready: false, missingFields: [], missingDocs: ['FupPhototOfApplicant'] });
    expect(items).toEqual([{ id: 'FupPhototOfApplicant', kind: 'doc', label: 'Photo — Photo' }]);
  });

  it('lists missing fields before missing docs', () => {
    const items = preflightChecklist({ ready: false, missingFields: ['txtName'], missingDocs: ['FupPhototOfApplicant'] });
    expect(items.map((i) => i.kind)).toEqual(['field', 'doc']);
  });
});
