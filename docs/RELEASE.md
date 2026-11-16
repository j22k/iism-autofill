# Release / install (personal use)

1. `npm ci && npm run build`
2. Chrome -> `chrome://extensions` -> Developer mode -> **Load unpacked** -> pick `dist/`
   (after a rebuild, press the reload icon on the extension card).
3. Optional: `npm run package` writes `iism-form-filler.zip` (the contents of `dist/`).
4. Open the extension's **Options**, fill the profile, add documents (JPG/PNG/GIF/PDF as allowed, <= 500 KB).
   Use **Export profile** for a backup (documents are not included).
5. Open the admission form, open the side panel: **Preview** shows what will be written, **Autofill** fills,
   fields still empty are outlined red. You review and press Submit yourself - the extension never does.

Tests: `npm run verify`; e2e: `npm run test:e2e` (set `CHROMIUM_PATH` to a Chromium executable if Playwright's
expected browser build is not installed).
