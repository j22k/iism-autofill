// Same domain as manifest.json's host_permissions / content_scripts match pattern.
// Duplicated as a literal rather than parsed from the manifest at runtime — this is a
// UI readiness hint (C1), not a security boundary, so a small drift risk if the domain
// ever changes is an acceptable trade for not reaching into extension manifest APIs
// from a pure, unit-tested module.
const ADMISSION_HOST = 'admission.iismgulmarg.in';

export function isAdmissionUrl(url: string | undefined): boolean {
  if (!url) {
    return false;
  }
  try {
    return new URL(url).hostname === ADMISSION_HOST;
  } catch {
    return false;
  }
}
