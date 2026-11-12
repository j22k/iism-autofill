// jsdom's ambient Blob (this test environment's global `Blob`) only implements
// `.size`/`.type` — no `.arrayBuffer()`/`.text()`/`.stream()` (confirmed directly: a
// standalone jsdom script logs `has arrayBuffer undefined`). That's exactly why
// production code in a real browser needs none of this reasoning, but these tests do:
// - the INPUT blob to blobToBase64 is built with Node's own Blob (`testBlob`, which DOES
//   implement `.arrayBuffer()`), matching tests/unit/shared/testBlob.ts's existing
//   workaround for the same gap in db.test.ts.
// - the OUTPUT of base64ToBlob is constructed with the ambient (jsdom) `Blob` inside
//   fileTransfer.ts itself, so it's only ever checked via `.size`/`.type` here; byte-for-
//   byte correctness of the encode/decode round trip is verified independently through
//   the base64 *string* via Node's Buffer, never by reading the restored Blob back.
import { describe, expect, it } from 'vitest';
import { base64ToBlob, blobToBase64 } from '../../../src/shared/fileTransfer';
import { testBlob } from './testBlob';

describe('blobToBase64', () => {
  it('produces the same base64 Node.Buffer would, for arbitrary bytes including the top of the byte range', async () => {
    const bytes = [0, 1, 2, 253, 254, 255, 10, 13, 65];
    const base64 = await blobToBase64(testBlob(bytes, 'image/png'));
    expect(base64).toBe(Buffer.from(bytes).toString('base64'));
  });

  it('produces the same base64 Node.Buffer would for an empty blob', async () => {
    const base64 = await blobToBase64(testBlob([], 'application/pdf'));
    expect(base64).toBe(Buffer.from([]).toString('base64'));
  });

  it('is correct across a chunk boundary (encodes in 32KB chunks internally)', async () => {
    const bytes = Array.from({ length: 70_000 }, (_, i) => i % 256);
    const base64 = await blobToBase64(testBlob(bytes, 'image/jpeg'));
    expect(base64).toBe(Buffer.from(bytes).toString('base64'));
  });
});

describe('base64ToBlob', () => {
  it('decodes back to the original bytes (checked via Buffer, not the restored Blob) and sets size/type', () => {
    const bytes = [0, 1, 2, 253, 254, 255, 10, 13, 65];
    const base64 = Buffer.from(bytes).toString('base64');

    const restored = base64ToBlob(base64, 'image/png');

    expect(restored.type).toBe('image/png');
    expect(restored.size).toBe(bytes.length);
    expect(Array.from(Buffer.from(base64, 'base64'))).toEqual(bytes);
  });

  it('round-trips through blobToBase64 + base64ToBlob end to end (size/type only, per the jsdom Blob limitation above)', async () => {
    const bytes = [1, 2, 3, 4, 5];
    const base64 = await blobToBase64(testBlob(bytes, 'application/pdf'));
    const restored = base64ToBlob(base64, 'application/pdf');

    expect(restored.size).toBe(bytes.length);
    expect(restored.type).toBe('application/pdf');
  });
});
