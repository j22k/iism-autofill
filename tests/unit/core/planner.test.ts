import { describe, expect, it } from 'vitest';
import { buildPlan, preflight } from '../../../src/core/planner';
import type { Profile } from '../../../src/core/profile';

function completeProfile(): Profile {
  return {
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
    medical: { diet: 'Vegetarian', bloodGroup: 'O+' },
    emergency: { name: 'Emergency Contact', phone: '9876543211' },
    declaration: { agree: false },
  };
}

const ALL_DOCS = new Set([
  'docs.dobProof',
  'docs.domicileProof',
  'docs.educationProof',
  'docs.adventureCert',
  'docs.employmentProof',
  'docs.photo',
  'docs.signature',
  'docs.guardianSignature',
]);

const REQUIRED_DOCS = new Set([
  'docs.dobProof',
  'docs.educationProof',
  'docs.photo',
  'docs.signature',
  'docs.guardianSignature',
]);

describe('preflight', () => {
  it('is ready when every required field and doc is present', () => {
    expect(preflight(completeProfile(), ALL_DOCS)).toEqual({
      ready: true,
      missingFields: [],
      missingDocs: [],
    });
  });

  it('flags a missing required text field', () => {
    const profile = completeProfile();
    profile.personal.name = '';
    const result = preflight(profile, ALL_DOCS);
    expect(result.ready).toBe(false);
    expect(result.missingFields).toContain('txtName');
  });

  it('flags a missing required doc', () => {
    const docs = new Set(REQUIRED_DOCS);
    docs.delete('docs.photo');
    const result = preflight(completeProfile(), docs);
    expect(result.ready).toBe(false);
    expect(result.missingDocs).toContain('FupPhototOfApplicant');
  });

  it('is ready when only optional fields/docs are missing', () => {
    const profile = completeProfile();
    delete (profile.personal as { domicile?: string }).domicile;
    const docs = new Set(REQUIRED_DOCS); // omits the optional docs entirely

    const result = preflight(profile, docs);

    expect(result.ready).toBe(true);
    expect(result.missingFields).not.toContain('txtDomicile');
    expect(result.missingDocs).not.toContain('FupDomicileAttachProof');
  });

  it('never flags required readonly fields (they are read, not filled, by us)', () => {
    // txtCourseFee is required:true in fieldMap.ts but kind:'readonly' — it's
    // server-computed, not something preflight should ever ask the user to provide.
    const result = preflight(completeProfile(), ALL_DOCS);
    expect(result.missingFields).not.toContain('txtCourseFee');
    expect(result.missingFields).not.toContain('txtAvailableSeat');
  });

  it('requires the guardian signature even for an adult profile (no age exemption)', () => {
    const adultProfile = completeProfile();
    adultProfile.personal.dob = '1990-01-01'; // clearly an adult
    const docs = new Set(REQUIRED_DOCS);
    docs.delete('docs.guardianSignature');
    docs.delete('docs.signature'); // B6: the applicant signature would otherwise stand in

    const result = preflight(adultProfile, docs);

    expect(result.ready).toBe(false);
    expect(result.missingDocs).toContain('FupParentGuardianSignature');
  });
});

describe('buildPlan', () => {
  it('orders course -> level -> schedule -> state first', () => {
    const steps = buildPlan(completeProfile(), ALL_DOCS);
    expect(steps.slice(0, 4).map((step) => step.id)).toEqual([
      'ddlCourse',
      'ddlCourseLevel',
      'ddlScheduleCourse',
      'ddlState',
    ]);
  });

  it('places DOB right before any file steps, with files last', () => {
    const steps = buildPlan(completeProfile(), ALL_DOCS);
    const dobIndex = steps.findIndex((step) => step.id === 'txtDateOfBirth');
    expect(dobIndex).toBeGreaterThan(3);

    for (const step of steps.slice(0, dobIndex + 1)) {
      expect(step.kind).not.toBe('file');
    }
    for (const step of steps.slice(dobIndex + 1)) {
      expect(step.kind).toBe('file');
    }
  });

  it('marks postback fields (and only postback fields) to await a reload', () => {
    const steps = buildPlan(completeProfile(), ALL_DOCS);
    const postbackIds = new Set(['ddlCourse', 'ddlCourseLevel', 'ddlScheduleCourse', 'ddlState', 'txtDateOfBirth']);
    for (const step of steps) {
      expect(step.awaitReload).toBe(postbackIds.has(step.id));
    }
  });

  it('stops the course sequence at the first missing field rather than leaving a gap', () => {
    // ddlCourseLevel empty, but ddlScheduleCourse (which depends on it via postback on
    // the real site) is not — must not select schedule without level having run first.
    const profile = completeProfile();
    profile.course.level = '';

    const steps = buildPlan(profile, ALL_DOCS);

    expect(steps.map((step) => step.id)).not.toContain('ddlScheduleCourse');
    expect(steps.map((step) => step.id)).not.toContain('ddlState');
    expect(steps[0]?.id).toBe('ddlCourse');
  });

  it('skips an empty optional field rather than producing a blank step', () => {
    const profile = completeProfile();
    delete (profile.personal as { domicile?: string }).domicile;
    const steps = buildPlan(profile, ALL_DOCS);
    expect(steps.some((step) => step.id === 'txtDomicile')).toBe(false);
  });

  it('skips an empty required field without crashing (preflight is the gate, not buildPlan)', () => {
    const profile = completeProfile();
    profile.personal.name = '';
    const steps = buildPlan(profile, ALL_DOCS);
    expect(steps.some((step) => step.id === 'txtName')).toBe(false);
  });

  it('includes no file steps when no docs are available', () => {
    const steps = buildPlan(completeProfile(), new Set());
    expect(steps.some((step) => step.kind === 'file')).toBe(false);
  });

  it('never includes a readonly field as a step', () => {
    const steps = buildPlan(completeProfile(), ALL_DOCS);
    expect(steps.some((step) => step.kind === 'readonly')).toBe(false);
  });
});

describe('guardian signature reuse (B6)', () => {
  it('treats the applicant signature as satisfying the guardian slot', async () => {
    const { createEmptyProfile } = await import('../../../src/core/profile');
    const docs = new Set(['docs.signature']);
    const pre = preflight(createEmptyProfile(), docs);
    expect(pre.missingDocs).not.toContain('FupParentGuardianSignature');
    expect(buildPlan(createEmptyProfile(), docs).map((s) => s.id)).toContain('FupParentGuardianSignature');
  });
});
