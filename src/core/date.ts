const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

// Shared by profile.ts (DOB validation) and dateFormat.ts (ISO -> dd/MM/yyyy conversion)
// so "is this a real date" has one implementation instead of two that could drift apart.
export function isValidIsoDate(input: string): boolean {
  const match = ISO_DATE_RE.exec(input.trim());
  if (!match) {
    return false;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  // The admission form's own DOB regex only accepts years starting 19 or 20
  // (docs/04-field-map.md).
  if (year < 1900 || year > 2099) {
    return false;
  }

  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}
