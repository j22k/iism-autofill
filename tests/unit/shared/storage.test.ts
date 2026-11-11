import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAll, clearProfile, loadProfile, saveProfile } from '../../../src/shared/storage';
import * as db from '../../../src/shared/db';
import { getDoc, putDoc } from '../../../src/shared/db';
import 'fake-indexeddb/auto';
import type { Profile } from '../../../src/core/profile';
import { testBlob } from './testBlob';

function createChromeStorageMock() {
  let store: Record<string, unknown> = {};
  return {
    storage: {
      local: {
        get: vi.fn(async (key?: string | string[]) => {
          if (key === undefined) {
            return { ...store };
          }
          const keys = Array.isArray(key) ? key : [key];
          const result: Record<string, unknown> = {};
          for (const k of keys) {
            if (k in store) {
              result[k] = store[k];
            }
          }
          return result;
        }),
        set: vi.fn(async (items: Record<string, unknown>) => {
          store = { ...store, ...items };
        }),
        remove: vi.fn(async (key: string | string[]) => {
          for (const k of Array.isArray(key) ? key : [key]) {
            delete store[k];
          }
        }),
        clear: vi.fn(async () => {
          store = {};
        }),
      },
    },
  };
}

function sampleProfile(): Profile {
  return {
    course: { type: 'ski', level: 'Basic', batch: 'batch-1', state: 'JAMMU AND KASHMIR' },
    personal: { name: 'Test Name', fatherName: 'Father Name', nationality: 'Indian', dob: '2005-06-15' },
    address: { house: 'H.No. 1', street: 'Main St', city: 'Testville', pincode: '560001' },
    contact: { mobile: '9876543210', email: 'test@example.com' },
    education: { qualification: 'Graduation' },
    medical: { bloodGroup: 'O+' },
    emergency: { name: 'Emergency Contact', phone: '9876543211' },
    declaration: { agree: false },
  };
}

beforeEach(() => {
  vi.stubGlobal('chrome', createChromeStorageMock());
});

describe('storage (chrome.storage.local profile wrapper)', () => {
  it('round-trips a profile through save/load', async () => {
    const profile = sampleProfile();
    await saveProfile(profile);
    expect(await loadProfile()).toEqual(profile);
  });

  it('returns null when nothing has been saved', async () => {
    expect(await loadProfile()).toBeNull();
  });

  it('clearProfile removes the saved profile', async () => {
    await saveProfile(sampleProfile());
    await clearProfile();
    expect(await loadProfile()).toBeNull();
  });

  it('clearAll clears both the profile and every stored doc', async () => {
    await saveProfile(sampleProfile());
    await putDoc('docs.photo', testBlob([1, 2, 3]));

    await clearAll();

    expect(await loadProfile()).toBeNull();
    expect(await getDoc('docs.photo')).toBeNull();
  });

  it('clearAll still clears the profile when clearing docs fails, and reports which part failed', async () => {
    await saveProfile(sampleProfile());
    const clearDocsSpy = vi.spyOn(db, 'clearDocs').mockRejectedValueOnce(new Error('boom'));

    await expect(clearAll()).rejects.toThrow(/docs/);

    expect(await loadProfile()).toBeNull();
    clearDocsSpy.mockRestore();
  });
});
