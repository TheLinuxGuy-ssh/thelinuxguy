/**
 * Renderer of the personal topic pages (topic/index.html?p=<slug>).
 *
 * Reads everything from <code>content.js</code>:
 *   site.topics           -> the pages and their ordered blocks
 *   site.identity         -> the author in the JSON-LD schema
 *   site.meta             -> production origin + default social image
 *   site.pages.topic      -> back link, kicker, title suffix, not-found screen
 *
 * Block rendering rules (unchanged from the original site):
 *   - a block's `text` is the author's own HTML and is inserted as is
 *   - every other field is escaped: headings, captions, alts, links
 */

import { SITE_CONTENT } from './content.js';
import {
  escapeHtml,
  setMeta,
  setCanonical,
  shorten,
  absoluteUrl,
  slugifyTitle,
  openPingCard,
} from './site.js';

const S = SITE_CONTENT;
const OG_IMAGE = `${S.meta.url}${S.meta.ogImage}`;

/**
 * Renders a row of outbound links of a block.
 */
function renderLinks(links) {
  const items = links.map((link) => `
      <li><a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.label)} <span aria-hidden="true">&rarr;</span></a></li>`
  );
  return `<ul class="card-links">${items.join('')}</ul>`;
}

/**
 * Renders one image with an optional caption and optional intrinsic
 * width/height attributes.
 */
function renderFigure(img) {
  const caption = img.caption
    ? `<figcaption>${escapeHtml(img.caption)}</figcaption>`
    : '';
  const size = img.width && img.height
    ? ` width="${Number(img.width)}" height="${Number(img.height)}"`
    : '';

  return `
      <figure class="figure">
        <a href="${escapeHtml(img.src)}" target="_blank" rel="noopener noreferrer">
          <img src="${escapeHtml(img.src)}" alt="${escapeHtml(img.alt || '')}" loading="lazy"${size}>
        </a>
        ${caption}
      </figure>`;
}

/**
 * Renders one block of a topic page. Text is the author's own HTML, so it
 * is inserted as is; everything else is escaped.
 */
function renderBlock(block) {
  if (block.heading) {
    return `<h2>${escapeHtml(block.heading)}</h2>`;
  }
  if (block.text) {
    return `<p>${block.text}</p>`;
  }
  if (block.image) {
    return `<div class="gallery">${renderFigure({
      src: block.image,
      alt: block.alt,
      caption: block.caption,
      width: block.width,
      height: block.height
    })}</div>`;
  }
  if (block.images && block.images.length) {
    return `<div class="gallery">${block.images.map(renderFigure).join('')}</div>`;
  }
  if (block.links && block.links.length) {
    return renderLinks(block.links);
  }
  return '';
}

/**
 * Returns the first image source of the page, used as its social card
 * image; falls back to the site-wide default card.
 */
function firstImage(blocks) {
  for (const block of blocks) {
    if (block.image) return block.image;
    if (block.images && block.images.length) return block.images[0].src;
  }
  return null;
}

/**
 * Renders the topic page for the current `?p=` slug: sets the document
 * title, the per-topic SEO/social tags and the JSON-LD schema, and fills
 * the view. Called from entries/topic-page.js.
 */
export function initTopicPage() {
  const view = document.getElementById('topic');
  const slug = new URLSearchParams(window.location.search).get('p');
  const topic = S.topics.find((item) => item.slug === slug);
  const page = S.pages.topic;

  if (!topic) {
    document.title = page.notFound.title;
    setMeta('name', 'robots', 'noindex');
    // The ghost report rides on the ping widget: no widget, no report.
    const ghost = S.ping && S.ping.enabled !== false && S.ping.ghost
      ? page.notFound
      : null;
    view.innerHTML = `
      <a class="back-link" href="${page.backHref}">${page.backLabel}</a>
      <h1 class="post-title">${page.notFound.heading}</h1>
      <p>${page.notFound.body}</p>${ghost ? `
      <p class="ghost-line">${ghost.ghostLine}</p>
      <button type="button" class="ghost-report">${ghost.ghostButton}</button>` : ''}`;
    if (ghost) {
      view.querySelector('.ghost-report').addEventListener('click', () => {
        openPingCard({
          prefill: `${S.ping.ghost.note}${window.location.href}`,
          mode: 'ghost',
        });
      });
    }
    return;
  }

  // The lead paragraph is the matching personal item's own note — the text
  // is written ONCE in "personal" and shown on both the card and this page.
  // An explicit topic.summary always wins if one is ever set (standalone
  // topics), and blocked-out pages fall back to a title-only description.
  const personalItem = S.personal.find((item) => slugifyTitle(item.title) === topic.slug);
  const summary = topic.summary || (personalItem && personalItem.note) || '';

  // Image slots are hidden while meta.showTopicImages is false: the paths
  // stay in the data untouched, nothing is drawn on the page, and the
  // social card falls back to the generated site card (see og:image below)
  // instead of a placeholder. Non-image blocks stay visible.
  const allBlocks = topic.blocks || [];
  const showImages = S.meta.showTopicImages !== false;
  const blocks = showImages
    ? allBlocks
    : allBlocks.filter((block) => !block.image && !(block.images && block.images.length));

  const url = `${S.meta.url}/topic.html?p=${encodeURIComponent(topic.slug)}`;
  const description = shorten(summary || `${topic.title} by ${S.identity.name}.`, 160);
  const firstSrc = firstImage(blocks);
  const image = firstSrc ? absoluteUrl(firstSrc) : OG_IMAGE;

  document.title = `${topic.title}${page.titleSuffix}`;
  setCanonical(url);
  setMeta('name', 'description', description);
  setMeta('property', 'og:title', topic.title);
  setMeta('property', 'og:description', description);
  setMeta('property', 'og:url', url);
  setMeta('property', 'og:image', image);
  setMeta('name', 'twitter:title', topic.title);
  setMeta('name', 'twitter:description', description);
  setMeta('name', 'twitter:image', image);

  const schema = document.createElement('script');
  schema.type = 'application/ld+json';
  schema.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: topic.title,
    description: description,
    url: url,
    image: image,
    inLanguage: 'en',
    author: {
      '@type': 'Person',
      name: S.identity.name,
      alternateName: S.identity.badge,
      url: `${S.meta.url}/`
    }
  });
  document.head.appendChild(schema);

  view.innerHTML = `
    <a class="back-link" href="${page.backHref}">${page.backLabel}</a>
    <p class="post-meta">${page.kicker}</p>
    <h1 class="post-title"></h1>
    <p class="lead"></p>
    <div class="post-body">${blocks.map(renderBlock).join('')}</div>`;

  view.querySelector('.post-title').textContent = topic.title;

  const lead = view.querySelector('.lead');
  if (summary) {
    lead.textContent = summary;
  } else {
    lead.remove();
  }
}
