import { describe, expect, it, vi } from 'vitest';
import { compressImage, DOCUMENT_TYPES, MAX_IMAGE_BYTES, validateImage } from '../../../src/core/image';

describe('validateImage', () => {
  it('accepts a valid jpeg under the size limit', () => {
    expect(validateImage({ type: 'image/jpeg', size: 100_000 })).toEqual({ valid: true, errors: [] });
  });

  it('accepts a valid png under the size limit', () => {
    expect(validateImage({ type: 'image/png', size: 100_000 })).toEqual({ valid: true, errors: [] });
  });

  it('rejects an unsupported type', () => {
    const result = validateImage({ type: 'application/pdf', size: 1000 });
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
  });

  it('rejects an empty file', () => {
    const result = validateImage({ type: 'image/jpeg', size: 0 });
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
  });

  it('rejects a file over the limit', () => {
    const result = validateImage({ type: 'image/jpeg', size: MAX_IMAGE_BYTES + 1 });
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
  });

  it('reports both errors when type and size are both wrong', () => {
    const result = validateImage({ type: 'image/webp', size: MAX_IMAGE_BYTES + 1 });
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(2);
  });

  it('accepts a gif per the fixture-verified field map (docs/04-field-map.md)', () => {
    expect(validateImage({ type: 'image/gif', size: 100_000 })).toEqual({ valid: true, errors: [] });
  });

  it('rejects PDF by default (photo/signature/guardian-signature fields never accept it)', () => {
    const result = validateImage({ type: 'application/pdf', size: 100_000 });
    expect(result.valid).toBe(false);
  });

  it('accepts PDF when given DOCUMENT_TYPES (birth/education/domicile/adventure/employment fields)', () => {
    expect(validateImage({ type: 'application/pdf', size: 100_000 }, DOCUMENT_TYPES)).toEqual({
      valid: true,
      errors: [],
    });
  });

  it('still rejects an unsupported type against DOCUMENT_TYPES', () => {
    const result = validateImage({ type: 'image/webp', size: 100_000 }, DOCUMENT_TYPES);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('PDF');
  });
});

function blobOfSize(bytes: number): Blob {
  return new Blob([new Uint8Array(bytes)]);
}

describe('compressImage', () => {
  it('finds a quality under the limit via binary search without downscaling', async () => {
    // size shrinks linearly with quality at scale 1; quality 0.5 is the breakeven point.
    const encode = vi.fn(async (quality: number, scale: number) =>
      blobOfSize(Math.round(1_000_000 * quality * scale * scale)),
    );

    const result = await compressImage(encode, 500_000);

    expect(result.withinLimit).toBe(true);
    expect(result.blob.size).toBeLessThanOrEqual(500_000);
    expect(result.blob.size).toBeGreaterThan(490_000); // found a near-optimal quality
    // every call during the quality search stays at full scale
    for (const call of encode.mock.calls) {
      expect(call[1]).toBe(1);
    }
  });

  it('falls back to downscaling when quality alone cannot reach the limit', async () => {
    // quality has no effect — simulates an incompressible image; only area (scale^2) matters.
    const encode = vi.fn(async (_quality: number, scale: number) =>
      blobOfSize(Math.round(2_000_000 * scale * scale)),
    );

    const result = await compressImage(encode, 500_000);

    expect(result.withinLimit).toBe(true);
    expect(result.blob.size).toBeLessThanOrEqual(500_000);

    // downscale calls (after the 8 quality-search calls + 1 quality-0 floor probe) use
    // a fixed quality of 0.8 and shrink scale geometrically by 0.8 each step.
    const downscaleCalls = encode.mock.calls.slice(9);
    expect(downscaleCalls.every((call) => call[0] === 0.8)).toBe(true);
    for (let i = 0; i < downscaleCalls.length; i++) {
      expect(downscaleCalls[i]?.[1]).toBeCloseTo(0.8 ** (i + 1));
    }
  });

  it('returns the quality-0/scale-1 floor without downscaling when it already fits', async () => {
    // Every quality the binary search actually samples (midpoints > 0) stays over the
    // limit, but the explicit quality-0 floor probe fits — must not fall through to
    // downscaling and must not mislabel this as withinLimit: false.
    const encode = vi.fn(async (quality: number) => blobOfSize(quality > 0 ? 600_000 : 400_000));

    const result = await compressImage(encode, 500_000);

    expect(result.withinLimit).toBe(true);
    expect(result.blob.size).toBe(400_000);
  });

  it('gives up and returns the smallest attempt when nothing reaches the limit', async () => {
    const encode = vi.fn(async () => blobOfSize(600_000));

    const result = await compressImage(encode, 500_000);

    expect(result.withinLimit).toBe(false);
    expect(result.blob.size).toBe(600_000);
  });

  it('does not call encode an unbounded number of times', async () => {
    const encode = vi.fn(async () => blobOfSize(600_000));
    await compressImage(encode, 500_000);
    expect(encode.mock.calls.length).toBeLessThan(25);
  });
});
