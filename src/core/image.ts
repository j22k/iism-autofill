// "500 KB" read conservatively as decimal kilobytes (500_000 bytes), not binary
// (512_000) — the server's actual limit is unconfirmed (docs/04-field-map.md notes the
// page's own JS only blocks >1 MB), so we stay under the stricter reading.
export const MAX_IMAGE_BYTES = 500_000;

// docs/04-field-map.md's "Verified details from the real HTML" section (the
// fixture-backed, Hard-Rule-6 source of truth) documents photo/signature/guardian-
// signature uploads as accepting gif/jpg/png/jpeg only (no PDF) — the doc's own earlier
// summary line omits GIF, but that summary isn't the verified source. GIF decodes fine
// via createImageBitmap/drawImage (first frame only, which is correct for a static
// photo), so there's no technical reason to exclude it.
export const IMAGE_TYPES: ReadonlySet<string> = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/gif']);

// The same doc section: birth certificate/education/domicile/adventure/employment
// uploads additionally accept PDF. Each FIELD_MAP file entry's `acceptedTypes` picks
// between this and IMAGE_TYPES per field — see src/core/fieldMap.ts.
export const DOCUMENT_TYPES: ReadonlySet<string> = new Set([...IMAGE_TYPES, 'application/pdf']);

const TYPE_LABELS: Record<string, string> = {
  'image/jpeg': 'JPG',
  'image/jpg': 'JPG',
  'image/png': 'PNG',
  'image/gif': 'GIF',
  'application/pdf': 'PDF',
};

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
};

// Used when attaching a stored doc that has no usable filename of its own (T-032) —
// IndexedDB's structured clone preserves a File's `.name`, but a Blob never had one, so
// this covers that fallback case rather than leaving the upload with no extension.
export function extensionForMimeType(mimeType: string): string {
  return EXTENSIONS[mimeType] ?? 'bin';
}

function describeTypes(types: ReadonlySet<string>): string {
  const labels = [...new Set([...types].map((type) => TYPE_LABELS[type] ?? type))];
  if (labels.length <= 1) {
    return labels[0] ?? '';
  }
  const last = labels[labels.length - 1];
  return `${labels.slice(0, -1).join(', ')}${labels.length > 2 ? ',' : ''} and ${last}`;
}

export interface ImageValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateImage(
  file: { type: string; size: number },
  acceptedTypes: ReadonlySet<string> = IMAGE_TYPES,
): ImageValidationResult {
  const errors: string[] = [];
  if (!acceptedTypes.has(file.type)) {
    errors.push(`Unsupported file type "${file.type}" — only ${describeTypes(acceptedTypes)} are allowed.`);
  }
  if (file.size === 0) {
    errors.push('File is empty.');
  } else if (file.size > MAX_IMAGE_BYTES) {
    errors.push(`File is ${Math.ceil(file.size / 1000)} KB — must be ${MAX_IMAGE_BYTES / 1000} KB or smaller.`);
  }
  return { valid: errors.length === 0, errors };
}

export type Encoder = (quality: number, scale: number) => Promise<Blob>;

export interface CompressResult {
  blob: Blob;
  withinLimit: boolean;
}

const QUALITY_SEARCH_ITERATIONS = 8;
const DOWNSCALE_ITERATIONS = 10;
const DOWNSCALE_FACTOR = 0.8;
const DOWNSCALE_QUALITY = 0.8;

// Per docs/03-architecture.md: canvas re-encode, binary-search quality (at full scale)
// first; if even the lowest quality can't fit, downscale (at a fixed quality) until it
// does. `encode` is the only thing that touches a real canvas — real in the browser,
// mocked with a deterministic size model in unit tests.
export async function compressImage(encode: Encoder, maxBytes: number): Promise<CompressResult> {
  let best: Blob | null = null;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < QUALITY_SEARCH_ITERATIONS; i++) {
    const quality = (lo + hi) / 2;
    const blob = await encode(quality, 1);
    if (blob.size <= maxBytes) {
      best = blob;
      lo = quality;
    } else {
      hi = quality;
    }
  }
  if (best) {
    return { blob: best, withinLimit: true };
  }

  let smallest = await encode(0, 1);
  if (smallest.size <= maxBytes) {
    return { blob: smallest, withinLimit: true };
  }
  let scale = 1;
  for (let i = 0; i < DOWNSCALE_ITERATIONS; i++) {
    scale *= DOWNSCALE_FACTOR;
    const blob = await encode(DOWNSCALE_QUALITY, scale);
    if (blob.size < smallest.size) {
      smallest = blob;
    }
    if (blob.size <= maxBytes) {
      return { blob, withinLimit: true };
    }
  }
  return { blob: smallest, withinLimit: false };
}
