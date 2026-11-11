import { describe, expect, it } from 'vitest';
import {
  EDITABLE_FIELDS,
  FIELD_MAP,
  getByPath,
  getFieldById,
  getFieldBySource,
  groupFieldsBySection,
  selectorsForId,
  setByPath,
} from '../../../src/core/fieldMap';
import { createEmptyProfile, type Profile } from '../../../src/core/profile';

const SAMPLE_PROFILE: Profile = {
  course: { type: 'ski', level: 'Basic', batch: 'batch-1', state: 'JAMMU AND KASHMIR' },
  personal: {
    name: 'Test Name',
    fatherName: 'Father Name',
    nationality: 'Indian',
    dob: '2005-06-15',
    domicile: 'Testville',
  },
  address: { house: 'H.No. 1', street: 'Main St', city: 'Testville', pincode: '560001' },
  contact: { mobile: '9876543210', email: 'test@example.com' },
  education: { qualification: 'Graduation' },
  medical: {
    diet: 'Vegetarian',
    bloodGroup: 'O+',
    category: 'A',
    height: '170',
    weight: '60',
    waist: '32',
    shoeSize: '9',
  },
  emergency: { name: 'Emergency Contact', phone: '9876543211' },
  declaration: { agree: false },
};

describe('FIELD_MAP', () => {
  it('never includes the submit or reset buttons', () => {
    expect(FIELD_MAP.some((field) => field.id === 'btnSubmit')).toBe(false);
    expect(FIELD_MAP.some((field) => field.id === 'btnReset')).toBe(false);
  });

  it('has no duplicate ids', () => {
    const ids = FIELD_MAP.map((field) => field.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has exactly 36 entries (every fillable row in docs/04-field-map.md)', () => {
    expect(FIELD_MAP).toHaveLength(36);
  });

  it('marks exactly the field-map-verified postback fields as postback:true (pins the whole column)', () => {
    const postbackIds = ['ddlCourse', 'ddlCourseLevel', 'ddlScheduleCourse', 'ddlState', 'txtDateOfBirth'];
    const actual = FIELD_MAP.filter((field) => field.postback)
      .map((field) => field.id)
      .sort();
    expect(actual).toEqual([...postbackIds].sort());
  });

  it('only gives a null source to readonly fields, and always a non-null source otherwise', () => {
    for (const field of FIELD_MAP) {
      if (field.kind === 'readonly') {
        expect(field.source).toBeNull();
      } else {
        expect(field.source).not.toBeNull();
      }
    }
  });

  it('resolves every non-file field source against a sample Profile', () => {
    const unresolved: string[] = [];
    for (const field of FIELD_MAP) {
      if (field.kind === 'file' || field.source === null) {
        continue;
      }
      if (getByPath(SAMPLE_PROFILE, field.source) === undefined) {
        unresolved.push(`${field.id} -> ${field.source}`);
      }
    }
    expect(unresolved).toEqual([]);
  });

  it('gives every file field a source under the docs.* namespace', () => {
    for (const field of FIELD_MAP.filter((f) => f.kind === 'file')) {
      expect(field.source).toMatch(/^docs\./);
    }
  });

  it('getFieldById finds a known field and returns undefined for an unknown one', () => {
    expect(getFieldById('txtEmailId')?.source).toBe('contact.email');
    expect(getFieldById('nope')).toBeUndefined();
  });

  it('getFieldBySource finds a known field and returns undefined for an unknown one', () => {
    expect(getFieldBySource('contact.email')?.id).toBe('txtEmailId');
    expect(getFieldBySource('nope')).toBeUndefined();
  });
});

describe('EDITABLE_FIELDS', () => {
  it('excludes every file and readonly field', () => {
    expect(EDITABLE_FIELDS.some((f) => f.kind === 'file' || f.kind === 'readonly')).toBe(false);
  });

  it('includes select- and checkbox-kind fields alongside text fields', () => {
    expect(EDITABLE_FIELDS.some((f) => f.id === 'ddlCourse' && f.kind === 'select')).toBe(true);
    expect(EDITABLE_FIELDS.some((f) => f.id === 'chkIAgree' && f.kind === 'checkbox')).toBe(true);
    expect(EDITABLE_FIELDS.some((f) => f.id === 'txtName' && f.kind === 'text')).toBe(true);
  });

  it('is exactly FIELD_MAP minus file/readonly entries', () => {
    const expectedCount = FIELD_MAP.filter((f) => f.kind !== 'file' && f.kind !== 'readonly').length;
    expect(EDITABLE_FIELDS).toHaveLength(expectedCount);
  });
});

describe('groupFieldsBySection', () => {
  it('groups by section preserving first-appearance and within-group order', () => {
    const fields = [
      { section: 'A', id: '1' },
      { section: 'B', id: '2' },
      { section: 'A', id: '3' },
    ];
    expect(groupFieldsBySection(fields)).toEqual([
      ['A', [{ section: 'A', id: '1' }, { section: 'A', id: '3' }]],
      ['B', [{ section: 'B', id: '2' }]],
    ]);
  });

  it('returns an empty array for no fields', () => {
    expect(groupFieldsBySection([])).toEqual([]);
  });
});

describe('selectorsForId', () => {
  it('builds the id-first, name-fallback selector list', () => {
    expect(selectorsForId('txtName')).toEqual(['#txtName', '[name="txtName"]', '[name$="txtName"]']);
  });
});

describe('getByPath', () => {
  it('resolves a nested dotted path', () => {
    expect(getByPath(SAMPLE_PROFILE, 'contact.email')).toBe('test@example.com');
  });

  it('returns undefined for a missing path', () => {
    expect(getByPath(SAMPLE_PROFILE, 'contact.fax')).toBeUndefined();
    expect(getByPath(SAMPLE_PROFILE, 'nonexistent.path')).toBeUndefined();
  });
});

describe('setByPath', () => {
  it('writes a nested dotted path without disturbing sibling leaves', () => {
    const profile = createEmptyProfile();
    setByPath(profile, 'contact.email', 'test@example.com');
    expect(profile.contact.email).toBe('test@example.com');
    expect(profile.contact.mobile).toBe('');
  });

  it('every non-file FIELD_MAP source round-trips through setByPath then getByPath', () => {
    const profile = createEmptyProfile();
    for (const field of FIELD_MAP) {
      if (field.kind === 'file' || field.source === null) {
        continue;
      }
      const value = field.kind === 'checkbox' ? true : 'x';
      setByPath(profile, field.source, value);
      expect(getByPath(profile, field.source)).toBe(value);
    }
  });
});
