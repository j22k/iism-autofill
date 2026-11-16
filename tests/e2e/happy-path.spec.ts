// T-035: full fill on the local fixture with the real built extension loaded.
// Asserts the form gets filled, btnSubmit is never posted, and nothing leaves the
// admission domain (all of it is served from tests/fixtures via route interception).
import { chromium, expect, test, type BrowserContext } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { renderPostback } from '../fixtures/postbackServer';

const DIST = path.resolve('dist');
const BASE_HTML = fs.readFileSync(path.resolve('tests/fixtures/admission.html'), 'utf8');
const URL_ = 'https://admission.iismgulmarg.in/admission_form.aspx?mobile=9000000000';
const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const PROFILE = {
  course: { type: 'Snow Skiing Courses at Gulmarg', level: 'Basic', batch: 'Batch 1', state: 'BIHAR' },
  personal: { name: 'Test Person', fatherName: 'Test Father', nationality: 'Indian', dob: '2000-01-15' },
  address: { house: '1', street: 'Test Street', city: 'Testville', pincode: '110001' },
  contact: { mobile: '9876543210', email: 'test@example.com' },
  education: { qualification: 'Graduation' },
  medical: { bloodGroup: 'O+' },
  emergency: { name: 'Test Contact', phone: '9123456780' },
  declaration: { agree: true },
};

function parseMultipart(body: Buffer): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /Content-Disposition: form-data; name="([^"]+)"\r\n\r\n([\s\S]*?)\r\n--/g;
  for (const m of body.toString('latin1').matchAll(re)) {
    out[m[1] as string] = m[2] as string;
  }
  return out;
}

let context: BrowserContext;
const posts: string[] = [];
const external: string[] = [];
// Stands in for ASP.NET ViewState: each postback renders on top of the previous page, so
// cascaded dropdown options (Level/Schedule) persist for the next postback.
let lastHtml = BASE_HTML;

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'iism-')), {
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    headless: true,
    args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
  });
  await context.route('https://admission.iismgulmarg.in/**', async (route) => {
    const req = route.request();
    if (req.method() === 'POST') {
      const fields = parseMultipart(req.postDataBuffer() ?? Buffer.alloc(0));
      const target = fields['__EVENTTARGET'] ?? '';
      posts.push(target);
      const values: Record<string, string | boolean> = {};
      for (const [k, v] of Object.entries(fields)) {
        if (k.startsWith('__') || k.startsWith('btn') || k.includes('ClientState')) continue;
        values[k] = v === 'on' ? true : v;
      }
      for (const k of Object.keys(values)) {
        if (!BASE_HTML.includes(`id="${k}"`)) delete values[k];
      }
      await route.fulfill({ contentType: 'text/html', body: (lastHtml = renderPostback(lastHtml, target, values)) });
    } else if (req.url().includes('admission_form.aspx')) {
      lastHtml = BASE_HTML;
      await route.fulfill({ contentType: 'text/html', body: BASE_HTML });
    } else {
      await route.fulfill({ status: 404, body: '' });
    }
  });
  context.on('request', (r) => {
    const u = r.url();
    if (!u.startsWith('https://admission.iismgulmarg.in/') && !u.startsWith('chrome-extension://') && !u.startsWith('data:')) {
      external.push(u);
    }
  });
});

test.afterAll(async () => {
  await context.close();
});

test('fills the fixture form without submitting or leaving the domain', async () => {
  let [sw] = context.serviceWorkers();
  sw ??= await context.waitForEvent('serviceworker');
  const extId = new URL(sw.url()).host;

  const options = await context.newPage();
  await options.goto(`chrome-extension://${extId}/options/index.html`);
  await options.evaluate(
    async ({ profile, png }) => {
      await chrome.storage.local.set({ profile });
      const db = await new Promise<IDBDatabase>((res, rej) => {
        const r = indexedDB.open('iism-form-filler', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('docs');
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      const bytes = Uint8Array.from(atob(png), (c) => c.charCodeAt(0));
      for (const key of ['docs.dobProof', 'docs.educationProof', 'docs.photo', 'docs.signature', 'docs.guardianSignature']) {
        await new Promise<void>((res, rej) => {
          const tx = db.transaction('docs', 'readwrite');
          tx.objectStore('docs').put(new Blob([bytes], { type: 'image/png' }), key);
          tx.oncomplete = () => res();
          tx.onerror = () => rej(tx.error);
        });
      }
      db.close();
    },
    { profile: PROFILE, png: PNG_B64 },
  );

  const page = await context.newPage();
  await page.goto(URL_);
  await page.bringToFront();
  await options.evaluate(() => chrome.runtime.sendMessage({ type: 'START_FILL' }));

  await expect(page.locator('#txtName')).toHaveValue('Test Person', { timeout: 60_000 });
  await expect(page.locator('#txtDateOfBirth')).toHaveValue('15/01/2000', { timeout: 60_000 });
  await expect(page.locator('#ddlState option:checked')).toHaveText('BIHAR');
  await expect(page.locator('#ddlCourseLevel option:checked')).toContainText('Basic');
  await expect.poll(() => page.locator('#FupPhototOfApplicant').evaluate((e: HTMLInputElement) => e.files?.length ?? 0), {
    timeout: 60_000,
  }).toBe(1);

  expect(posts).not.toContain('btnSubmit');
  expect(external).toEqual([]);
});
