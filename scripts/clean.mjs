// Removes dist/ before a build. On Node 24.11 for Windows, fs.rmSync({ recursive: true }) — which
// Vite's emptyOutDir uses — crashes the process (exit 0xC0000409) when the project path contains
// non-ASCII characters. The promise-based rm does not, so emptyOutDir is off and this runs instead.
import { rm } from 'node:fs/promises';

await rm(new URL('../dist', import.meta.url), { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
