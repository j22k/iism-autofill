import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearDocs, deleteDoc, getDoc, listDocKeys, putDoc } from '../../../src/shared/db';
import { testBlob } from './testBlob';

async function blobBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

beforeEach(async () => {
  await clearDocs();
});

describe('db (IndexedDB doc store)', () => {
  it('round-trips a blob through put/get', async () => {
    const original = testBlob([1, 2, 3, 4], 'image/png');

    await putDoc('docs.photo', original);
    const loaded = await getDoc('docs.photo');

    expect(loaded).not.toBeNull();
    expect(loaded?.type).toBe('image/png');
    expect(loaded?.size).toBe(4);
    expect(await blobBytes(loaded as Blob)).toEqual(new Uint8Array([1, 2, 3, 4]));
  });

  it('returns null for a key that was never stored', async () => {
    expect(await getDoc('docs.nonexistent')).toBeNull();
  });

  it('overwrites an existing key on a second put', async () => {
    await putDoc('docs.photo', testBlob([1]));
    await putDoc('docs.photo', testBlob([2, 2]));
    const loaded = await getDoc('docs.photo');
    expect(loaded?.size).toBe(2);
  });

  it('deletes a key', async () => {
    await putDoc('docs.photo', testBlob([1]));
    await deleteDoc('docs.photo');
    expect(await getDoc('docs.photo')).toBeNull();
  });

  it('deleting a key that was never stored resolves without throwing', async () => {
    await expect(deleteDoc('docs.nonexistent')).resolves.toBeUndefined();
  });

  it('getDoc returns null for every key after clearDocs', async () => {
    await putDoc('docs.photo', testBlob([1]));
    await clearDocs();
    expect(await getDoc('docs.photo')).toBeNull();
  });

  it('lists stored keys', async () => {
    await putDoc('docs.photo', testBlob([1]));
    await putDoc('docs.signature', testBlob([2]));
    const keys = await listDocKeys();
    expect(keys.sort()).toEqual(['docs.photo', 'docs.signature']);
  });

  it('clears every stored doc', async () => {
    await putDoc('docs.photo', testBlob([1]));
    await putDoc('docs.signature', testBlob([2]));
    await clearDocs();
    expect(await listDocKeys()).toEqual([]);
  });
});
