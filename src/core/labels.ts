// Turns a Profile leaf key (camelCase) into a human label for the options-page form.
// This is our own UI's labeling, not a guess about the admission site's markup — Hard
// Rule 6 (never hardcode a site-field guess without a fixture test) doesn't apply here.
export function humanize(identifier: string): string {
  const withSpaces = identifier.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}

// Shared by the options page's profile form (main.ts) and document manager
// (documents.ts) so both label a dotted Profile/docs.* path the same way.
export function labelForPath(path: string): string {
  return humanize(path.split('.').pop() ?? path);
}
