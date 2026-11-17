// Renders icons/icon.svg to icons/icon{16,32,48,128}.png using Playwright's Chromium.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
const svg = fs.readFileSync('icons/icon.svg', 'utf8');
const browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
for (const size of [16, 32, 48, 128]) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.setContent(`<body style="margin:0;background:transparent"><img src="data:image/svg+xml;utf8,${encodeURIComponent(svg)}" width="${size}" height="${size}"></body>`);
  await page.screenshot({ path: `icons/icon${size}.png`, omitBackground: true });
  await page.close();
}
await browser.close();
