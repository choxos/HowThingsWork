// Writes public/sitemap.xml from the topic list, so the two can never disagree.
// Wired to the prebuild script, so every build regenerates it.
//
// Needs Node.js 22.18 or newer, for the native TypeScript execution that lets
// this import src/topics.ts directly. That is the same floor npm test already
// sets, and deploy/deploy.sh runs the tests before the build.
//
// No lastmod: the only honest value would be the build date, which would dirty
// the working tree on every build for no crawling benefit.
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {SITE_URL, canonicalFor} from '../src/seo.ts';
import {topics} from '../src/topics.ts';

const escape = (url: string) => url.replace(/&/g, '&amp;').replace(/'/g, '&apos;');

const urls = [SITE_URL, canonicalFor(), ...topics.map(topic => canonicalFor(topic))];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(url => `  <url><loc>${escape(url)}</loc></url>`).join('\n')}
</urlset>
`;

const out = fileURLToPath(new URL('../public/sitemap.xml', import.meta.url));
writeFileSync(out, xml);
console.log(`sitemap.xml: ${urls.length} URLs (1 neighborhood, 1 gallery, ${topics.length} studies)`);
