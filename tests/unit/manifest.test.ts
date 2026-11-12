/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const manifestPath = resolve(root, 'manifest.json');

describe('manifest.json', () => {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

  it('is a Manifest V3 extension', () => {
    expect(manifest.manifest_version).toBe(3);
  });

  it('requests only the minimum permissions', () => {
    const allowed = new Set(['storage', 'sidePanel', 'scripting', 'alarms']);
    for (const permission of manifest.permissions ?? []) {
      expect(allowed.has(permission)).toBe(true);
    }
  });

  it('grants host access only to the admission domain', () => {
    expect(manifest.host_permissions).toEqual(['https://admission.iismgulmarg.in/*']);
  });

  it('never declares externally_connectable', () => {
    expect(manifest.externally_connectable).toBeUndefined();
  });

  it('points background and content scripts at source files that exist', () => {
    // manifest paths are build output (.js); sources are authored as .ts under src/
    const toSource = (jsPath: string) => resolve(root, 'src', jsPath.replace(/\.js$/, '.ts'));

    const bgScript = manifest.background?.service_worker;
    expect(bgScript).toBeTruthy();
    expect(existsSync(toSource(bgScript))).toBe(true);

    const contentScripts = manifest.content_scripts ?? [];
    expect(contentScripts.length).toBeGreaterThan(0);
    for (const entry of contentScripts) {
      for (const js of entry.js ?? []) {
        expect(existsSync(toSource(js))).toBe(true);
      }
    }
  });
});
