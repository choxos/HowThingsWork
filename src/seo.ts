import type {Topic} from './topics.ts';

/**
 * Per-view metadata for a hash routed page.
 *
 * Crawlers only ever fetch one HTML file, so the tags in studies.html are what
 * they read. These updates are for everything that runs the page first: the
 * browser tab, a bookmark, and any share sheet that renders the live document
 * rather than the served source.
 *
 * The site defaults below must stay in step with the same strings in
 * studies.html; that file is the copy a crawler sees.
 */
export const SITE_URL = 'https://howthingswork.xera.ac/';
export const SITE_NAME = 'How Things Work';
const SITE_TITLE = 'How Things Work · An Interactive Study of Machines';
const SITE_DESCRIPTION =
  'Thirty interactive 3D studies of the machines and principles everything else is built from: levers and gears, floating and flying, light and sound, electricity, and the digital domain. Move one slider and watch the numbers follow.';

/** Where a given view lives. Routing is by fragment, so the path never changes. */
export const canonicalFor = (topic?: Topic) => (topic ? `${SITE_URL}studies.html#/topic/${topic.id}` : `${SITE_URL}studies.html`);

/** Google Analytics, present only when the tag actually loaded. */
declare global {
  interface Window {
    gtag?: (command: string, ...args: unknown[]) => void;
  }
}

function meta(selector: string, content: string) {
  const tag = document.head.querySelector<HTMLMetaElement>(selector);
  if (tag) tag.content = content;
}

/** Point the document's metadata at one study, or back at the gallery. */
export function applySeo(topic?: Topic) {
  const title = topic ? `${topic.name} · ${SITE_NAME}` : SITE_TITLE;
  const description = topic ? `${topic.tagline}. ${topic.blurb} ${topic.summary}` : SITE_DESCRIPTION;
  const url = canonicalFor(topic);

  document.title = title;
  meta('meta[name="description"]', description);
  meta('meta[property="og:title"]', title);
  meta('meta[property="og:description"]', description);
  meta('meta[property="og:url"]', url);
  meta('meta[name="twitter:title"]', title);
  meta('meta[name="twitter:description"]', description);

  const canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (canonical) canonical.href = url;
}

/**
 * A fragment change is not a navigation, so gtag never notices one by itself.
 * The `config` call in studies.html covers the first view; this covers the rest.
 */
export function trackPageView() {
  window.gtag?.('event', 'page_view', {
    page_title: document.title,
    page_location: window.location.href,
  });
}
