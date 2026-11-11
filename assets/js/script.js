/**
 * Renderer + router of the main page (index.html).
 *
 * This file contains ONLY structure and behaviour - every word it renders
 * comes from <code>content.js</code> (the single source of truth):
 *
 *   sections.about / monologues / projects / personal / contact / wall
 *                                                          -> chrome
 *   site.posts       -> cards of the Monologues tab
 *   site.projects    -> cards of the Projects tab
 *   site.personal    -> rows of the Personal tab
 *   site.labels      -> the small "Website / Source code / Read / View" labels
 *
 * The templates below produce the exact same HTML as the pre-refactor site;
 * their whitespace is part of the document, so edit with care.
 */

import { SITE_CONTENT } from './content.js';
import { escapeHtml, slugifyTitle, openPingCard } from './site.js';

const S = SITE_CONTENT;
const { about, monologues, projects, personal, contact, wall } = S.sections;

// ---------------------------------------------------------------------------
// Card renderers
// ---------------------------------------------------------------------------

/**
 * Turns a bare repo name into a full GitHub URL. A full URL passes through
 * unchanged, so a project can point at any host (e.g. a private Gitea).
 */
function githubUrl(value) {
  const root = `https://github.com/${S.meta.githubUser}`;
  return /^https?:\/\//i.test(value) ? value : `${root}/${value}`;
}

/**
 * Renders one project card of the Projects tab.
 * - `project.url`    adds the "Website" link
 * - `project.github` adds the "Source code" link (bare name or full URL)
 */
function renderProject(project) {
  const links = [];
  const labels = S.labels.cardLinks;

  if (project.url) {
    links.push(
      `<li><a href="${escapeHtml(project.url)}" target="_blank" rel="noopener noreferrer">${labels.website} <span aria-hidden="true">&rarr;</span></a></li>`
    );
  }

  if (project.github) {
    links.push(
      `<li><a href="${escapeHtml(githubUrl(project.github))}" target="_blank" rel="noopener noreferrer">${labels.sourceCode} <span aria-hidden="true">&rarr;</span></a></li>`
    );
  }

  const linkBlock = links.length
    ? `<ul class="card-links">${links.join('')}</ul>`
    : '';

  return `
        <article class="card">
          <header class="card-head">
            <h2>${escapeHtml(project.name)}</h2>
            <span class="card-status">${escapeHtml(project.type)}</span>
          </header>
          <p>${escapeHtml(project.desc)}</p>
          ${linkBlock}
        </article>`;
}

/**
 * Renders one row of the Personal tab. The "View" link points at the detail
 * page whose slug is the lowercased, dash-separated item title - it must
 * exist as an entry in site.topics of content.js. While
 * site.meta.showTopicImages is false the View row is omitted too: without
 * their image slots those pages only repeat the card's own note.
 */
function renderPersonalItem(item, index) {
  const num = String(index + 1).padStart(2, '0');
  const note = item.note ? `<p>${escapeHtml(item.note)}</p>` : '';
  const slug = escapeHtml(slugifyTitle(item.title));

  // Same flag as the topic renderer: hidden images == hidden View buttons,
  // because the standalone pages have nothing new to show yet. The exact
  // inner whitespace below is part of the page output, preserved verbatim.
  const linkRow = S.meta.showTopicImages !== false
    ? `<ul class="card-links">
                <li><a href="./topic/index.html?p=${slug}">${S.labels.cardLinks.view} <span aria-hidden="true">&rarr;</span></a></li>
            </ul>`
    : '';

  return `
        <li>
          <span class="index-num">${num}</span>
          <div>
            <h2>${escapeHtml(item.title)}</h2>
            ${note}
            ${linkRow}
          </div>
        </li>`;
}

/**
 * Renders one monologue card, with its "21 APRIL 2026"-style date line
 * (meta.date and meta.year are rendered separated by one space) and a
 * "Read" link to the full article page.
 */
function renderMonologue(post) {
  const href = `./monologue/index.html?p=${encodeURIComponent(post.slug)}`;

  return `
        <article class="card">
          <header class="card-head">
            <h2>${escapeHtml(post.title)}</h2>
            <span class="card-status">${escapeHtml(post.date)} ${escapeHtml(post.year)}</span>
          </header>
          <p>${escapeHtml(post.preview)}</p>
          <ul class="card-links">
            <li><a href="${href}">${S.labels.cardLinks.read} <span aria-hidden="true">&rarr;</span></a></li>
          </ul>
        </article>`;
}

// ---------------------------------------------------------------------------
// About helpers
// ---------------------------------------------------------------------------

/**
 * Renders one box of the About stats grid (the big numbers row).
 * The 8-space base indentation of the item is part of the HTML between the
 * grid container and its children, so the literal starts without a newline.
 */
function renderStat(stat) {
  return `        <div class="stat">
          <span class="stat-value">${stat.value}</span>
          <span class="stat-label">${stat.label}</span>
        </div>`;
}

/**
 * Renders one fact row of the About definition list (same indentation note).
 */
function renderFact(fact) {
  return `        <div class="fact">
          <dt>${fact.term}</dt>
          <dd>${fact.detail}</dd>
        </div>`;
}

/**
 * Renders one row of the Contact link list (same indentation note).
 */
function renderContactRow(link) {
  return `        <li>
          <a href="${link.url}" target="_blank" rel="noopener noreferrer">
            <span>${link.label}</span>
            <span class="link-handle">${link.handle}</span>
            <span class="link-arrow" aria-hidden="true">&rarr;</span>
          </a>
        </li>`;
}

/**
 * Renders one curated mark on the wall: the alias first (micro label),
 * then the line they left. Entries are hand-pasted from real pings into
 * content.js — nothing publishes itself.
 */
function renderWallRow(entry) {
  return `        <li>
          <span class="wall-alias">${escapeHtml(entry.alias)}</span>
          <span class="wall-quote">${escapeHtml(entry.line)}</span>
        </li>`;
}

// ---------------------------------------------------------------------------
// Tab templates (rendered HTML is identical to the original site)
// ---------------------------------------------------------------------------

const aboutStatsHtml = about.stats.map(renderStat).join('\n');
const aboutFactsHtml = about.facts.map(renderFact).join('\n');
const contactRowsHtml = contact.links.map(renderContactRow).join('\n');
const wallRowsHtml = wall.entries.length
  ? wall.entries.map(renderWallRow).join('\n')
  : `        <li class="wall-empty">${wall.empty}</li>`;

// ---------------------------------------------------------------------------
// Good first issues panel (Projects tab)
// ---------------------------------------------------------------------------

/** localStorage key of the issues cache: { at, items }. */
const ISSUES_CACHE_KEY = 'issues-cache-v1';

/**
 * Draws the fetched issues into the panel (or the fallback line when there
 * are none / the API failed). All copy comes from content.js.
 */
function drawIssues(panel, items) {
  const list = panel.querySelector('.issues-list');
  const fallback = panel.querySelector('.issues-fallback');
  const issues = projects.issues;
  const shown = items.slice(0, Number(issues.max) || 5);

  if (!shown.length) {
    list.innerHTML = '';
    fallback.textContent = issues.fallback;
    fallback.removeAttribute('hidden');
    return;
  }

  fallback.setAttribute('hidden', '');
  list.innerHTML = shown.map((it) => `
        <li>
          <a href="${escapeHtml(it.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(it.title)} <span aria-hidden="true">&rarr;</span></a>
          <span class="issues-repo">${escapeHtml(it.repo)}</span>
        </li>`).join('');
}

/**
 * Wires the wall's sign button: it opens the disturb card in wall mode
 * (the wall hint as placeholder, the wall title/tag/context on send).
 * A no-op when the ping widget is disabled. The click must not bubble to
 * the document's outside-click handler, or it would close the card the
 * same instant it opens.
 */
function wireWallSign(scope) {
  const sign = scope.querySelector('.wall-sign');
  if (!sign) return;
  sign.addEventListener('click', (event) => {
    event.stopPropagation();
    openPingCard({ mode: 'wall' });
  });
}

/**
 * Fills the good-first-issues panel: serves the visitor-local cache while
 * it is fresh, otherwise makes ONE unauthenticated search-API request for
 * open issues labelled "good first issue" across the GitHub user's public
 * repos. Any failure (offline, rate limit) degrades to the fallback line.
 * Fire-and-forget from render('projects').
 */
async function fillIssuesPanel(scope) {
  const panel = scope.querySelector('.issues-panel');
  if (!panel) return;
  const issues = projects.issues;
  const max = Number(issues.max) || 5;
  const cacheMs = (Number(issues.cacheMinutes) || 30) * 60000;

  let cached = null;
  try {
    cached = JSON.parse(localStorage.getItem(ISSUES_CACHE_KEY) || 'null');
  } catch (err) {
    void err; /* private mode: just fetch fresh every time */
  }
  if (cached && Array.isArray(cached.items) && Date.now() - cached.at < cacheMs) {
    drawIssues(panel, cached.items);
    return;
  }

  try {
    const query = `label:"good first issue" state:open user:${S.meta.githubUser}`;
    const res = await fetch(
      `https://api.github.com/search/issues?q=${encodeURIComponent(query)}&per_page=${max}&sort=created&order=desc`
    );
    if (!res.ok) throw new Error(`github said ${res.status}`);
    const data = await res.json();
    const items = ((data && data.items) || []).map((it) => ({
      title: it.title,
      href: it.html_url,
      repo: String(it.repository_url || '').split('/repos/')[1] || '',
    }));
    try {
      localStorage.setItem(ISSUES_CACHE_KEY, JSON.stringify({ at: Date.now(), items }));
    } catch (err) {
      void err;
    }
    drawIssues(panel, items);
  } catch (err) {
    void err;
    drawIssues(panel, []);
  }
}

export const PORTFOLIO_SECTIONS = {
  about: `
    <section class="portfolio-section">
      <h1>${about.heading}</h1>
      <p class="lead">
        ${about.intro}
      </p>

      <div class="stats">
${aboutStatsHtml}
      </div>

      <dl class="facts">
${aboutFactsHtml}
      </dl>
    </section>
  `,

  monologues: `
    <section class="portfolio-section">
      <h1>${monologues.heading}</h1>
      <p class="lead">
        ${monologues.intro}
      </p>

      <div class="card-list">${S.posts.map(renderMonologue).join('')}
      </div>
    </section>
  `,

  projects: `
    <section class="portfolio-section">
      <h1>${projects.heading}</h1>

      <div class="projects-layout">
        <div class="card-list">${S.projects.map(renderProject).join('')}
        </div>

        <aside class="issues-panel">
          <p class="section-label">${projects.issues.kicker}</p>
          <p class="issues-blurb">${projects.issues.blurb}</p>
          <ul class="issues-list"></ul>
          <p class="issues-fallback" hidden></p>
        </aside>
      </div>
    </section>
  `,

  personal: `
    <section class="portfolio-section">
      <h1>${personal.heading}</h1>

      <ol class="index-list">${S.personal.map(renderPersonalItem).join('')}
      </ol>
    </section>
  `,

  contact: `
    <section class="portfolio-section">
      <h1>${contact.heading}</h1>
      <p class="lead">${contact.intro}</p>

      <ul class="link-rows">
${contactRowsHtml}
      </ul>
    </section>
  `,

  wall: `
    <section class="portfolio-section">
      <h1>${wall.heading}</h1>
      <p class="lead">${wall.line}</p>

      <ul class="wall-entries">
${wallRowsHtml}
      </ul>
      <button type="button" class="wall-sign">${wall.sign}</button>
    </section>
  `,
};

/** Fallback tab when the location hash does not match a known tab. */
export const DEFAULT_SECTION = 'about';

// ---------------------------------------------------------------------------
// Page wiring
// ---------------------------------------------------------------------------

/**
 * Wires up the main page: renders the tab for the current location hash,
 * highlights the matching nav link, reacts to hash changes (back / forward
 * buttons) and binds the keyboard navigation. Called from entries/main.js
 * after the data is loaded.
 */
export function initMainPage() {
  const display = document.getElementById('content-view');
  const navLinks = document.querySelectorAll('.nav a[data-target]');

  if (!display) return;

  function currentKey() {
    return window.location.hash.replace('#', '');
  }

  function render(key) {
    const section = PORTFOLIO_SECTIONS[key] ? key : DEFAULT_SECTION;
    display.innerHTML = PORTFOLIO_SECTIONS[section];
    if (section === 'projects') fillIssuesPanel(display);
    if (section === 'wall') wireWallSign(display);

    navLinks.forEach((link) => {
      const isActive = link.dataset.target === section;
      link.classList.toggle('active', isActive);
      if (isActive) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  }

  navLinks.forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const key = link.dataset.target;
      render(key);
      if (currentKey() !== key) {
        window.location.hash = key;
      }
    });
  });

  const linkList = Array.from(navLinks);

  function focusLink(index) {
    const count = linkList.length;
    linkList[(index + count) % count].focus();
  }

  // Arrow keys, j/k, Home and End move focus within the nav.
  document.querySelector('.nav').addEventListener('keydown', (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;

    const index = linkList.indexOf(document.activeElement);
    if (index === -1) return;

    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowRight':
      case 'j':
        event.preventDefault();
        focusLink(index + 1);
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
      case 'k':
        event.preventDefault();
        focusLink(index - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusLink(0);
        break;
      case 'End':
        event.preventDefault();
        focusLink(linkList.length - 1);
        break;
    }
  });

  // Number keys open a section directly (1 = first tab, in nav order).
  document.addEventListener('keydown', (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;

    const target = event.target;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) return;

    const link = linkList[Number(event.key) - 1];
    if (link) {
      link.click();
      link.focus();
    }
  });

  // The skip link must not touch the hash, or the router would reset to About.
  const skipLink = document.querySelector('.skip-link');
  if (skipLink) {
    skipLink.addEventListener('click', (event) => {
      event.preventDefault();
      display.focus();
    });
  }

  window.addEventListener('hashchange', () => render(currentKey()));

  render(currentKey());
}
