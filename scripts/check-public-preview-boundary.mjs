import assert from 'node:assert/strict';
import {build, createServer} from 'vite';
import {neighborhoodCatalog as drafts} from '../src/site/catalog-data.js';
import {publishedEntryIds, previewEntryIds} from '../src/site/published-catalog.js';

const original = {NODE_ENV: process.env.NODE_ENV, VITE_PREVIEW_UNPUBLISHED: process.env.VITE_PREVIEW_UNPUBLISHED};
const results = [];
try {
  for (const development of [false, true]) for (const enabled of [false, true]) {
    process.env.NODE_ENV = development ? 'development' : 'production';
    process.env.VITE_PREVIEW_UNPUBLISHED = enabled ? '1' : '0';
    let catalog;
    if (development) {
      const server = await createServer({configFile: false, envDir: false, logLevel: 'silent', server: {middlewareMode: true}});
      try { catalog = (await server.ssrLoadModule('/src/site/published-catalog.js')).neighborhoodCatalog; }
      finally { await server.close(); }
    } else {
      const result = await build({configFile: false, envDir: false, logLevel: 'silent', build: {lib: {entry: 'src/site/published-catalog.js', formats: ['es']}, write: false, minify: false}});
      const output = (Array.isArray(result) ? result[0] : result).output;
      const code = output.find(value => value.type === 'chunk').code;
      catalog = (await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))).neighborhoodCatalog;
    }
    const allowed = new Set([...publishedEntryIds, ...(development && enabled ? previewEntryIds : [])]);
    assert.deepEqual(catalog.entries.map(entry => entry.id).sort(), drafts.entries.filter(entry => allowed.has(entry.id)).map(entry => entry.id).sort(), 'Preview must require both a development server and explicit opt-in');
    results.push({development, enabled, entries: catalog.entries.length});
  }
} finally {
  for (const [key, value] of Object.entries(original)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
}
console.log(JSON.stringify({passed: true, results}));
