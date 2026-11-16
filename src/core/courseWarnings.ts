// C12: reminders shown in the side panel; advisory only, never blocks a fill.
import type { Profile } from './profile';

export function courseWarnings(profile: Profile): string[] {
  const warnings = ['Only one course per applicant per year is allowed.'];
  const level = profile.course.level.toLowerCase();
  if (level.includes('intermediate') || level.includes('advanced')) {
    warnings.push('Intermediate/Advanced levels need a certificate of the previous level - attach it as the adventure certificate.');
  }
  return warnings;
}
