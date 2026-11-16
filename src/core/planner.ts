import { FIELD_MAP, type FieldKind, getByPath, getFieldById } from './fieldMap';
import type { Profile } from './profile';

export interface PreflightResult {
  ready: boolean;
  missingFields: string[];
  missingDocs: string[];
}

// "Missing from the profile," not "falsy" — a checkbox's explicit `false` counts as
// present (there's no required checkbox field today, so this doesn't matter yet, but
// if one ever becomes required:true, isEmpty must not treat an unchecked box as
// missing data; "box ticked or not" is a different question from "value is set").
// Also does not trim: a whitespace-only string passes as present. Trimming is
// profile.ts's validators' job (e.g. isValidEmail, isValidPincode already trim);
// preflight only checks presence, not validity.
function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

// Required file fields (notably FupParentGuardianSignature, which docs/04-field-map.md
// says the site demands "even for adults") are checked the same way regardless of the
// profile's DOB — there is deliberately no age-based exemption anywhere in here.
// B6: the site demands a guardian signature even for adults; when only the applicant's
// signature is stored, that same file is reused for the guardian slot.
export const GUARDIAN_DOC = 'docs.guardianSignature';
export const SIGNATURE_DOC = 'docs.signature';
function withDerivedDocs(docs: ReadonlySet<string>): ReadonlySet<string> {
  return docs.has(GUARDIAN_DOC) || !docs.has(SIGNATURE_DOC) ? docs : new Set([...docs, GUARDIAN_DOC]);
}

export function preflight(profile: Profile, rawDocs: ReadonlySet<string>): PreflightResult {
  const availableDocs = withDerivedDocs(rawDocs);
  const missingFields: string[] = [];
  const missingDocs: string[] = [];

  for (const def of FIELD_MAP) {
    if (!def.required || def.kind === 'readonly') {
      continue;
    }
    if (def.kind === 'file') {
      if (def.source === null || !availableDocs.has(def.source)) {
        missingDocs.push(def.id);
      }
      continue;
    }
    const value = def.source === null ? undefined : getByPath(profile, def.source);
    if (isEmpty(value)) {
      missingFields.push(def.id);
    }
  }

  return { ready: missingFields.length === 0 && missingDocs.length === 0, missingFields, missingDocs };
}

export interface FillStep {
  id: string;
  source: string;
  kind: FieldKind;
  awaitReload: boolean;
}

// Per CLAUDE.md's domain gotchas: course -> (level, schedule, state) -> text/dropdowns/
// declaration -> DOB (last reload) -> files last. This specific sequence for the first
// four postback fields isn't derivable from FIELD_MAP's `postback` flag alone (that only
// says *which* fields postback, not the required order among them), so it's explicit here.
const COURSE_SEQUENCE = ['ddlCourse', 'ddlCourseLevel', 'ddlScheduleCourse', 'ddlState'];
const DOB_ID = 'txtDateOfBirth';

// Fails fast at import time if fieldMap.ts ever renames/removes one of these ids,
// instead of COURSE_SEQUENCE silently degrading (addFieldStep would just no-op).
for (const id of COURSE_SEQUENCE) {
  if (!getFieldById(id)) {
    throw new Error(`planner.ts COURSE_SEQUENCE references unknown field id "${id}"`);
  }
}

// Precondition: callers should check `preflight(profile, availableDocs).ready` first.
// buildPlan does not validate cross-field dependencies — all four COURSE_SEQUENCE
// fields are required:true in fieldMap.ts, so preflight already catches an incomplete
// course selection; buildPlan itself stops emitting course steps at the first empty one
// rather than risk selecting e.g. a schedule option before the level postback that
// populates it has even run.
//
// Also page-state-agnostic by design: buildPlan only knows the profile and which docs
// exist, never what's already on the page, so it always re-selects every field with a
// value — it does not implement docs/03-architecture.md's "skip if already correct"
// idempotency decision. That's deferred entirely to the DOM executor (T-030/T-032),
// which does see page state.
export function buildPlan(profile: Profile, rawDocs: ReadonlySet<string>): FillStep[] {
  const availableDocs = withDerivedDocs(rawDocs);
  const steps: FillStep[] = [];

  function addFieldStep(id: string): boolean {
    const def = getFieldById(id);
    if (!def || def.source === null) {
      return false;
    }
    const value = getByPath(profile, def.source);
    if (isEmpty(value)) {
      return false;
    }
    steps.push({ id: def.id, source: def.source, kind: def.kind, awaitReload: def.postback });
    return true;
  }

  for (const id of COURSE_SEQUENCE) {
    if (!addFieldStep(id)) {
      break; // stop at the first missing course field rather than leaving a gap
    }
  }

  const courseIds: ReadonlySet<string> = new Set(COURSE_SEQUENCE);
  for (const def of FIELD_MAP) {
    // Course fields are only ever added via the COURSE_SEQUENCE loop above (which
    // stops at the first missing one) — never re-attempted here, even if a later
    // course field in table order still has a value.
    if (courseIds.has(def.id) || def.kind === 'file' || def.kind === 'readonly' || def.id === DOB_ID) {
      continue;
    }
    addFieldStep(def.id);
  }

  addFieldStep(DOB_ID);

  for (const def of FIELD_MAP) {
    if (def.kind !== 'file' || def.source === null || !availableDocs.has(def.source)) {
      continue;
    }
    steps.push({ id: def.id, source: def.source, kind: def.kind, awaitReload: false });
  }

  return steps;
}
