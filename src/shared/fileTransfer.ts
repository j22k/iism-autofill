// Content scripts run in the page's origin and can never reach the extension's own
// IndexedDB (src/shared/db.ts) — different origins don't share storage. A document
// Blob has to cross chrome.tabs.sendMessage as a plain string instead of relying on
// whatever level of structured-clone support a given Chrome version has for Blob/File,
// which is both unverifiable here and unnecessary at this size (docs ≤ 500 KB).
// Chunked so a large file doesn't blow the call-stack/argument-count limit on
// `String.fromCharCode(...bytes)` (V8 caps spread args well under 500,000).
const CHUNK_SIZE = 0x8000;

export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + CHUNK_SIZE));
  }
  return btoa(binary);
}

export function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}
