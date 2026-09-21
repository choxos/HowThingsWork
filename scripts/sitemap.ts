// Hash routes share the main document. Unfinished standalone pages stay local.
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {SITE_URL} from '../src/seo.ts';

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE_URL}</loc></url>
</urlset>
`;
writeFileSync(fileURLToPath(new URL('../public/sitemap.xml', import.meta.url)), xml);
console.log('sitemap.xml: 1 public collection');
