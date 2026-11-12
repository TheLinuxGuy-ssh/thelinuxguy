#!/usr/bin/env node
/**
 * Live end-to-end check for the ping widget against the REAL ntfy server.
 *
 * Runs the actual shipped (minified) bundles inside the same recording
 * fake-DOM fixture the offline harness uses — but with Node's real fetch,
 * which enforces the exact header rules a browser does. Every mode is
 * genuinely published to the configured topic, then the server's message
 * cache is polled to prove what a subscriber receives.
 *
 * Modes covered:
 *   1. quick ping on the home page
 *   2. typed note on the home page (cooldown fast-forwarded through the
 *      real unlock timer)
 *   3. wall signature (the wall tab)
 *   4. ghost report (monologue not-found page)
 *   5. the visit doorbell (one quiet ping to its own topic, plus the
 *      silence of an already-noticed browser)
 * plus a deliberate invalid-topic probe — the only failure the real
 * server can be asked to produce without abusing anyone's quota.
 *
 * Usage: npm run ping-test   (drives the bundles that ship, so run
 * `npm run build` first if content.js changed)
 */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(here, '..');
const read = (p) => fs.readFileSync(p, 'utf8');

/* content.js is an ES module but the package has no "type": "module", so
 * plain import() would misparse it — evaluate it instead and grab the
 * global it declares. Expectations always come from the LIVE content so
 * the test survives content edits. */
const contentSrc = read(path.join(ROOT, 'assets', 'js', 'content.js'))
  .replace(/^export /gm, '')
  + '\n;globalThis.SITE_CONTENT = SITE_CONTENT;';
const contentCtx = { console };
vm.createContext(contentCtx);
vm.runInContext(contentSrc, contentCtx, { filename: 'content.js' });
const C = contentCtx.SITE_CONTENT;
const P = C.ping;
const W = C.sections.wall;
const server = String(P.server).replace(/\/+$/, '');
const stamp = () => new Date().toISOString().replace(/[-:]/g, '').slice(0, 14);

/* ------------------- fake DOM (harness fixture shape) ------------------- */
class El {
  constructor(rec, id) {
    this.__rec = rec;
    this.__id = id;
    this.__text = '';
    this.__attrs = new Map();
    this.dataset = {};
    this.value = '';
    this.disabled = false;
    this.handlers = new Map();
    this.children = new Map();
  }
  get textContent() { return this.__text; }
  set textContent(v) { this.__text = v; }
  set innerHTML(v) { this.__rec.ops.push(['html', this.__id, v]); }
  get classList() {
    return { toggle() {}, add() {}, remove() {} };
  }
  setAttribute(k, v) { this.__attrs.set(k, v); }
  removeAttribute(k) { this.__attrs.delete(k); }
  getAttribute(k) { return this.__attrs.has(k) ? this.__attrs.get(k) : null; }
  hasAttribute(k) { return this.__attrs.has(k); }
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
}

const NAV_TARGETS = ['about', 'monologues', 'projects', 'personal', 'contact', 'wall'];

function makeSandbox({ params = '', hash = '', pathname = '/', referrer = '' } = {}) {
  const rec = {
    ops: [], byId: new Map(), bodyNodes: [], navLinks: [],
    fetches: [], responses: [], inflight: [], store: {}, timers: [],
    location: {
      origin: C.meta.url,
      search: params,
      pathname,
      _hash: hash,
      get hash() { return `#${this._hash}`.replace(/^#$/, ''); },
      get href() { return `${this.origin}${this.pathname}${this.search}${this.hash}`; },
      set hash(v) { this._hash = String(v).replace(/^#/, ''); },
    },
  };
  rec.document = {
    readyState: 'interactive',
    referrer,
    title_: '',
    get title() { return this.title_; },
    set title(v) { this.title_ = v; },
    addEventListener() {},
    getElementById(id) {
      if (!rec.byId.has(id)) rec.byId.set(id, new El(rec, `#${id}`));
      return rec.byId.get(id);
    },
    querySelector(sel) {
      if (sel === '.nav' || sel === '.skip-link') return new El(rec, sel);
      const syncSel = ['.me', '.badge', ...NAV_TARGETS.map((t) => `.nav a[data-target="${t}"]`)];
      if (syncSel.includes(sel)) return new El(rec, `sync${sel}`);
      return null;
    },
    querySelectorAll(sel) {
      if (sel === '.nav a[data-target]') return rec.navLinks;
      return [];
    },
    head: { querySelector: () => null, appendChild() {} },
    body: { appendChild: (n) => rec.bodyNodes.push(n) },
    createElement: (tag) => new El(rec, `created:${tag}`),
    activeElement: null,
  };
  rec.window = {
    location: rec.location,
    addEventListener() {},
  };
  for (const target of NAV_TARGETS) {
    const link = new El(rec, `nav:${target}`);
    link.dataset.target = target;
    rec.navLinks.push(link);
  }
  const sandbox = {
    document: rec.document,
    window: rec.window,
    console,
    URLSearchParams,
    URL,
    localStorage: {
      getItem: (k) => (k in rec.store ? rec.store[k] : null),
      setItem: (k, v) => { rec.store[k] = String(v); },
    },
    setTimeout: (fn) => { rec.timers.push(fn); return rec.timers.length; },
    /* Real fetch: same ByteString header validation as a browser. Each
     * fetch record keeps the response it produced, so scenarios can pick
     * their send by content instead of by index (other recorded timers,
     * like the doorbell's, may fire in between). */
    fetch: (url, opts) => {
      const record = { url, opts, res: null };
      rec.fetches.push(record);
      const p = fetch(url, opts);
      const capture = p
        .then(async (r) => {
          const entry = { ok: r.ok, status: r.status };
          if (r.ok) { try { entry.body = await r.clone().json(); } catch { /* no body */ } }
          record.res = entry;
          rec.responses.push(entry);
        })
        .catch((e) => {
          record.res = { ok: false, error: String(e) };
          rec.responses.push(record.res);
        });
      rec.inflight.push(p, capture);
      return p;
    },
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  rec.sandbox = sandbox;
  return rec;
}

const run = (rec, kind) => {
  vm.runInContext(
    read(path.join(ROOT, 'assets', 'js', 'minified', `${kind}.js`)),
    rec.sandbox,
    { filename: `${kind}.js` }
  );
};
const settle = async (rec) => {
  await Promise.allSettled(rec.inflight);
  await new Promise((r) => setImmediate(r));
};
/* Runs pending timers (the real unlock path) so the cooldown never stalls
 * the test — sending stays 100% real, waiting 30s does not. */
const flushTimers = (rec) => {
  for (const fn of rec.timers.splice(0)) fn();
};
const widget = (rec) => {
  const root = rec.bodyNodes[0];
  const htmlOp = rec.ops.find((o) => o[0] === 'html' && o[1] === 'created:div');
  const w = {
    pill: root.querySelector('.ping-pill'),
    pop: root.querySelector('.ping-pop'),
    note: root.querySelector('.ping-note'),
    quick: root.querySelector('.ping-quick'),
    send: root.querySelector('.ping-send'),
  };
  /* The fake DOM does not parse HTML strings, so mirror the shipped
   * markup's initial state (harness does the same): the send button
   * starts disabled and the popover starts hidden. */
  if (w.send && htmlOp && htmlOp[2].includes('class="ping-send" disabled')) {
    w.send.disabled = true;
  }
  if (w.pop && htmlOp && htmlOp[2].includes('class="ping-pop" hidden')) {
    w.pop.__attrs.set('hidden', '');
  }
  return w;
};
const fire = (el, type, ev = {}) => {
  const f = el.handlers.get(type);
  if (f) f(ev);
  return !!f;
};
/* Picks a recorded send by what its payload says — index-free, so other
 * recorded timers firing between sends cannot shift the lookup. */
const sendOf = (rec, match) => {
  for (const f of rec.fetches) {
    try {
      const body = JSON.parse(f.opts.body);
      if (match(body)) return { sent: body, res: f.res || {} };
    } catch { /* not a JSON publish */ }
  }
  return { sent: null, res: {} };
};

/* --------------------------------- checks -------------------------------- */
const results = [];
const check = (name, cond, detail = '') => {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

/* 1. quick ping on the home page */
const home = makeSandbox({});
run(home, 'main');
const w = widget(home);
check('pill + card built on the home page', !!w.pill && !!w.quick);
fire(w.pill, 'click', { stopPropagation() {} });
check('card opens with the note box focused',
  home.ops.some((o) => o[0] === 'focus' && o[1] === 'created:div :: .ping-note'));
fire(w.quick, 'click');
await settle(home);
const { sent: quickSent, res: quickRes } = sendOf(home, (b) => b.message?.includes(P.quickBody));
check('quick ping → HTTP 200', quickRes.ok === true, `status ${quickRes.status ?? 'n/a'}`);
check('quick ping posts to the server root', home.fetches[0]?.url === `${server}/`, home.fetches[0]?.url);
check('quick ping payload (topic/title/tags/click/message)', !!quickSent
  && quickSent.topic === P.topic
  && quickSent.title === P.notifyTitle
  && JSON.stringify(quickSent.tags) === JSON.stringify(P.tags.split(',').map((t) => t.trim()))
  && quickSent.click === `${C.meta.url}/`
  && quickSent.message.includes(P.quickBody)
  && quickSent.message.includes(`— anonymous, from ${P.labels.homeContext}`));
check('pill shows the sent label', w.pill.textContent === P.labels.sent, w.pill.textContent);

/* 2. typed note on the home page */
flushTimers(home);
const noteText = `live test note ${stamp()}`;
fire(w.pill, 'click', { stopPropagation() {} });
w.note.value = noteText;
fire(w.note, 'input');
fire(w.send, 'click');
await settle(home);
const { sent: noteSent, res: noteRes } = sendOf(home, (b) => b.message?.startsWith(noteText));
check('note send → HTTP 200', noteRes.ok === true, `status ${noteRes.status ?? 'n/a'}`);
check('note payload (text leads, footer, exact click)', !!noteSent
  && noteSent.topic === P.topic
  && noteSent.message.startsWith(noteText)
  && noteSent.message.includes(`— anonymous, from ${P.labels.homeContext}`)
  && noteSent.click === `${C.meta.url}/`
  && noteSent.title === P.notifyTitle);

/* 3. wall signature on the wall tab */
const wallRec = makeSandbox({ hash: 'wall' });
run(wallRec, 'main');
const wv = widget(wallRec);
const sign = wallRec.byId.get('content-view').querySelector('.wall-sign');
fire(sign, 'click', { stopPropagation() {} });
const wallLine = `live test wall signature ${stamp()}`;
wv.note.value = wallLine;
fire(wv.note, 'input');
fire(wv.send, 'click');
await settle(wallRec);
const { sent: wallSent, res: wallRes } = sendOf(wallRec, (b) => b.message?.includes(wallLine));
check('wall signature → HTTP 200', wallRes.ok === true, `status ${wallRes.status ?? 'n/a'}`);
check('wall payload (wall title/tag/context)', !!wallSent
  && wallSent.topic === P.topic
  && wallSent.title === W.pingTitle
  && JSON.stringify(wallSent.tags) === JSON.stringify([W.pingTag])
  && wallSent.message === `${wallLine}\n— anonymous, from ${W.context}`);

/* 4. ghost report on a dead monologue URL */
const ghostRec = makeSandbox({ pathname: '/monologue/', params: '?p=missing' });
run(ghostRec, 'post');
const gbtn = ghostRec.byId.get('post').querySelector('.ghost-report');
fire(gbtn, 'click', { stopPropagation() {} });
const gv = widget(ghostRec);
fire(gv.send, 'click');
await settle(ghostRec);
const { sent: ghostSent, res: ghostRes } = sendOf(ghostRec, (b) => b.title === P.ghost.title);
const ghostHref = `${C.meta.url}/monologue/?p=missing`;
check('ghost report → HTTP 200', ghostRes.ok === true, `status ${ghostRes.status ?? 'n/a'}`);
check('ghost payload (ghost title/tag/dead URL prefill)', !!ghostSent
  && ghostSent.topic === P.topic
  && ghostSent.title === P.ghost.title
  && JSON.stringify(ghostSent.tags) === JSON.stringify([P.ghost.tag])
  && ghostSent.message.startsWith(`${P.ghost.note}${ghostHref}`)
  && ghostSent.message.includes('— anonymous, from monologue: missing'));

/* 5. the visit doorbell: a fresh browser (from google) that sticks around */
const V = C.visits;
const doorRec = makeSandbox({ referrer: 'https://www.google.com/' });
run(doorRec, 'main');
check('doorbell: nothing sends before the delay', doorRec.fetches.length === 0);
check('doorbell: the visit is claimed at load (two tabs ring once)', !!doorRec.store['visit-pending-at']);
flushTimers(doorRec);
await settle(doorRec);
const { sent: doorSent, res: doorRes } = sendOf(doorRec, (b) => b.topic === V.topic);
check('doorbell → HTTP 200', doorRes.ok === true, `status ${doorRes.status ?? 'n/a'}`);
check('doorbell payload (quiet priority, separate channel)', !!doorSent
  && doorSent.topic === V.topic
  && V.topic !== P.topic
  && doorSent.title === V.title
  && doorSent.priority === V.priority
  && JSON.stringify(doorSent.tags) === JSON.stringify(V.tags.split(',').map((t) => t.trim()))
  && doorSent.message === `from google.com · ${V.landing} /`
  && doorSent.click === `${C.meta.url}/`);
check('doorbell marks the browser as noticed', !!doorRec.store['visit-last-noticed-at']);

/* 6. a noticed browser (within the window) never re-pings */
const again = makeSandbox({});
again.store['visit-last-noticed-at'] = String(Date.now());
run(again, 'main');
flushTimers(again);
await settle(again);
check('doorbell: a noticed browser stays silent (no reload/page-change spam)', again.fetches.length === 0);

/* 7. the one failure the real server can be asked for safely: an invalid
 * topic name (>64 chars). Proves ntfy answers rejections with non-2xx —
 * which the widget turns into the visible "didn't go through" state
 * (gated offline by the harness). */
const badRes = await fetch(`${server}/`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ topic: 'x'.repeat(80), message: 'probe' }),
});
check('invalid topic is rejected with a visible non-2xx', !badRes.ok, `status ${badRes.status}`);

/* 8. poll the server caches: exactly what a subscriber receives. The
 * windows are generous and the lookups are retried — ntfy's cache can lag
 * a few seconds behind a fresh publish — but the match is by exact message
 * id from each send's own response, so no false positives are possible. */
const cases = [
  ['quick ping', quickSent, quickRes],
  ['note send', noteSent, noteRes],
  ['wall signature', wallSent, wallRes],
  ['ghost report', ghostSent, ghostRes],
];
let cached = [];
for (let attempt = 0; attempt < 4; attempt += 1) {
  const poll = await fetch(`${server}/${P.topic}/json?poll=1&since=30m`);
  cached = (await poll.text()).trim().split('\n').filter(Boolean)
    .map((l) => JSON.parse(l))
    .filter((m) => m.event === 'message');
  const allLanded = cases.every(([, , res]) => res.body?.id
    && cached.some((m) => m.id === res.body.id));
  if (allLanded) break;
  if (attempt < 3) await new Promise((r) => setTimeout(r, 2000));
}
if (process.env.PING_LIVE_DEBUG) {
  console.log('DEBUG response ids:', JSON.stringify(cases.map(([, , res]) => res.body?.id)));
  console.log('DEBUG cached ids:', JSON.stringify(cached.map((m) => m.id)));
}
for (const [name, sent, res] of cases) {
  const got = cached.find((m) => m.id === res.body?.id);
  check(`${name} lands in the topic cache intact`, !!got
    && got.title === sent?.title
    && JSON.stringify(got.tags) === JSON.stringify(sent?.tags)
    && got.click === sent?.click
    && got.message === sent?.message,
  got ? `id ${got.id}` : 'not found');
}

/* the doorbell has its own channel — poll that topic too */
let doorGot = null;
for (let attempt = 0; attempt < 4 && !doorGot; attempt += 1) {
  const doorPoll = await fetch(`${server}/${V.topic}/json?poll=1&since=30m`);
  const doorCached = (await doorPoll.text()).trim().split('\n').filter(Boolean)
    .map((l) => JSON.parse(l))
    .filter((m) => m.event === 'message');
  doorGot = doorCached.find((m) => m.id === doorRes.body?.id) || null;
  if (!doorGot && attempt < 3) await new Promise((r) => setTimeout(r, 2000));
}
check('doorbell lands in the visits topic cache intact', !!doorGot
  && doorGot.title === doorSent?.title
  && JSON.stringify(doorGot.tags) === JSON.stringify(doorSent?.tags)
  && doorGot.click === doorSent?.click
  && doorGot.message === doorSent?.message,
doorGot ? `id ${doorGot.id}` : 'not found');

/* --------------------------------- summary ------------------------------- */
const failed = results.filter((r) => !r.ok);
console.log('');
if (failed.length === 0) {
  console.log(`ALL ${results.length} LIVE CHECKS PASSED — the server confirmed every mode.`);
  console.log(`Real pings arrive on ${server}/${P.topic}, quiet visit notices on ${server}/${V.topic} —`);
  console.log('subscribe to both in the ntfy app. If your phone stays silent, check the topic');
  console.log('subscriptions there (and on Android, disable battery optimization for ntfy).');
} else {
  console.log(`${failed.length} of ${results.length} LIVE CHECKS FAILED`);
}
process.exit(failed.length === 0 ? 0 : 1);
