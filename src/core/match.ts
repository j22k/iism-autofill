export type MatchResult =
  | { status: 'matched'; option: string }
  | { status: 'ambiguous'; options: string[] }
  | { status: 'none' };

// Hyphens/underscores normalize to spaces too, so e.g. "Non Veg" lines up with the
// real ddlVegetarianOrNon option "Non-Vegetarian" (docs/04-field-map.md:59).
function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ');
}

// candidates is never expected to contain an actual `undefined` string element, so
// `second === undefined` here means "there is no second candidate" (length <= 1), not
// "the second candidate is the value undefined".
function pickFrom(candidates: string[]): MatchResult | null {
  const [first, second] = candidates;
  if (first !== undefined && second === undefined) {
    return { status: 'matched', option: first };
  }
  if (candidates.length > 1) {
    return { status: 'ambiguous', options: candidates };
  }
  return null;
}

// Three tiers, most specific first; a tier that finds any candidate (one or more)
// short-circuits, even if a later, looser tier would also match something else.
// The fuzzy tier's bidirectional substring check is deliberately permissive: a short
// input like "ski" can match multiple long option strings that all contain it (e.g.
// two different "Snow Skiing Courses at <location>" options) — that's fine, since the
// safe fallback for a permissive tier is "ambiguous, leave for a human", never a wrong
// silent match.
export function matchOption(input: string, options: readonly string[]): MatchResult {
  if (normalize(input) === '') {
    return { status: 'none' };
  }

  const exact = pickFrom(options.filter((option) => option === input));
  if (exact) {
    return exact;
  }

  const normalizedInput = normalize(input);
  const caseInsensitive = pickFrom(options.filter((option) => normalize(option) === normalizedInput));
  if (caseInsensitive) {
    return caseInsensitive;
  }

  const fuzzy = pickFrom(
    options.filter((option) => {
      const normalizedOption = normalize(option);
      return normalizedOption.includes(normalizedInput) || normalizedInput.includes(normalizedOption);
    }),
  );
  if (fuzzy) {
    return fuzzy;
  }

  return { status: 'none' };
}
