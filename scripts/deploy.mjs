// Publishes dist/ to the gh-pages branch of origin (GitHub Pages, branch source). Run after
// `npm run build`; see docs/DECISIONS.md D20. The branch holds only build output and is
// force-pushed each time, so it never needs merging.
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = fileURLToPath(new URL('../dist', import.meta.url));
const git = (args, cwd = root) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

if (!existsSync(`${dist}/index.html`)) throw new Error('dist/index.html 不存在，請先執行 npm run build');
if (git(['status', '--porcelain'])) throw new Error('工作區有未提交的變更；請先 commit，部署版本才對得上原始碼');

const remote = git(['remote', 'get-url', 'origin']);
const name = git(['config', 'user.name']);
const email = git(['config', 'user.email']);
const head = git(['rev-parse', '--short', 'HEAD']);

writeFileSync(`${dist}/.nojekyll`, '');
rmSync(`${dist}/.git`, { recursive: true, force: true });
try {
  git(['init', '-q', '-b', 'gh-pages'], dist);
  git(['add', '-A'], dist);
  git(['-c', `user.name=${name}`, '-c', `user.email=${email}`, 'commit', '-q', '-m', `deploy ${head}`], dist);
  execFileSync('git', ['push', '-f', remote, 'gh-pages'], { cwd: dist, stdio: 'inherit' });
  console.log(`已部署 ${head} 到 gh-pages`);
} finally {
  rmSync(`${dist}/.git`, { recursive: true, force: true });
}
