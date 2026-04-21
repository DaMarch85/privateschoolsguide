import { cp, mkdir, rm, stat, copyFile, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'public');
const GOOGLE_TAG_ID = 'G-BDP9V8TPZZ';
const PRIMARY_SITE_URL = 'https://privateschoolguide.co.uk';
const LEGACY_SITE_URLS = [
  'https://www.privateschoolsguide.co.uk',
  'https://www.privateschoolguide.co.uk'
];
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

function normalizeSiteHost(html) {
  let normalized = html;
  for (const legacySiteUrl of LEGACY_SITE_URLS) {
    normalized = normalized.replaceAll(legacySiteUrl, PRIMARY_SITE_URL);
  }
  return normalized;
}

function upsertGoogleTag(html) {
  const normalized = normalizeSiteHost(html)
    .replace(/https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=[A-Z0-9-]+/g, `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_TAG_ID}`)
    .replace(/gtag\('config',\s*'[^']+'\);/g, `gtag('config', '${GOOGLE_TAG_ID}');`);

  if (/googletagmanager\.com\/gtag\/js\?id=/.test(normalized)) {
    return normalized;
  }

  return normalized.replace(/<head([^>]*)>/i, (match) => `${match}\n${GOOGLE_TAG_SNIPPET}`);
}

async function normalizeHtmlFiles(dir) {
  if (!(await exists(dir))) return;

  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await normalizeHtmlFiles(entryPath);
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

for (const stalePath of ['404.html', 'sitemap.xml']) {
  await rm(path.join(publicDir, stalePath), { recursive: true, force: true });
}

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

await normalizeHtmlFiles(publicDir);

console.log('Public assets and legacy static routes prepared.');
