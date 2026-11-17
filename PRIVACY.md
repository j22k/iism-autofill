# Privacy

IISM Form Filler runs entirely in your browser.

- **What it stores:** the profile text you enter (`chrome.storage.local`) and the documents you add (IndexedDB), on your
  device only. Temporary fill-run state is kept in `chrome.storage.session` and discarded with the browser session.
- **What it sends:** nothing. It makes no network requests of its own: no analytics, telemetry, accounts or remote
  configuration. Its only host permission is `https://admission.iismgulmarg.in/*`, to read and fill that page. When
  the form reloads after a dropdown change, that is the site's own behavior, exactly as if you had picked the value
  yourself.
- **Removing your data:** use **Clear all data** on the Options page, or remove the extension.
- **Export:** the profile JSON you export contains personal data. Keep it private and do not commit it anywhere.
