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

/* -------------------------------------------------------------------------
 * PING - the bottom-right "disturb me" pill + popover, rendered by this one
 * function on every page. All copy/config comes from SITE_CONTENT.ping;
 * flipping `ping.enabled` to false (and rebuilding) removes the widget
 * entirely, same pattern as meta.showTopicImages.
 * ---------------------------------------------------------------------- */

/** localStorage key holding the millisecond timestamp of the next unlock. */
const PING_COOLDOWN_KEY = 'ping-last-sent-at';

/** Milliseconds the "failed" label stays on the pill before it resets. */
const PING_FAIL_RESET_MS = 2500;

/**
 * Set by initPingButton while the widget is live; lets other renderers
 * (ghost reports, the wall) open the card programmatically via openPingCard.
 */
let pingApi = null;

/**
 * Opens the disturb-me card from code. A no-op while the ping widget is
 * disabled (there is nothing to open).
 *
 *   prefill -> text placed in the note box (send enables if non-empty)
 *   mode    -> 'ghost' | 'wall' | null; switches the notification's
 *              title/tags (and the context line for 'wall') per site.ping
 */
export function openPingCard({ prefill = '', mode: nextMode = null } = {}) {
  if (pingApi) pingApi.open({ prefill, mode: nextMode });
}

/**
 * Builds and wires the disturb-me widget. A no-op while `ping.enabled` is
 * false or the topic is empty, so nothing renders and nothing pings.
 */
export function initPingButton() {
  const ping = SITE_CONTENT.ping;
  if (!ping || ping.enabled === false || !ping.topic) return null;
  const { labels } = ping;

  /* Which page is the visitor on? It rides along inside the message body
   * ("...from <page>") and becomes the tap-to-open link of the push. */
  const path = window.location.pathname;
  const slug = new URLSearchParams(window.location.search).get('p') || '';
  let context = labels.homeContext;
  if (path.indexOf('/monologue') !== -1) {
    context = slug ? `${labels.monologueContext}: ${slug}` : labels.monologueContext;
  } else if (path.indexOf('/topic') !== -1) {
    context = slug ? `${labels.topicContext}: ${slug}` : labels.topicContext;
  }
  const clickUrl = `${SITE_CONTENT.meta.url}${path}${window.location.search}`;
  const server = String(ping.server).replace(/\/+$/, '');

  /* Optional mode of the next send: 'ghost' (a not-found report) or 'wall'
   * (a wall signature). The pill itself always resets to a normal ping. */
  let mode = null;

  /* The whole widget is one static subtree appended to the body. The card
   * reads top-down: heading, then the note box with send beside it on one
   * line, then the "or" rule, the one-click quick ping, and the small
   * work-with-me postscript. */
  const root = document.createElement('div');
  root.className = 'ping-root';
  root.innerHTML = `
      <div class="ping-pop" hidden>
        <p class="ping-pop-heading">${escapeHtml(labels.heading)}</p>
        <div class="ping-row">
          <textarea class="ping-note" rows="2" maxlength="${Number(ping.maxNoteLength)}" placeholder="${escapeHtml(labels.placeholder)}"></textarea>
          <button type="button" class="ping-send" disabled>${escapeHtml(labels.send)}</button>
        </div>
        <div class="ping-or"><span>${escapeHtml(labels.or)}</span></div>
        <button type="button" class="ping-quick">${escapeHtml(labels.quickPing)}</button>
        <p class="ping-work">${escapeHtml(labels.workWithMe)}</p>
      </div>
      <button type="button" class="ping-pill" aria-expanded="false">${escapeHtml(labels.button)}</button>`;
  document.body.appendChild(root);

  const pop = root.querySelector('.ping-pop');
  const pill = root.querySelector('.ping-pill');
  const quick = root.querySelector('.ping-quick');
  const note = root.querySelector('.ping-note');
  const send = root.querySelector('.ping-send');

  /** Restores the idle state after a send (or the cooldown ran out). */
  const unlock = () => {
    pill.disabled = false;
    quick.disabled = false;
    send.disabled = note.value.trim().length === 0;
    pill.textContent = labels.button;
  };

  /** Schedules `unlock` without keeping the page from ever unloading. */
  const schedule = (fn, ms) => {
    const timer = setTimeout(fn, ms);
    if (typeof timer === 'object' && timer && typeof timer.unref === 'function') {
      timer.unref();
    }
  };

  /** Sends one notification: a note (or the quick-ping line) + the page.
   * Ghost mode swaps in the ghost report's title/tag; wall mode swaps in
   * the wall signature's — and 'wall' reports the wall as the context. */
  const sendPing = (noteText) => {
    const ghostMode = mode === 'ghost' && ping.ghost;
    const wall = SITE_CONTENT.sections.contact.wall;
    const wallMode = mode === 'wall' && wall;
    const bodyContext = wallMode ? wall.context : context;
    const body = `${noteText || ping.quickBody}\n— anonymous, from ${bodyContext}`;
    pill.disabled = true;
    quick.disabled = true;
    send.disabled = true;
    pill.textContent = labels.sending;
    fetch(`${server}/${ping.topic}`, {
      method: 'POST',
      headers: {
        'X-Title': ghostMode ? ping.ghost.title : wallMode ? wall.pingTitle : ping.notifyTitle,
        'X-Tags': ghostMode ? ping.ghost.tag : wallMode ? wall.pingTag : ping.tags,
        'X-Click': clickUrl,
      },
      body,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`ntfy said ${res.status}`);
        try {
          localStorage.setItem(PING_COOLDOWN_KEY, String(Date.now() + ping.cooldownSeconds * 1000));
        } catch (err) {
          void err; /* private mode: no cooldown across reloads, fine */
        }
        pill.textContent = labels.sent;
        pop.setAttribute('hidden', '');
        pill.setAttribute('aria-expanded', 'false');
        mode = null;
        schedule(unlock, ping.cooldownSeconds * 1000);
      })
      .catch(() => {
        /* No cooldown after a failure - let the visitor retry at once. */
        pill.textContent = labels.failed;
        schedule(unlock, PING_FAIL_RESET_MS);
      });
  };

  const openPop = (focusNote) => {
    pop.removeAttribute('hidden');
    pill.setAttribute('aria-expanded', 'true');
    if (focusNote) note.focus(); else quick.focus();
  };

  const closePop = () => {
    if (pop.hasAttribute('hidden')) return;
    pop.setAttribute('hidden', '');
    pill.setAttribute('aria-expanded', 'false');
    pill.focus();
  };

  pill.addEventListener('click', () => {
    mode = null; /* the pill itself is always a plain disturb */
    note.placeholder = labels.placeholder;
    if (pop.hasAttribute('hidden')) openPop(); else closePop();
  });
  quick.addEventListener('click', () => sendPing(''));
  note.addEventListener('input', () => {
    send.disabled = note.value.trim().length === 0;
  });
  send.addEventListener('click', () => sendPing(note.value.trim()));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closePop();
  });
  document.addEventListener('click', (event) => {
    if (!root.contains(event.target)) closePop();
  });

  /* Survived a reload within the cooldown? Start locked with what's left. */
  let lastSent = 0;
  try {
    lastSent = Number(localStorage.getItem(PING_COOLDOWN_KEY)) || 0;
  } catch (err) {
    void err;
  }
  const remaining = lastSent - Date.now();
  if (remaining > 0) {
    pill.disabled = true;
    quick.disabled = true;
    send.disabled = true;
    pill.textContent = labels.sent;
    schedule(unlock, remaining);
  }

  pingApi = {
    open({ prefill = '', mode: nextMode = null } = {}) {
      mode = nextMode || null;
      const wall = SITE_CONTENT.sections.contact.wall;
      const wallMode = mode === 'wall' && wall;
      note.placeholder = wallMode ? wall.hint : labels.placeholder;
      if (prefill) {
        note.value = prefill;
        send.disabled = note.value.trim().length === 0;
      }
      openPop(Boolean(prefill) || wallMode);
    },
  };

  return root;
}
