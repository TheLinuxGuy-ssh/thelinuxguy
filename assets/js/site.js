/**
 * Shared runtime helpers used by every page renderer.
 *
 * This file contains ONLY logic - no content. All copy lives in
 * <code>content.js</code>, the single source of truth for this website.
 */

import { SITE_CONTENT } from './content.js';

/**
 * Escapes a value so it can be interpolated into HTML safely.
 * (Kept byte-compatible with the original inline helpers of script.js and
 * topic.js, which were two copies of the same function.)
 */
export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Creates (or updates) a <meta attr="key"> element in the page head with the
 * given content. Used by the topic page for its per-topic SEO tags.
 */
export function setMeta(attr, key, value) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', value);
}

/**
 * Creates (or updates) the canonical <link> of the page. There is at most
 * one canonical link per document.
 */
export function setCanonical(href) {
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.rel = 'canonical';
    document.head.appendChild(el);
  }
  el.href = href;
}

/**
 * Truncates text to `max` characters on a word boundary, with an ellipsis
 * behind it. Used for topic page meta descriptions (max 160 chars).
 */
export function shorten(text, max) {
  if (text.length <= max) return text;
  return text.slice(0, max - 3).replace(/\s+\S*$/, '') + '...';
}

/**
 * Makes an asset path absolute against the production origin. Full URLs
 * pass through unchanged; relative paths get origin + stripped "./".
 * Used for the Open Graph / Twitter card image of a topic page.
 */
export function absoluteUrl(path) {
  return /^https?:\/\//i.test(path)
    ? path
    : `${SITE_CONTENT.meta.url}/${path.replace(/^\.?\//, '')}`;
}

/**
 * Shared slug derivation for personal items: "Event production & Management"
 * becomes "event-production-management". The Personal card link (script.js)
 * and the topic-page note lookup (topic.js) both key off this helper, so
 * the two lists can never disagree on a slug.
 */
export function slugifyTitle(title) {
  return String(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * The identity line in every page header is static HTML, so that it renders
 * even when scripts fail. These two sync helpers keep it honest with the
 * SINGLE source of truth afterwards: they re-apply the current values,
 * which are no-ops while the values are unchanged.
 */

/** Applies meta.identity to the `.me` / `.badge` header elements. */
export function syncIdentity() {
  const { name, badge } = SITE_CONTENT.identity;
  const me = document.querySelector('.me');
  const tag = document.querySelector('.badge');
  if (me) me.textContent = name;
  if (tag) tag.textContent = badge;
}

/** Applies navigation labels to the `.nav a[data-target=...]` elements. */
export function syncNavigation() {
  for (const { label, target } of SITE_CONTENT.navigation) {
    const link = document.querySelector(`.nav a[data-target="${target}"]`);
    if (link) link.textContent = label;
  }
}
