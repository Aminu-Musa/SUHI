/* Rebuild /dist before every fidelity run, unconditionally.
 *
 * This exists because of a near-miss. The build used to live in the webServer command
 * (`npm run build && node server.mjs`), and `reuseExistingServer` is true outside CI - so when
 * a server was already up, the server command never ran, the build never ran, and the guard
 * compared the rebuild's STALE dist output against the original. Proven: changing
 * `.rail{width:332px}` to 330px passed the guard. A fidelity guard reading stale output is
 * worse than no guard, because it reports success.
 *
 * globalSetup runs regardless of whether the server is reused, which is the property needed. */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

export default function globalSetup(): void {
  const root = resolve(import.meta.dirname, '..', '..');
  execFileSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
}
