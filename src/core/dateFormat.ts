import { isValidIsoDate } from './date';

export function isoToFormDate(iso: string): string | null {
  const trimmed = iso.trim();
  if (!isValidIsoDate(trimmed)) {
    return null;
  }
  const [year, month, day] = trimmed.split('-');
  return `${day}/${month}/${year}`;
}
