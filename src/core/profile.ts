export interface Profile {
  course: {
    type: string;
    level: string;
    batch: string;
    state: string;
  };
  personal: {
    name: string;
    fatherName: string;
    nationality: string;
    dob: string; // ISO yyyy-mm-dd; converted to dd/MM/yyyy at fill time (dateFormat.ts)
    domicile?: string;
  };
  address: {
    house: string;
    street: string;
    city: string;
    pincode: string;
  };
  contact: {
    mobile: string;
    email: string;
  };
  education: {
    qualification: string;
  };
  medical: {
    diet?: string;
    bloodGroup: string;
    category?: string;
    height?: string;
    weight?: string;
    waist?: string;
    shoeSize?: string;
  };
  emergency: {
    name: string;
    phone: string;
  };
  declaration: {
    agree: boolean;
  };
}

// Only digits, spaces, hyphens, parentheses, and a leading "+" are accepted — anything
// else (letters, etc.) means the input isn't a phone number, not just an unusual format.
const PHONE_CHARS = /^[+\d\s()-]+$/;

// Indian mobile numbers always start 6-9; rejecting anything else catches typos that
// would otherwise normalize "successfully" to a wrong-looking number (e.g. a stray
// leading zero surviving prefix-stripping).
const MOBILE_RE = /^[6-9]\d{9}$/;

export function normalizePhone(input: string): string | null {
  if (!PHONE_CHARS.test(input)) {
    return null;
  }
  const digits = input.replace(/\D/g, '');
  let result: string | null = null;
  if (digits.length === 10) {
    result = digits;
  } else if (digits.length === 12 && digits.startsWith('91')) {
    result = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    result = digits.slice(1);
  }
  return result !== null && MOBILE_RE.test(result) ? result : null;
}

// Matches the admission form's own client-side email regex (docs/04-field-map.md).
const EMAIL_RE = /^\w+([-+.']\w+)*@\w+([-.]\w+)*\.\w+([-.]\w+)*$/;

export function isValidEmail(input: string): boolean {
  return EMAIL_RE.test(input.trim());
}

// Indian PIN codes never start with 0 (the first digit maps to a postal region).
export function isValidPincode(input: string): boolean {
  return /^[1-9]\d{5}$/.test(input.trim());
}

export { isValidIsoDate as isValidDob } from './date';

export function createEmptyProfile(): Profile {
  return {
    course: { type: '', level: '', batch: '', state: '' },
    personal: { name: '', fatherName: '', nationality: '', dob: '', domicile: '' },
    address: { house: '', street: '', city: '', pincode: '' },
    contact: { mobile: '', email: '' },
    education: { qualification: '' },
    medical: { diet: '', bloodGroup: '', category: '', height: '', weight: '', waist: '', shoeSize: '' },
    emergency: { name: '', phone: '' },
    declaration: { agree: false },
  };
}

// Fills any leaf missing from `loaded` with the corresponding leaf from `base`, so a
// stale/incomplete stored profile (e.g. an older schema missing a since-added field)
// never surfaces as `undefined` to code that expects every Profile leaf to be a string.
// This is deliberately NOT a type/shape validator — it trusts `loaded`'s existing leaves
// as-is and only patches gaps.
export function mergeProfile(base: Profile, loaded: Partial<Profile> | null): Profile {
  if (!loaded) {
    return base;
  }
  return {
    course: { ...base.course, ...loaded.course },
    personal: { ...base.personal, ...loaded.personal },
    address: { ...base.address, ...loaded.address },
    contact: { ...base.contact, ...loaded.contact },
    education: { ...base.education, ...loaded.education },
    medical: { ...base.medical, ...loaded.medical },
    emergency: { ...base.emergency, ...loaded.emergency },
    declaration: { ...base.declaration, ...loaded.declaration },
  };
}

// Used by the side panel's profile dropdown (T-023) to label the one stored profile.
export function profileDisplayName(profile: Profile | null): string {
  if (!profile) {
    return 'No profile saved yet';
  }
  return profile.personal.name || 'Unnamed profile';
}
