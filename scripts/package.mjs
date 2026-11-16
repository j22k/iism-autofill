// Zips dist/ into iism-form-filler.zip (uses the system `tar`, which writes zip with -a on
// Windows 10+/macOS/Linux bsdtar). Run `npm run build` first.
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';

if (!existsSync('dist/manifest.json')) {
  console.error('dist/manifest.json missing - run `npm run build` first.');
  process.exit(1);
}
rmSync('iism-form-filler.zip', { force: true });
execFileSync('tar', ['-a', '-c', '-f', 'iism-form-filler.zip', '-C', 'dist', '.'], { stdio: 'inherit' });
console.log('Wrote iism-form-filler.zip');
