// fake-indexeddb's structured-clone only recognizes Node's native Blob, not jsdom's
// separate Blob implementation that's ambient as the global `Blob` under Vitest's
// `environment: 'jsdom'` — using the wrong one silently loses type/size on round-trip.
// Production code (db.ts/storage.ts) is unaffected: it just stores/returns whatever
// Blob-like value it's given, and at runtime that's always the real browser's Blob.
// The cast bridges Node's Blob type and the DOM Blob type db.ts is typed against —
// both are structurally Blob-like at runtime; TS only disagrees on an unrelated
// ArrayBuffer-vs-ArrayBufferLike generic in their `bytes()` method signatures.
import { Blob as NodeBlob } from 'node:buffer';

export function testBlob(bytes: number[], type?: string): Blob {
  return new NodeBlob([new Uint8Array(bytes)], type ? { type } : undefined) as unknown as Blob;
}
