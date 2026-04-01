import { cp, mkdir, rm, stat, copyFile, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'public');
const GOOGLE_TAG_ID = 'G-BDP9V8TPZZ';
const GOOGLE_TAG_SNIPPET = [
  '<!-- Google tag (gtag.js) -->',
  `<script async src="https://www.googletagmanager.com/gtag/js?id=${GOOGLE_TAG_ID}"></script>`,
  '<script>',
  'window.dataLayer = window.dataLayer || [];',
  'function gtag(){dataLayer.push(arguments);}',
  "gtag('js', new Date());",
  '',
  `gtag('config', '${GOOGLE_TAG_ID}');`,
  '</script>'
].join('\n');

const copyTargets = [
  { from: 'assets', to: 'assets' },
  { from: '_redirects', to: '_redirects' },
  { from: 'robots.txt', to: 'robots.txt' },
  { from: 'sitemap.xml', to: 'sitemap.xml' },
  { from: '404.html', to: '404.html' },
  { from: 'about', to: 'about' },
  { from: 'advertise', to: 'advertise' },
  { from: 'contact', to: 'contact' },
  { from: 'cookies', to: 'cookies' },
  { from: 'image-credits', to: 'image-credits' },
  { from: 'methodology', to: 'methodology' },
  { from: 'privacy', to: 'privacy' },
  { from: 'terms', to: 'terms' },
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

function upsertGoogleTag(html) {
  const normalized = html
    .replace(/https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=[A-Z0-9-]+/g, `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_TAG_ID}`)
    .replace(/gtag\('config',\s*'[^']+'\);/g, `gtag('config', '${GOOGLE_TAG_ID}');`);

  if (/googletagmanager\.com\/gtag\/js\?id=/.test(normalized)) {
    return normalized;
  }

  return normalized.replace(/<head([^>]*)>/i, (match) => `${match}\n${GOOGLE_TAG_SNIPPET}`);
}

async function injectGoogleTagIntoHtmlFiles(dir) {
  if (!(await exists(dir))) return;

  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await injectGoogleTagIntoHtmlFiles(entryPath);
      continue;
    }

    if (!entry.isFile() || !entry.name.endsWith('.html')) continue;

    const html = await readFile(entryPath, 'utf8');
    const nextHtml = upsertGoogleTag(html);
    if (nextHtml !== html) {
      await writeFile(entryPath, nextHtml);
    }
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

await injectGoogleTagIntoHtmlFiles(publicDir);

console.log('Public assets and legacy static routes prepared.');
