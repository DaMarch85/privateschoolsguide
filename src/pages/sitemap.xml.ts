import type { APIRoute } from 'astro';
import { getAllCanonicalSchoolPaths, getLocationPaths } from '../lib/directory';

export const prerender = true;

const SITE_URL = 'https://privateschoolguide.co.uk';

const STATIC_PATHS = [
  '/',
  '/about/',
  '/advertise/',
  '/claim-your-profile/',
  '/contact/',
  '/cookies/',
  '/image-credits/',
  '/methodology/',
  '/privacy/',
  '/terms/',
  '/bath/admissions/',
  '/bath/boarding-schools/',
  '/bath/day-schools/'
];

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export const GET: APIRoute = async () => {
  const [locationPaths, schoolPaths] = await Promise.all([
    getLocationPaths(),
    getAllCanonicalSchoolPaths()
  ]);

  const urlPaths = new Set<string>(STATIC_PATHS);

  for (const entry of locationPaths) {
    const locationSlug = entry.params.location;
    if (!locationSlug) continue;
    urlPaths.add(`/${locationSlug}/`);
    urlPaths.add(`/${locationSlug}/schools/`);
  }

  for (const entry of schoolPaths) {
    const schoolSlug = entry.params.slug;
    if (!schoolSlug) continue;
    urlPaths.add(`/schools/${schoolSlug}/`);
  }

  const lastmod = new Date().toISOString().slice(0, 10);
  const urls = Array.from(urlPaths)
    .sort((a, b) => a.localeCompare(b, 'en'))
    .map((path) => {
      const loc = new URL(path, SITE_URL).toString();
      return `  <url>\n    <loc>${escapeXml(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`;
    })
    .join('\n');

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8'
      }
    }
  );
};
