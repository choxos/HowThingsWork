# How Things Work

Explore everyday machines through a neighborhood, rooms, and interactive 3D lessons. Select a machine or component, inspect its parts, change its controls, and follow the resulting motion and readouts. Lessons include guided experiments, explanations, and questions.

Live at https://howthingswork.xera.ac

The neighborhood is the main website. The catalog also contains entries still awaiting individual lessons; a catalog entry does not imply a completed simulation. Models explain selected mechanisms with stated assumptions and limits. They are teaching models, not engineering specifications.

The earlier collection of 30 principle studies remains available at `/studies.html`. Existing `/#/topic/...` bookmarks continue to open those studies.

## Local development

Use Node.js 22.18 or newer (Node.js 24 recommended).

```sh
npm ci
npm run dev
```

## Checks

```sh
npm test
npm run test:scenes
npm run test:models
npm run test:browser
npm run build
node scripts/check-physics-laws.mjs
node scripts/check-controls.mjs
```

`npm run test:browser` runs every browser check in `src/site/` against a Vite dev server it starts itself. It runs them one at a time on purpose: a single headless browser rendering these scenes takes most of the cores on a normal laptop, and several at once starve each other until pages stop finishing loading. A check that fails once and passes on a second run is reported as flaky rather than as a pass.

`scripts/check-physics-laws.mjs` states the textbook law in its own terms and holds the models to it, so a model and the check written beside it cannot agree on the same mistake. `scripts/check-controls.mjs` opens every catalog entry that has a lesson and drives every one of its controls, reporting any setting that leaves the readings unchanged; it needs a running site.

Machine-specific runnable checks live beside their models in `src/site/`. Browser checks require Playwright and a running site. Run `npm run test:deployment -- https://howthingswork.xera.ac/` for the deployment smoke check; use `PLAYWRIGHT_MODULE` for an external installation. Machine browser checks accept `SITE_URL` (default `http://127.0.0.1:5175/`); checks that inject source fixtures require the Vite dev server. Passing checks establishes the named behavior, not complete coverage of every machine or scientific assumption.

## Source layout

- `src/site/`: neighborhood, house navigation, machine models, lessons, and checks.
- `src/scene/`: the principle-study scenes.
- `public/`: shared static site files.

Reference documents and local review evidence are excluded from the public repository.

## Hosting

Run `npm run build` and serve `dist/` at the root of any static web host. Machine navigation uses URL fragments; the principle studies and introductory experiments are separate HTML pages.

Analytics is optional. To enable it, set `VITE_GOOGLE_ANALYTICS_ID` in an untracked `.env.local` before building. No analytics tag loads when that setting is absent. Build-time client settings are visible to visitors and must never contain secrets.
