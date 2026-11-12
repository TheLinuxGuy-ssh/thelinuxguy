#!/usr/bin/env node
/**
 * Verification harness for the site. Run before every commit, in both
 * modes:
 *
 *   node scripts/verify.mjs plain
 *   node scripts/verify.mjs min
 *
 * It builds the CURRENT assets and the last COMMITTED assets (a fixbase
 * generated fresh from `git archive HEAD` on every run) into three bundles
 * each (main / post / topic-page), then:
 *
 *   - byte-gates every state that must not change (renders, fills, head
 *     tags, nav clicks) by comparing recorded op-streams old vs new;
 *   - audits every added word against SANCTIONED (plus words that are
 *     auto-derived from curated content, like wall entries);
 *   - exercises every feature directly on the new side: the ping widget
 *     (quick/note/ghost/wall modes, cooldown, failures, focus, close
 *     behaviour), the good-first-issues panel, the not-found ghost
 *     reports, the wall tab, and the visit doorbell.
 *
 * The fake DOM records ops instead of touching a real document, so the
 * whole run is offline, fast and deterministic.
 */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const MODE = process.argv[2] === 'min' ? 'min' : 'plain';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const TMP = '/private/var/folders/4d/m1bnsw3n09v4sl06kmn6g0880000gn/T/opencode/tlg-verify';
const read = (p) => fs.readFileSync(p, 'utf8');

/* Live content for every expectation — the audit and the gates always
 * derive from the real content.js, so editing content never breaks the
 * harness for the wrong reason. */
const contentSrc = read(path.join(ROOT, 'assets', 'js', 'content.js'))
  .replace(/^export /gm, '') + '\n;globalThis.SITE_CONTENT = SITE_CONTENT;';
const contentCtx = { console };
vm.createContext(contentCtx);
vm.runInContext(contentSrc, contentCtx, { filename: 'content.js' });
const C = contentCtx.SITE_CONTENT;
const P = C.ping;
const V = C.visits;
const W = C.sections.wall;

/* ------------------------------------------------------------------ *
   Fake DOM recorder
 * ------------------------------------------------------------------ */
class El {
  constructor(rec, id, tag = 'div') {
    this.__rec = rec;
    this.__id = id;
    this.__tag = tag;
    this.__text = '';
    this.__attrs = new Map();
    this.__sync = false;
    this.dataset = {};
    this.value = '';
    this.disabled = false;
    this.handlers = new Map();
    this.children = new Map();
  }
  get textContent() { return this.__text; }
  set textContent(v) {
    this.__text = v;
    const op = ['text', this.__id, v];
    (this.__sync ? this.__rec.syncOps : this.__rec.ops).push(op);
  }
  set innerHTML(v) { this.__rec.ops.push(['html', this.__id, v]); }
  get classList() {
    const rec = this.__rec, id = this.__id;
    return { toggle: (k, v) => rec.ops.push(['cls', id, k, !!v]) };
  }
  setAttribute(k, v) { this.__attrs.set(k, v); this.__rec.ops.push(['attr', this.__id, k, v]); }
  removeAttribute(k) { this.__attrs.delete(k); this.__rec.ops.push(['unattr', this.__id, k]); }
  getAttribute(k) { return this.__attrs.has(k) ? this.__attrs.get(k) : null; }
  hasAttribute(k) { return this.__attrs.has(k); }
  remove() { this.__rec.ops.push(['removed', this.__id]); }
  addEventListener(t, f) { this.handlers.set(t, f); }
  focus() { this.__rec.ops.push(['focus', this.__id]); }
  click() {}
  querySelector(sel) {
    const key = `${this.__id} :: ${sel}`;
    if (!this.children.has(key)) this.children.set(key, new El(this.__rec, key));
    return this.children.get(key);
  }
  contains(node) {
    if (node === this) return true;
    for (const child of this.children.values()) {
      if (child.contains(node)) return true;
    }
    return false;
  }
  serialize() {
    const props = {};
    for (const k of ['rel', 'href', 'type']) if (this[k] !== undefined) props[k] = this[k];
    return JSON.stringify({ tag: this.__tag, props, attrs: Object.fromEntries(this.__attrs), text: this.__text });
  }
}

const NAV_TARGETS = C.navigation.map((n) => n.target);
const PAGE = { main: 'main', post: 'post', topic: 'topic-page' };

function makeRecorder({ params = '', hash = '', pathname = '/', referrer = '' } = {}) {
  const rec = {
    ops: [], syncOps: [], head: [],
    docHandlers: new Map(), winHandlers: new Map(),
    navLinks: [], byId: new Map(),
    bodyNodes: [],
    fetches: [], fetchResult: null, fetchBody: undefined, fetchThrows: false,
    store: {}, timers: [],
    location: {
      search: params,
      pathname,
      _hash: hash,
      get hash() { return `#${this._hash}`.replace(/^#$/, ''); },
      get href() { return `${this.pathname}${this.search}${this.hash}`; },
      set hash(v) {
        this._hash = String(v).replace(/^#/, '');
        rec.ops.push(['hash', v]);
        for (const f of rec.winHandlers.get('hashchange') || []) f();
      },
    },
  };
  rec.document = {
    title_: '',
    readyState: 'interactive',
    referrer,
    get title() { return this.title_; },
    set title(v) { this.title_ = v; rec.ops.push(['title', v]); },
    addEventListener(t, f) {
      if (!rec.docHandlers.has(t)) rec.docHandlers.set(t, []);
      rec.docHandlers.get(t).push(f);
    },
    getElementById(id) {
      if (!rec.byId.has(id)) rec.byId.set(id, new El(rec, `#${id}`));
      return rec.byId.get(id);
    },
    querySelector(sel) {
      if (sel === '.nav') return new El(rec, 'nav-root');
      if (sel === '.skip-link') return new El(rec, 'skip');
      const syncSel = ['.me', '.badge', ...NAV_TARGETS.map((t) => `.nav a[data-target="${t}"]`)];
      if (syncSel.includes(sel)) {
        const el = new El(rec, `sync${sel}`);
        el.__sync = true;
        return el;
      }
      return null;
    },
    querySelectorAll(sel) {
      if (sel === '.nav a[data-target]') return rec.navLinks;
      return [];
    },
    head: { querySelector: () => null, appendChild: (n) => rec.head.push(n) },
    body: { appendChild: (n) => rec.bodyNodes.push(n) },
    createElement: (tag) => new El(rec, `created:${tag}`, tag),
    activeElement: null,
  };
  rec.window = {
    location: rec.location,
    addEventListener(t, f) {
      if (!rec.winHandlers.has(t)) rec.winHandlers.set(t, []);
      rec.winHandlers.get(t).push(f);
    },
  };
  for (const target of NAV_TARGETS) {
    const link = new El(rec, `nav:${target}`);
    link.dataset.target = target;
    rec.navLinks.push(link);
  }
  // Compared op-streams skip every op on a `created:*` element: those belong
  // to additive widgets (the ping widget, topic head tags) which carry their
  // own dedicated gates below. Stripping keeps the legacy byte/word gates
  // measuring exactly what they measured before the features existed.
  rec.opsKey = () => rec.ops
    .filter((o) => !String(o[1] || '').startsWith('created:'))
    .map((o) => JSON.stringify(o)).join('\n');
  rec.headKey = () => rec.head.map((n) => n.serialize()).join('\n');
  rec.fillKey = () => [...rec.byId.values()]
    .flatMap((el) => [...el.children]
      // children with empty text are lazy querySelector artifacts (e.g. a
      // wiring lookup) — real fills always carry text, and a LOST fill
      // still shows up as old-side text vs new-side absence.
      .filter(([, c]) => c.__text !== '')
      .map(([k, c]) => `${k.split('::')[1]}=${c.__text}`))
    .join('|');
  return rec;
}

/* ------------------------------------------------------------------ *
   Build both sides (+ the two disabled-feature sides)
 * ------------------------------------------------------------------ */
function buildSide(sideAssets, name, minify = MODE === 'min') {
  const dir = path.join(TMP, `v-${name}-${MODE}`);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  for (const entry of ['main', 'post', 'topic-page']) {
    execSync(
      `${ROOT}/node_modules/.bin/esbuild ${sideAssets}/js/entries/${entry}.js ` +
      `--bundle --format=iife${minify ? ' --minify' : ''} --outfile=${dir}/${entry}.js`,
      { stdio: 'pipe' }
    );
  }
  return dir;
}

/** Copies the live assets and flips one feature's master switch off, so a
 * disabled feature can be exercised as real built code, not a source grep. */
function disabledSide(feature) {
  const dir = path.join(TMP, `stage-off-${feature}-${MODE}`);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  execSync(`cp -R ${ROOT}/assets ${dir}/assets`, { stdio: 'pipe' });
  const contentPath = path.join(dir, 'assets', 'js', 'content.js');
  const anchor = feature === 'ping'
    ? "ping: {\n    /** Master switch (same pattern as meta.showTopicImages). */\n    enabled: true,"
    : "visits: {\n    /** Master switch (same pattern as ping.enabled). */\n    enabled: true,";
  const src = read(contentPath);
  if (!src.includes(anchor)) throw new Error(`disabledSide: anchor for ${feature} not found`);
  fs.writeFileSync(contentPath, src.replace(anchor, anchor.replace('enabled: true', 'enabled: false')));
  return buildSide(path.join(dir, 'assets'), `off-${feature}`);
}

function run(rec, kind, dir) {
  const sandbox = { document: rec.document, window: rec.window, console, URLSearchParams, URL };
  // Browser globals the widgets use, as recording stubs so gates can
  // inspect calls without network or wall-clock timers.
  sandbox.fetch = (url, opts) => {
    /* Mimics a browser's synchronous header-validation TypeError (the old
     * emoji-in-X-Title bug): fetch() throws BEFORE any promise exists. */
    if (rec.fetchThrows) throw new TypeError('simulated: cannot convert argument to a ByteString');
    rec.fetches.push({ url, opts });
    const r = rec.fetchResult || { ok: true, status: 200 };
    const body = rec.fetchBody;
    return Promise.resolve({
      ok: r.ok,
      status: r.status,
      json: () => Promise.resolve(body === undefined ? null : body),
    });
  };
  sandbox.localStorage = {
    getItem: (k) => (k in rec.store ? rec.store[k] : null),
    setItem: (k, v) => { rec.store[k] = String(v); },
  };
  sandbox.setTimeout = (fn, ms) => { rec.timers.push({ fn, ms }); return rec.timers.length; };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read(path.join(dir, `${PAGE[kind]}.js`)), sandbox, { filename: `${kind}.js` });
}

/* ------------------------------------------------------------------ *
   Drivers
 * ------------------------------------------------------------------ */
function driveMainInit(side) {
  const states = {};
  for (const key of ['', ...NAV_TARGETS, 'nope']) {
    if (key === 'wall') continue; // curated content: gated directly, not byte-wise
    const rec = makeRecorder({ hash: key });
    run(rec, 'main', OUT[side]);
    states[key || 'default'] = { ops: rec.opsKey(), sync: rec.syncOps.map((o) => JSON.stringify(o)).join('\n') };
  }
  return states;
}

function driveMainClicks(side) {
  const rec = makeRecorder({});
  run(rec, 'main', OUT[side]);
  const since = rec.ops.length;
  for (const link of rec.navLinks) {
    link.handlers.get('click')({ preventDefault() {} });
  }
  return rec.ops.slice(since).map((o) => JSON.stringify(o)).join('\n');
}

function driveDetail(side, kind, slugs) {
  const states = {};
  for (const slug of slugs) {
    const pathname = kind === 'post' ? '/monologue/' : '/topic/';
    const rec = makeRecorder({ params: `?p=${slug}`, pathname });
    run(rec, kind, OUT[side]);
    states[slug] = { ops: rec.opsKey(), head: rec.headKey(), fill: rec.fillKey() };
  }
  return states;
}

/* ------------------------------------------------------------------ *
   Word extraction + lexical audit
 * ------------------------------------------------------------------ */
const tokensOf = (src) => new Set(
  String(src)
    // comments are not content; strip them so prose in comments never
    // trips the audit (esbuild keeps comments in plain mode)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|\n)\s*\/\/[^\n]*/g, '$1')
    // decode esbuild's \xNN / \uNNNN escapes so punctuation like the
    // middle-dot separator tokenizes as punctuation, not as "xb7"
    .replace(/\\x([0-9a-fA-F]{2})/g, (m, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\u([0-9a-fA-F]{4})/g, (m, h) => String.fromCharCode(parseInt(h, 16)))
    .toLowerCase()
    .match(/[a-z0-9_]+/g) || []
);

/** Words auto-derived from curated content: the wall's hand-pasted rows
 * change whenever curation happens, so they can never be frozen here. */
const CURATED_TOKENS = new Set();
for (const entry of W.entries) {
  for (const t of tokensOf(`${entry.alias} ${entry.line}`)) CURATED_TOKENS.add(t);
}

/* Every added word must be sanctioned. Grown feature by feature; each
 * entry below was reviewed when the feature shipped. */
const SANCTIONED = new Set([
  // visit doorbell (initVisitPing)
  'initvisitping', 'schedulesoft', 'visit_key', 'visit_claim_key', 'visit_claim_ms',
  'visits', 'windowdays', 'delayseconds', 'priority', 'referrer', 'hostname',
  '7v3kqm', 'walked', 'typed', 'bookmark', 'reading', 'bell', 'claim',
  'noticed', 'pending', 'direct', 'visit', 'landing', 'host', '7', '10', '60', '24',
  // copy reworded by hand in content.js
  'someone', 'notes',
]);

/* ------------------------------------------------------------------ *
   The gate counter
 * ------------------------------------------------------------------ */
let passes = 0;
const failures = [];
function ok(cond, message) {
  if (cond) { passes += 1; console.log(`PASS ${message}`); }
  else { failures.push(message); console.log(`FAIL ${message}`); }
}

/* ------------------------------------------------------------------ *
   Fixbase: the last committed state, generated fresh every run
 * ------------------------------------------------------------------ */
fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });
const FIXBASE = path.join(TMP, 'fixbase');
fs.mkdirSync(FIXBASE, { recursive: true });
execSync(`git -C ${ROOT} archive HEAD assets | tar -x -C ${FIXBASE}`, { stdio: 'pipe' });

const OUT = { old: buildSide(path.join(FIXBASE, 'assets'), 'old'), new: buildSide(path.join(ROOT, 'assets'), 'new') };
const OUT_PING_OFF = disabledSide('ping');
const OUT_VISITS_OFF = disabledSide('visits');

/* Plain copies for the word audit (identifiers survive only unminified) —
 * built unminified in BOTH modes, so one SANCTIONED set serves both. */
const PLAIN = MODE === 'min'
  ? {
      old: buildSide(path.join(FIXBASE, 'assets'), 'old-plain', false),
      new: buildSide(path.join(ROOT, 'assets'), 'new-plain', false),
    }
  : OUT;

const tick = () => new Promise((r) => setImmediate(r));
const raw = (rec) => rec.ops.map((o) => JSON.stringify(o)).join('\n');
const flushTimers = (rec) => { for (const t of rec.timers.splice(0)) t.fn(); };

const widget = (rec) => {
  const root = rec.bodyNodes[0];
  if (!root) return null;
  const htmlOp = rec.ops.find((o) => o[0] === 'html' && o[1] === 'created:div');
  const w = {
    root,
    pop: root.children.get('created:div :: .ping-pop'),
    pill: root.children.get('created:div :: .ping-pill'),
    quick: root.children.get('created:div :: .ping-quick'),
    note: root.children.get('created:div :: .ping-note'),
    send: root.children.get('created:div :: .ping-send'),
  };
  // The shipped markup marks the send button disabled; the fake DOM does
  // not parse HTML strings, so mirror that state here.
  if (w.send && htmlOp && htmlOp[2].includes('class="ping-send" disabled')) {
    w.send.disabled = true;
  }
  // Same for the popover's initial `hidden` attribute (set silently, the
  // real parser does not record an op for it either).
  if (w.pop && htmlOp && htmlOp[2].includes('class="ping-pop" hidden')) {
    w.pop.__attrs.set('hidden', '');
  }
  return w;
};

// Dispatch an event to one element's handler. A disabled button swallows
// clicks exactly like a real browser does.
const fire = (el, type, ev = {}) => {
  if (el.disabled) return false;
  const f = el.handlers.get(type);
  if (f) f(ev);
  return !!f;
};
// Dispatch through every registered document listener, the way a real
// browser would.
const fireDoc = (rec, type, ev = {}) => {
  for (const h of rec.docHandlers.get(type) || []) h(ev);
};
/* A real click bubbles: the target's handler runs first, and unless it
 * calls event.stopPropagation(), the document-level handlers see it too.
 * This is the gate for the opener-click class of bug (an opener that lets
 * its own click close the card the same instant it opens). */
const bubble = (rec, el, type, ev = {}) => {
  let stopped = false;
  const event = {
    ...ev,
    stopPropagation() { stopped = true; },
    preventDefault() {},
  };
  const f = el.handlers.get(type);
  if (f) f(event);
  if (!stopped) fireDoc(rec, type, event);
  return !stopped;
};

/* ================================================================== *
   1. BYTE GATES - states that must not change between HEAD and now
 * ================================================================== */
{
  const oldStates = driveMainInit('old');
  const newStates = driveMainInit('new');
  for (const key of Object.keys(oldStates)) {
    ok(oldStates[key].ops === newStates[key].ops, `byte: "${key}" tab renders identically`);
    ok(oldStates[key].sync === newStates[key].sync, `byte: "${key}" identity/nav sync identical`);
  }

  const oldClicks = driveMainClicks('old');
  const newClicks = driveMainClicks('new');
  ok(oldClicks === newClicks, 'byte: nav clicks render + highlight identically');

  const oldPosts = driveDetail('old', 'post', C.posts.map((p) => p.slug));
  const newPosts = driveDetail('new', 'post', C.posts.map((p) => p.slug));
  for (const slug of Object.keys(oldPosts)) {
    ok(oldPosts[slug].ops === newPosts[slug].ops, `byte: monologue "${slug}" renders identically`);
    ok(oldPosts[slug].head === newPosts[slug].head, `byte: monologue "${slug}" head identical`);
    ok(oldPosts[slug].fill === newPosts[slug].fill, `byte: monologue "${slug}" fills identical`);
  }

  const oldTopics = driveDetail('old', 'topic', C.topics.map((t) => t.slug));
  const newTopics = driveDetail('new', 'topic', C.topics.map((t) => t.slug));
  for (const slug of Object.keys(oldTopics)) {
    ok(oldTopics[slug].ops === newTopics[slug].ops, `byte: personal "${slug}" renders identically`);
    ok(oldTopics[slug].head === newTopics[slug].head, `byte: personal "${slug}" head identical`);
    ok(oldTopics[slug].fill === newTopics[slug].fill, `byte: personal "${slug}" fills identical`);
  }
}

/* ================================================================== *
   2. WORD AUDIT - every added word is sanctioned or curated
 * ================================================================== */
{
  const oldTokens = new Set();
  for (const entry of ['main', 'post', 'topic-page']) {
    for (const t of tokensOf(read(path.join(PLAIN.old, `${entry}.js`)))) oldTokens.add(t);
  }
  const newTokens = new Set();
  for (const entry of ['main', 'post', 'topic-page']) {
    for (const t of tokensOf(read(path.join(PLAIN.new, `${entry}.js`)))) newTokens.add(t);
  }
  const unsanctioned = [...newTokens]
    .filter((t) => !oldTokens.has(t) && !SANCTIONED.has(t) && !CURATED_TOKENS.has(t));
  ok(unsanctioned.length === 0,
    `word audit: every added word is sanctioned (${unsanctioned.length} stray: ${unsanctioned.slice(0, 20).join(', ')})`);
}

/* ================================================================== *
   3. IDENTITY + NAV LABELS - derived from the live content
 * ================================================================== */
{
  const rec = makeRecorder({});
  run(rec, 'main', OUT.new);
  const syncText = rec.syncOps.map((o) => JSON.stringify(o)).join('\n');
  ok(syncText.includes(JSON.stringify(['text', 'sync.me', C.identity.name])), 'identity: the header name syncs from content');
  ok(syncText.includes(JSON.stringify(['text', 'sync.badge', C.identity.badge])), 'identity: the header badge syncs from content');
  for (const { label, target } of C.navigation) {
    ok(syncText.includes(JSON.stringify(['text', `sync.nav a[data-target="${target}"]`, label])),
      `nav: "${target}" label syncs from content`);
  }
  const indexHtml = read(path.join(ROOT, 'index.html'));
  for (const { target } of C.navigation) {
    ok(indexHtml.includes(`data-target="${target}"`), `shell: index.html has the "${target}" nav link`);
  }
}

/* ================================================================== *
   4. PING WIDGET
 * ================================================================== */
{
  const server = String(P.server).replace(/\/+$/, '');

  /* A. home page: open + quick ping happy path */
  const a = makeRecorder({ pathname: '/' });
  run(a, 'main', OUT.new);
  const w = widget(a);
  ok(!!w && !!w.pill, 'ping: pill built on the home page');
  ok(a.fetches.length === 0, 'ping: no network before any click');
  const htmlOp = a.ops.find((o) => o[0] === 'html' && o[1] === 'created:div');
  ok(!!htmlOp
    && htmlOp[2].includes(P.labels.button)
    && htmlOp[2].includes(P.labels.heading)
    && htmlOp[2].includes(P.labels.or)
    && htmlOp[2].includes(P.labels.quickPing)
    && htmlOp[2].includes(P.labels.placeholder)
    && htmlOp[2].includes(P.labels.send)
    && htmlOp[2].includes(P.labels.workWithMe)
    && !htmlOp[2].includes('no name'),
  'ping: popover markup carries every content.js ping string');
  {
    const markup = htmlOp[2];
    const pos = (s) => markup.indexOf(s);
    ok(pos('ping-pop-heading') !== -1
      && pos('ping-pop-heading') < pos('ping-row')
      && pos('ping-row') < pos('ping-or')
      && pos('ping-or') < pos('ping-quick')
      && pos('ping-quick') < pos('ping-work'),
    'ping: order is heading, note+send row, or, quick ping, work-with-me line');
  }
  fire(w.pill, 'click');
  ok(raw(a).includes('["unattr","created:div :: .ping-pop","hidden"]')
    && raw(a).includes('["attr","created:div :: .ping-pill","aria-expanded","true"]'),
  'ping: pill click opens the popover (unhidden + aria-expanded)');
  ok(a.ops.some((o) => o[0] === 'focus' && o[1] === 'created:div :: .ping-note'),
    'ping: the pill opens with the note box focused');
  ok(fire(w.quick, 'click'), 'ping: quick ping click fires while unlocked');
  await tick();
  ok(a.fetches.length === 1, 'ping: exactly one POST');
  const f = a.fetches[0];
  ok(f.url === `${server}/`, `ping: POST hits the server root (${server}/) — JSON mode`);
  ok(f.opts.method === 'POST', 'ping: method is POST');
  ok(f.opts.headers['Content-Type'] === 'application/json', 'ping: published as application/json');
  const fa = JSON.parse(f.opts.body);
  ok(fa.topic === P.topic, 'ping: payload carries the topic');
  ok(fa.title === P.notifyTitle, 'ping: title carries the notification title (unicode-safe)');
  ok(JSON.stringify(fa.tags) === JSON.stringify(P.tags.split(',').map((t) => t.trim())), 'ping: tags carry the emoji shortcodes');
  ok(fa.click === `${C.meta.url}/`, 'ping: click opens the current page');
  ok(fa.message.includes(P.quickBody), 'ping: quick body line present');
  ok(fa.message.includes(`— anonymous, from ${P.labels.homeContext}`), 'ping: page context rides along in the body');
  ok(w.pill.textContent === P.labels.sent, 'ping: pill shows the sent label');
  ok(!!a.store['ping-last-sent-at'], 'ping: successful send starts the cooldown');
  ok(!!a.timers.find((t) => t.ms === P.cooldownSeconds * 1000), 'ping: the cooldown unlock is scheduled');

  /* B. monologue page: the note path */
  const postSlug = C.posts[0].slug;
  const b = makeRecorder({ pathname: '/monologue/', params: `?p=${postSlug}` });
  run(b, 'main', OUT.new);
  const wb = widget(b);
  ok(!!wb && !!wb.pill, 'ping: pill built on a monologue page');
  fire(wb.pill, 'click');
  ok(!fire(wb.send, 'click'), 'ping: send stays disabled until a note exists');
  wb.note.value = 'the potato chip on my desk is judging me';
  fire(wb.note, 'input');
  ok(wb.send.disabled === false, 'ping: send enables once a note exists');
  fire(wb.send, 'click');
  await tick();
  ok(b.fetches.length === 1, 'ping: note send POSTs once');
  const fb = JSON.parse(b.fetches[0].opts.body);
  ok(b.fetches[0].url === `${server}/`, 'ping: note POST hits the server root');
  ok(fb.message.startsWith('the potato chip on my desk is judging me'), 'ping: note text leads the message');
  ok(fb.message.includes(`monologue: ${postSlug}`), 'ping: monologue context rides along');
  ok(fb.click === `${C.meta.url}/monologue/?p=${postSlug}`, 'ping: click opens the exact monologue');
  ok(fb.message.includes(`— anonymous, from monologue: ${postSlug}`), 'ping: note keeps the anonymous page footer');

  /* B2. topic page: the personal context line */
  const topicSlug = C.topics[0].slug;
  const b2 = makeRecorder({ pathname: '/topic/', params: `?p=${topicSlug}` });
  run(b2, 'main', OUT.new);
  const wb2 = widget(b2);
  ok(!!wb2 && !!wb2.pill, 'ping: pill built on a topic page');
  fire(wb2.quick, 'click');
  await tick();
  ok(b2.fetches.length === 1, 'ping: topic quick ping POSTs once');
  const fb2 = JSON.parse(b2.fetches[0].opts.body);
  ok(fb2.message.includes(`personal: ${topicSlug}`), 'ping: topic context rides along');
  ok(fb2.click === `${C.meta.url}/topic/?p=${topicSlug}`, 'ping: click opens the exact topic');

  /* C. a failed send: visible label, no cooldown, instant retry */
  const c = makeRecorder({ pathname: '/' });
  run(c, 'main', OUT.new);
  const wc = widget(c);
  c.fetchResult = { ok: false, status: 429 };
  fire(wc.quick, 'click');
  await tick();
  ok(c.fetches.length === 1 && !c.store['ping-last-sent-at'], 'ping: a failed send starts no cooldown');
  ok(raw(c).includes(JSON.stringify(P.labels.failed)), 'ping: pill shows the failed label');
  const failReset = c.timers.find((t) => t.ms === 2500);
  ok(!!failReset, 'ping: a short failure reset runs instead of the cooldown');
  failReset.fn();
  c.fetchResult = null;
  ok(fire(wc.quick, 'click'), 'ping: retry after failure goes out at once');
  await tick();
  ok(c.fetches.length === 2 && !!c.store['ping-last-sent-at'], 'ping: successful retry starts the cooldown');

  /* C2. a SYNCHRONOUS throw inside sendPing (a bad fetch payload — the old
     emoji-in-X-Title bug made every send throw before any promise existed)
     must land in the visible failure path, never hang on "sending…". */
  const t1 = makeRecorder({ pathname: '/' });
  t1.fetchThrows = true;
  run(t1, 'main', OUT.new);
  const tw = widget(t1);
  fire(tw.quick, 'click');
  ok(tw.pill.textContent === P.labels.failed, 'ping: a synchronous throw shows the failed label');
  ok(!t1.store['ping-last-sent-at'], 'ping: a synchronous throw starts no cooldown');
  ok(!!t1.timers.find((t) => t.ms === 2500), 'ping: a synchronous throw runs the failure reset');

  /* D. popover closes on Escape and on outside clicks, stays on inside clicks */
  const d = makeRecorder({ pathname: '/' });
  run(d, 'main', OUT.new);
  const wd = widget(d);
  fire(wd.pill, 'click');
  ok(!wd.pop.hasAttribute('hidden'), 'ping: popover opens');
  ok(d.ops.some((o) => o[0] === 'focus' && o[1] === 'created:div :: .ping-note'),
    'ping: the pill opens with the note box focused');
  // The keyboard-nav handler of the main page shares the document, so the
  // Escape event carries a harmless target.
  fireDoc(d, 'keydown', { key: 'Escape', target: { tagName: 'DIV', isContentEditable: false } });
  ok(wd.pop.hasAttribute('hidden'), 'ping: Escape closes the popover');
  fire(wd.pill, 'click');
  fireDoc(d, 'click', { target: {} });
  ok(wd.pop.hasAttribute('hidden'), 'ping: an outside click closes the popover');
  fire(wd.pill, 'click');
  fireDoc(d, 'click', { target: wd.quick });
  ok(!wd.pop.hasAttribute('hidden'), 'ping: an inside click does not close the popover');

  /* E. survived a reload within the cooldown: start locked */
  const e = makeRecorder({ pathname: '/' });
  e.store['ping-last-sent-at'] = String(Date.now() + 5000);
  run(e, 'main', OUT.new);
  const we = widget(e);
  ok(we.pill.disabled === true && we.quick.disabled === true, 'ping: a reload inside the cooldown stays locked');
  ok(we.pill.textContent === P.labels.sent, 'ping: the locked pill shows the sent label');
  ok(!!e.timers.find((t) => t.ms > 3000 && t.ms <= 5000), 'ping: the leftover cooldown is scheduled');

  /* E2. ghost report on a not-found monologue page */
  const gh = makeRecorder({ pathname: '/monologue/', params: '?p=missing' });
  run(gh, 'post', OUT.new);
  const gbtn = gh.byId.get('post').children.get('#post :: .ghost-report');
  ok(!!gbtn && !!gbtn.handlers.get('click'), 'ghost: the report button is wired on a dead monologue');
  // The widget is grabbed BEFORE the opener click: its state mirror must
  // not clobber what the click just did (hidden/disabled are runtime now).
  const gw = widget(gh);
  ok(bubble(gh, gbtn, 'click', { target: gbtn }) === false,
    'ghost: the opener click stops propagation (the card would else close at once)');
  ok(!gw.pop.hasAttribute('hidden'), 'ghost: the report opens the card');  ok(gw.note.value.startsWith(P.ghost.note) && gw.note.value.includes('/monologue/?p=missing'),
    'ghost: the dead URL is prefilled into the note');
  ok(gw.send.disabled === false, 'ghost: send is armed by the prefill');
  fire(gw.send, 'click');
  await tick();
  ok(gh.fetches.length === 1, 'ghost: the report POSTs once');
  const gf = JSON.parse(gh.fetches[0].opts.body);
  ok(gf.title === P.ghost.title, 'ghost: the send uses the ghost title');
  ok(JSON.stringify(gf.tags) === JSON.stringify([P.ghost.tag]), 'ghost: the send uses the ghost tag');
  ok(gf.message.startsWith(P.ghost.note), 'ghost: the message starts with the ghost line');
  ok(gf.message.includes('/monologue/?p=missing'), 'ghost: the dead URL rides along');
  ok(gf.message.includes('— anonymous, from monologue: missing'), 'ghost: the context footer is kept');
  ok(gf.click === `${C.meta.url}/monologue/?p=missing`, 'ghost: click opens the dead URL');

  /* E3. the topic page has the ghost report too */
  const gt = makeRecorder({ pathname: '/topic/', params: '?p=missing' });
  run(gt, 'topic', OUT.new);
  ok(!!gt.byId.get('topic').children.get('#topic :: .ghost-report'), 'ghost: the topic not-found page has the report button');
}

/* ================================================================== *
   5. THE WALL
 * ================================================================== */
{
  const rec = makeRecorder({ hash: 'wall' });
  run(rec, 'main', OUT.new);
  const wallOp = rec.ops.find((o) => o[0] === 'html' && o[1] === '#content-view');
  ok(!!wallOp
    && wallOp[2].includes(W.heading)
    && wallOp[2].includes(W.line)
    && wallOp[2].includes('class="wall-sign"'),
  'wall: heading, line and the sign button render from content');
  if (W.entries.length) {
    for (const entry of W.entries) {
      ok(wallOp[2].includes(entry.alias) && wallOp[2].includes(entry.line), `wall: the row "${entry.alias}" renders`);
    }
    ok(!wallOp[2].includes('wall-empty'), 'wall: the empty line hides once entries exist');
  } else {
    ok(wallOp[2].includes('wall-empty') && wallOp[2].includes(W.empty),
      'wall: with no entries the empty line shows');
  }

  const wRec = makeRecorder({ hash: 'wall' });
  run(wRec, 'main', OUT.new);
  const ww = widget(wRec);
  const sign = wRec.byId.get('content-view').children.get('#content-view :: .wall-sign');
  ok(bubble(wRec, sign, 'click', { target: sign }) === false,
    'wall: the sign click stops propagation (the card would else close at once)');
  ok(!ww.pop.hasAttribute('hidden'), 'wall: the sign opens the card');
  ok(wRec.ops.some((o) => o[0] === 'focus' && o[1] === 'created:div :: .ping-note'),
    'wall: the sign opens with the note box focused');
  ok(ww.note.placeholder === W.hint, 'wall: the note placeholder is the wall hint');
  ww.note.value = 'the terminal ghosts say hi';
  fire(ww.note, 'input');
  fire(ww.send, 'click');
  await tick();
  ok(wRec.fetches.length === 1, 'wall: signing POSTs once');
  const wf = JSON.parse(wRec.fetches[0].opts.body);
  ok(wf.title === W.pingTitle, 'wall: the send uses the wall title');
  ok(JSON.stringify(wf.tags) === JSON.stringify([W.pingTag]), 'wall: the send uses the wall tag');
  ok(wf.message.includes('the terminal ghosts say hi'), 'wall: the signature rides in the body');
  ok(wf.message.includes(`— anonymous, from ${W.context}`), 'wall: the wall is the reported context');
}

/* ================================================================== *
   6. GOOD FIRST ISSUES PANEL
 * ================================================================== */
{
  const issues = C.sections.projects.issues;
  const items = [1, 2, 3, 4, 5, 6].map((i) => ({
    title: `fix thing number ${i}`,
    html_url: `https://github.com/issues/${i}`,
    repository_url: `https://api.github.com/repos/${C.meta.githubUser}/repo-${i}`,
  }));
  const listFill = (rec) => {
    const panel = rec.byId.get('content-view').children.get('#content-view :: .issues-panel');
    const list = panel.children.get(`${panel.__id} :: .issues-list`);
    const op = rec.ops.find((o) => o[0] === 'html' && o[1] === list.__id);
    return op ? op[2] : '';
  };

  /* fetch + cap */
  const a = makeRecorder({ hash: 'projects' });
  a.fetchBody = { items };
  run(a, 'main', OUT.new);
  await tick();
  ok(a.fetches.length === 1, 'issues: one search-API request');
  ok(a.fetches[0].url.includes(encodeURIComponent(`label:"good first issue" state:open user:${C.meta.githubUser}`)),
    'issues: the search query targets the user + label');
  const fill = listFill(a);
  ok(fill.includes('fix thing number 1') && fill.includes('fix thing number 5'), 'issues: the panel fills');
  ok(!fill.includes('fix thing number 6'), `issues: capped at ${issues.max}`);
  ok(!!a.store['issues-cache-v1'], 'issues: the cache is written');

  /* cache hit: no fetch on a fresh cache */
  const b = makeRecorder({ hash: 'projects' });
  b.store['issues-cache-v1'] = a.store['issues-cache-v1'];
  run(b, 'main', OUT.new);
  await tick();
  ok(b.fetches.length === 0, 'issues: a fresh cache serves without a request');
  ok(listFill(b).includes('fix thing number 1'), 'issues: the cache fills the panel');

  /* failure: the fallback line */
  const c = makeRecorder({ hash: 'projects' });
  c.fetchResult = { ok: false, status: 403 };
  run(c, 'main', OUT.new);
  await tick();
  ok(raw(c).includes(JSON.stringify(issues.fallback)), 'issues: a failed API shows the fallback line');
}

/* ================================================================== *
   7. VISIT DOORBELL
 * ================================================================== */
{
  const server = String(V.server).replace(/\/+$/, '');

  /* V1. a fresh browser that stays: one quiet ping after the delay */
  const postSlug = C.posts[0].slug;
  const a = makeRecorder({
    pathname: '/monologue/', params: `?p=${postSlug}`,
    referrer: 'https://www.google.com/search?q=thelinuxguy',
  });
  run(a, 'main', OUT.new);
  ok(a.fetches.length === 0, 'doorbell: nothing sends before the delay');
  ok(!!a.store['visit-pending-at'], 'doorbell: the visit is claimed at load (two tabs ring once)');
  ok(a.timers.length === 1 && a.timers[0].ms === V.delaySeconds * 1000, 'doorbell: the delay timer is scheduled');
  flushTimers(a);
  await tick();
  ok(a.fetches.length === 1, 'doorbell: exactly one ping once the visitor stayed');
  const f = a.fetches[0];
  ok(f.url === `${server}/`, 'doorbell: POST hits the server root');
  ok(f.opts.headers['Content-Type'] === 'application/json', 'doorbell: published as application/json');
  const fa = JSON.parse(f.opts.body);
  ok(fa.topic === V.topic, 'doorbell: payload carries the visits topic');
  ok(V.topic !== P.topic, 'doorbell: the visits channel is separate from the ping channel');
  ok(fa.title === V.title, 'doorbell: the quiet title is used');
  ok(fa.priority === V.priority, 'doorbell: the quiet priority rides along');
  ok(JSON.stringify(fa.tags) === JSON.stringify(V.tags.split(',').map((t) => t.trim())), 'doorbell: the bell tag rides along');
  ok(fa.message === `from google.com · ${V.landing} /monologue/?p=${postSlug}`,
    'doorbell: the referrer + landing page are reported');
  ok(fa.click === `${C.meta.url}/monologue/?p=${postSlug}`, 'doorbell: click opens the landing page');
  ok(!!a.store['visit-last-noticed-at'], 'doorbell: the browser is marked as noticed');

  /* V2. no referrer: a direct visit */
  const b = makeRecorder({ pathname: '/' });
  run(b, 'main', OUT.new);
  flushTimers(b);
  await tick();
  const fb = JSON.parse(b.fetches[0].opts.body);
  ok(fb.message === `${V.direct} · ${V.landing} /`, 'doorbell: a direct visit says so');

  /* V3. reload within the window: nothing, ever */
  const c = makeRecorder({ pathname: '/' });
  c.store['visit-last-noticed-at'] = String(Date.now());
  run(c, 'main', OUT.new);
  flushTimers(c);
  await tick();
  ok(c.fetches.length === 0, 'doorbell: a noticed browser stays silent (no reload/page-change spam)');

  /* V4. a bounce: the timer dies with the page, nothing sends */
  const d = makeRecorder({ pathname: '/' });
  run(d, 'main', OUT.new);
  ok(d.fetches.length === 0, 'doorbell: a visitor who leaves early never pings');

  /* V5. another tab claimed this visit */
  const e = makeRecorder({ pathname: '/' });
  e.store['visit-pending-at'] = String(Date.now());
  run(e, 'main', OUT.new);
  flushTimers(e);
  await tick();
  ok(e.fetches.length === 0, 'doorbell: a claimed visit rings once, not per tab');
}

/* ================================================================== *
   8. DISABLED FEATURES - exercised as real built code
 * ================================================================== */
{
  const off = makeRecorder({ pathname: '/' });
  run(off, 'main', OUT_PING_OFF);
  ok(off.bodyNodes.length === 0, 'disabled: no pill is built while ping.enabled is false');
  const miss = makeRecorder({ pathname: '/monologue/', params: '?p=missing' });
  run(miss, 'post', OUT_PING_OFF);
  const notFound = miss.ops.find((o) => o[0] === 'html' && o[1] === '#post');
  ok(!!notFound && !notFound[2].includes('ghost-report'), 'disabled: no ghost report while ping is off');

  const voff = makeRecorder({ pathname: '/' });
  run(voff, 'main', OUT_VISITS_OFF);
  flushTimers(voff);
  await tick();
  ok(voff.fetches.length === 0, 'disabled: no doorbell ping while visits.enabled is false');
  ok(!voff.store['visit-last-noticed-at'] && !voff.store['visit-pending-at'],
    'disabled: the doorbell stores nothing while off');
}

/* ================================================================== *
   9. STATIC ASSETS - the styles and build outputs exist
 * ================================================================== */
{
  const css = read(path.join(ROOT, 'assets', 'css', 'layout.css'));
  for (const sel of ['.ping-pop', '.ping-pill', '.ping-note', '.ping-quick', '.ping-send',
    '.wall-sign', '.wall-alias', '.wall-quote', '.wall-empty',
    '.issues-panel', '.issues-list', '.issues-fallback',
    '.ghost-report', '.ghost-line']) {
    ok(css.includes(sel), `css: ${sel} exists`);
  }
  for (const bundle of ['main.js', 'post.js', 'topic-page.js']) {
    ok(fs.existsSync(path.join(ROOT, 'assets', 'js', 'minified', bundle)), `build: minified/${bundle} exists`);
  }
}

/* ------------------------------------------------------------------ *
   Summary
 * ------------------------------------------------------------------ */
console.log('');
if (failures.length === 0) {
  console.log(`ALL CHECKS PASSED (${passes} gates, ${MODE})`);
} else {
  console.log(`${failures.length} FAILURE(S) (${MODE}):`);
  for (const f of failures) console.log(`  - ${f}`);
}
process.exit(failures.length === 0 ? 0 : 1);
