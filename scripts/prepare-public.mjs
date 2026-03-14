import { cp, mkdir, rm, stat, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'public');

const copyTargets = [
  { from: 'assets', to: 'assets' },
  { from: '_redirects', to: '_redirects' },
  { from: 'robots.txt', to: 'robots.txt' },
  { from: 'sitemap.xml', to: 'sitemap.xml' },
  { from: '404.html', to: '404.html' },
  { from: 'about', to: 'about' },
  { from: 'advertise', to: 'advertise' },
  { from: 'claim-your-profile', to: 'claim-your-profile' },
  { from: 'contact', to: 'contact' },
  { from: 'cookies', to: 'cookies' },
  { from: 'image-credits', to: 'image-credits' },
  { from: 'methodology', to: 'methodology' },
  { from: 'privacy', to: 'privacy' },
  { from: 'terms', to: 'terms' },
  { from: 'bath/fees', to: 'bath/fees' },
  { from: 'bath/bursaries', to: 'bath/bursaries' },
  { from: 'bath/open-days', to: 'bath/open-days' },
  { from: 'bath/admissions', to: 'bath/admissions' },
  { from: 'bath/boarding-schools', to: 'bath/boarding-schools' },
  { from: 'bath/day-schools', to: 'bath/day-schools' }
];

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

await mkdir(publicDir, { recursive: true });

for (const target of copyTargets) {
  const from = path.join(root, target.from);
  const to = path.join(publicDir, target.to);
  if (!(await exists(from))) continue;

  await rm(to, { recursive: true, force: true });
  const sourceStat = await stat(from);
  if (sourceStat.isDirectory()) {
    await cp(from, to, { recursive: true });
  } else {
    await mkdir(path.dirname(to), { recursive: true });
    await copyFile(from, to);
  }
}

console.log('Public assets and legacy static routes prepared.');
