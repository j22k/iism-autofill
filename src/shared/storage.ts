// chrome.storage.local wrapper for the text Profile (files live in IndexedDB via db.ts).
import { clearDocs } from './db';
import type { Profile } from '../core/profile';

const PROFILE_KEY = 'profile';

export async function saveProfile(profile: Profile): Promise<void> {
  await chrome.storage.local.set({ [PROFILE_KEY]: profile });
}

export async function loadProfile(): Promise<Profile | null> {
  const result = await chrome.storage.local.get(PROFILE_KEY);
  return (result[PROFILE_KEY] as Profile | undefined) ?? null;
}

export async function clearProfile(): Promise<void> {
  await chrome.storage.local.remove(PROFILE_KEY);
}

// The storage-layer half of feature A7 ("Clear all data") — clears the profile and
// every stored doc. The UI button that calls this is a later task (options page).
// Uses allSettled (not all) so one failing clear doesn't abort the other — and so the
// error names exactly which part(s) failed, rather than leaving the caller to guess
// whether partial data was left behind.
export async function clearAll(): Promise<void> {
  const names = ['profile', 'docs'];
  const results = await Promise.allSettled([clearProfile(), clearDocs()]);
  const failed = names.filter((_, i) => results[i]?.status === 'rejected');
  if (failed.length > 0) {
    throw new Error(`clearAll: failed to clear ${failed.join(', ')}`);
  }
}
