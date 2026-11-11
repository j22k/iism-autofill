import { DOCUMENT_TYPES, IMAGE_TYPES } from './image';

export type FieldKind = 'select' | 'text' | 'checkbox' | 'file' | 'readonly';

export interface FieldDef {
  id: string;
  section: string;
  kind: FieldKind;
  postback: boolean;
  // Required by the SITE's own validator, not necessarily fillable by us. A
  // `kind: 'readonly'` field (e.g. txtCourseFee) can be required:true while its
  // `source` is null — it's auto-computed by the page, never written by us. Any future
  // "required but unfilled" report (per CLAUDE.md's "filled 21/24, 3 skipped: …") must
  // exclude kind === 'readonly' fields, or it will permanently flag them as failures.
  required: boolean;
  // Dotted path into a Profile (text/select/checkbox fields) or the docs.* namespace
  // (file fields, whose storage shape is defined in T-020). null for computed/display
  // fields we only read for the report, never write (e.g. the server-computed course fee).
  source: string | null;
  // Ordered CSS selector fallbacks. The field map confirms no ctl00_ prefixing (id ==
  // name), so [name="id"] should always hit; [name$="id"] is a defensive fallback in
  // case that ever changes. The architecture doc's third tier ("then label text") is
  // deliberately NOT stored here as a guessed string — Hard Rule 6 forbids hardcoding a
  // guess without a fixture test, and we don't have verified label text for every
  // field. Label-based lookup is a dynamic DOM query (label[for="id"]) done at fill
  // time (T-030), not static data.
  selectors: readonly string[];
  // Only set for kind: 'file'. docs/04-field-map.md's verified details: birth
  // certificate/education/domicile/adventure/employment uploads accept PDF in addition
  // to images; photo/signature/guardian-signature do not (no PDF).
  acceptedTypes?: ReadonlySet<string>;
}

// A third tier, [name="id"] (exact match), is inserted ahead of the [name$="id"]
// (suffix match) that docs/06-backlog.md and docs/03-architecture.md describe — an
// intentional strengthening given docs/04-field-map.md confirms id == name with no
// prefixing, not a deviation from the documented contract.
export function selectorsForId(id: string): string[] {
  return [`#${id}`, `[name="${id}"]`, `[name$="${id}"]`];
}

function field(def: Omit<FieldDef, 'selectors'>): FieldDef {
  return { ...def, selectors: selectorsForId(def.id) };
}

// Transcribed from docs/04-field-map.md. btnSubmit and btnReset are deliberately
// absent — not flagged, just never entered here — so no code that iterates FIELD_MAP
// can ever reach them (Hard Rules 1 and 7).
export const FIELD_MAP: readonly FieldDef[] = [
  // Course
  field({ id: 'ddlCourse', section: 'Course', kind: 'select', postback: true, required: true, source: 'course.type' }),
  field({ id: 'ddlCourseLevel', section: 'Course', kind: 'select', postback: true, required: true, source: 'course.level' }),
  field({ id: 'ddlScheduleCourse', section: 'Course', kind: 'select', postback: true, required: true, source: 'course.batch' }),
  field({ id: 'ddlState', section: 'Course', kind: 'select', postback: true, required: true, source: 'course.state' }),
  field({ id: 'txtAvailableSeat', section: 'Course', kind: 'readonly', postback: false, required: false, source: null }),
  field({ id: 'txtCourseFee', section: 'Course', kind: 'readonly', postback: false, required: true, source: null }),

  // Basic
  field({ id: 'txtName', section: 'Basic', kind: 'text', postback: false, required: true, source: 'personal.name' }),
  field({ id: 'txtFatherName', section: 'Basic', kind: 'text', postback: false, required: true, source: 'personal.fatherName' }),
  field({ id: 'txtNationality', section: 'Basic', kind: 'text', postback: false, required: true, source: 'personal.nationality' }),
  field({ id: 'txtDateOfBirth', section: 'Basic', kind: 'text', postback: true, required: true, source: 'personal.dob' }),
  field({ id: 'txtDomicile', section: 'Basic', kind: 'text', postback: false, required: false, source: 'personal.domicile' }),
  field({ id: 'FupBirthCertificate', section: 'Basic', kind: 'file', postback: false, required: true, source: 'docs.dobProof', acceptedTypes: DOCUMENT_TYPES }),
  field({ id: 'FupDomicileAttachProof', section: 'Basic', kind: 'file', postback: false, required: false, source: 'docs.domicileProof', acceptedTypes: DOCUMENT_TYPES }),

  // Address
  field({ id: 'txtHouseNoApartment', section: 'Address', kind: 'text', postback: false, required: true, source: 'address.house' }),
  field({ id: 'txtStreetVillageColony', section: 'Address', kind: 'text', postback: false, required: true, source: 'address.street' }),
  field({ id: 'txtDistrictCity', section: 'Address', kind: 'text', postback: false, required: true, source: 'address.city' }),
  field({ id: 'txtPincode', section: 'Address', kind: 'text', postback: false, required: true, source: 'address.pincode' }),
  field({ id: 'txtMobileNo', section: 'Address', kind: 'text', postback: false, required: true, source: 'contact.mobile' }),
  field({ id: 'txtEmailId', section: 'Address', kind: 'text', postback: false, required: true, source: 'contact.email' }),

  // Academic
  field({ id: 'ddlEduationQualification', section: 'Academic', kind: 'select', postback: false, required: true, source: 'education.qualification' }),
  field({ id: 'FupEducationQualification', section: 'Academic', kind: 'file', postback: false, required: true, source: 'docs.educationProof', acceptedTypes: DOCUMENT_TYPES }),
  field({ id: 'FupAnyAdventureCoursePhoto', section: 'Academic', kind: 'file', postback: false, required: false, source: 'docs.adventureCert', acceptedTypes: DOCUMENT_TYPES }),
  field({ id: 'FupCurrentEmployment', section: 'Academic', kind: 'file', postback: false, required: false, source: 'docs.employmentProof', acceptedTypes: DOCUMENT_TYPES }),

  // ID
  field({ id: 'ddlVegetarianOrNon', section: 'ID', kind: 'select', postback: false, required: false, source: 'medical.diet' }),
  field({ id: 'txtBloodGroup', section: 'ID', kind: 'text', postback: false, required: true, source: 'medical.bloodGroup' }),
  field({ id: 'txtMedicalCategory', section: 'ID', kind: 'text', postback: false, required: false, source: 'medical.category' }),
  field({ id: 'txtHeight', section: 'ID', kind: 'text', postback: false, required: false, source: 'medical.height' }),
  field({ id: 'txtWeight', section: 'ID', kind: 'text', postback: false, required: false, source: 'medical.weight' }),
  field({ id: 'txtWaist', section: 'ID', kind: 'text', postback: false, required: false, source: 'medical.waist' }),
  field({ id: 'txtShoeSize', section: 'ID', kind: 'text', postback: false, required: false, source: 'medical.shoeSize' }),

  // Photo
  field({ id: 'FupPhototOfApplicant', section: 'Photo', kind: 'file', postback: false, required: true, source: 'docs.photo', acceptedTypes: IMAGE_TYPES }),
  field({ id: 'FupSignatureOfAppicant', section: 'Photo', kind: 'file', postback: false, required: true, source: 'docs.signature', acceptedTypes: IMAGE_TYPES }),

  // Indemnity
  field({ id: 'txtEmergencyContactName', section: 'Indemnity', kind: 'text', postback: false, required: true, source: 'emergency.name' }),
  field({ id: 'txtEmergencyContactPhone', section: 'Indemnity', kind: 'text', postback: false, required: true, source: 'emergency.phone' }),
  field({ id: 'FupParentGuardianSignature', section: 'Indemnity', kind: 'file', postback: false, required: true, source: 'docs.guardianSignature', acceptedTypes: IMAGE_TYPES }),

  // Declaration
  // required:false here is an unverified default, not doc-confirmed: docs/04-field-map.md's
  // Required/Optional lists never mention chkIAgree (only a speculative behavior note).
  // Low risk since we never submit, but flagging so it isn't mistaken for a verified fact.
  field({ id: 'chkIAgree', section: 'Declaration', kind: 'checkbox', postback: false, required: false, source: 'declaration.agree' }),
];

// A field the options page can render as an input: not a file upload (T-022's job),
// not a readonly/computed display field, and not missing a Profile path to bind to.
export function isEditableField(def: FieldDef): def is FieldDef & { source: string } {
  return def.kind !== 'file' && def.kind !== 'readonly' && def.source !== null;
}

export const EDITABLE_FIELDS: ReadonlyArray<FieldDef & { source: string }> = FIELD_MAP.filter(isEditableField);

// Every file-kind field has a non-null docs.* source (pinned by the "only gives a null
// source to readonly fields" test below) and an acceptedTypes set (every file entry
// above passes one), so this filter's result type can assert both directly rather than
// re-deriving a narrower FieldDef type.
function isFileField(def: FieldDef): def is FieldDef & { source: string; acceptedTypes: ReadonlySet<string> } {
  return def.kind === 'file';
}

export const FILE_FIELDS: ReadonlyArray<FieldDef & { source: string; acceptedTypes: ReadonlySet<string> }> =
  FIELD_MAP.filter(isFileField);

// Groups fields by their `section`, preserving each section's first-appearance order
// and each field's original order within its section (used to render the options page
// as one `<fieldset>` per site section).
export function groupFieldsBySection<T extends { section: string }>(fields: readonly T[]): Array<[string, T[]]> {
  const map = new Map<string, T[]>();
  for (const def of fields) {
    const list = map.get(def.section) ?? [];
    list.push(def);
    map.set(def.section, list);
  }
  return [...map];
}

export function getFieldById(id: string): FieldDef | undefined {
  return FIELD_MAP.find((entry) => entry.id === id);
}

export function getFieldBySource(source: string): FieldDef | undefined {
  return FIELD_MAP.find((entry) => entry.source === source);
}

export function getByPath(source: object, path: string): unknown {
  let current: unknown = source;
  for (const key of path.split('.')) {
    if (typeof current !== 'object' || current === null) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

// Writes through a dotted path into an existing object graph (e.g. a Profile draft).
// Every FIELD_MAP source resolves to a leaf that's always at least one level deep
// (section.leaf), so the last segment is always a plain assignment onto an object that
// already exists on the target — this never needs to create intermediate objects.
export function setByPath(target: object, path: string, value: unknown): void {
  const segments = path.split('.');
  const lastSegment = segments.pop();
  if (lastSegment === undefined) {
    return;
  }
  let current: unknown = target;
  for (const key of segments) {
    if (typeof current !== 'object' || current === null) {
      return;
    }
    current = (current as Record<string, unknown>)[key];
  }
  if (typeof current === 'object' && current !== null) {
    (current as Record<string, unknown>)[lastSegment] = value;
  }
}
