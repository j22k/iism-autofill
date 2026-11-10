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

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidDob(input: string): boolean {
  const match = ISO_DATE_RE.exec(input.trim());
  if (!match) {
    return false;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  // The form's own DOB regex only accepts years starting 19 or 20 (docs/04-field-map.md).
  if (year < 1900 || year > 2099) {
    return false;
  }

  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}
