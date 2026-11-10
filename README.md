# TheLinuxGuy — Portfolio Site

Static, framework-free personal site. No backend, no client framework: HTML shell + plain JavaScript renderers + **one content file**.

## The single source of truth

**`assets/js/content.js` is the *only* place where the website's content lives.**
Every word, link, project, stat, monologue and personal topic that is rendered on any page is read from the single `SITE_CONTENT` object in that file. The renderer files contain structure and behaviour only — zero copy.

| Page | Renderer | Reads from `content.js` |
|---|---|---|
| `index.html` (5 tabs) | `assets/js/script.js` | `identity`, `navigation`, `sections.*`, `posts`, `projects`, `personal`, `labels` |
| `monologue/index.html?p=slug` | `assets/js/monologue.js` | `meta`, `identity`, `posts`, `pages.monologue` |
| `topic/index.html?p=slug` | `assets/js/topic.js` | `meta`, `identity`, `topics`, `pages.topic` |

Shared helpers (escaping, SEO meta injection, identity sync) live in `assets/js/site.js`.

Each page ships **one deferred, minified bundle** built by esbuild:

```
assets/js/content.js      ← EDIT CONTENT HERE
   │
   ├── entries/main.js        →  minified/main.js         (index.html)
   ├── entries/post.js        →  minified/post.js         (monologue page)
   └── entries/topic-page.js  →  minified/topic-page.js   (topic pages)
```

## Editing a recipe

### 1. Add a project (Projects tab)
Append an object to `SITE_CONTENT.projects`:
```js
{ name: 'Project name',        // plain text (escaped)
  type: 'Web Application',     // the small uppercase tag on the card
  desc: 'What it does.',       // plain text (escaped)
  url: 'https://…',            // optional → adds "Website →"
  github: 'repo-name' }        // optional → adds "Source code →"
```
A bare `github` value expands against `meta.githubUser`; pass a full URL to link any host.

### 2. Add a monologue (Monologues tab + its own page)
Append to `SITE_CONTENT.posts`:
```js
{ id: 2, slug: 'my-post',            // used in monologue/index.html?p=my-post
  title: 'The title',                // card + page + <title> (escaped)
  preview: 'Teaser paragraph.',      // card copy (escaped)
  content: '<p>…full HTML body…</p>' // your own HTML, kept on one line
  tags: [{ name: 'Ai', accent: '#ffffff' }],
  year: '2026', date: '21 APRIL' }
```
Inside `content`, the supported emphasis classes are `.important`, `.highlight`, `.beware` (styled at the bottom of `layout.css`).

### 3. Add a personal item **and** its topic page
Details pages are looked up by slug, so an item needs **both** entries, in sync:

1. `SITE_CONTENT.personal` → `{ title: 'Chess', note: '…text…' }`
   (`title` is also what generates the URL slug, e.g. `?p=chess`; the `note`
   is written **once** here — it shows on the card *and* as the topic
   page's lead paragraph, fetched automatically by slug.)
2. `SITE_CONTENT.topics` → page entry with the matching `slug: 'chess'` and
   `blocks` = your image slots. Extra `heading` / `text` / `links` blocks
   are supported by the renderer whenever you want them. Set an explicit
   `summary` on the topic only if the lead should differ from the note.

The pages below carry only image slots. **Hide / reveal them:**
`meta.showTopicImages` in content.js — `false` keeps every slot in the data
but draws nothing, **and hides the Personal cards' View buttons too** (with
no images the pages would only repeat the card's note). Topic social cards
fall back to the generated site card as well. Flip to `true` and run
`npm run build` when your real files are in place — View comes back with
the images.

A personal item without a matching topic shows the "Page not found." screen.
The strings of that screen live in `pages.topic.notFound` / `pages.monologue.notFound`.

**Images:** topic images point at `assets/img/personal/<slug>/` — real files
ship there as labelled placeholder SVGs. To use your own, drop the file at
the exact same path (any raster format works) and update the extension in
the path if it changed. Nothing else to touch.

### 4. About stats, facts, contact links, nav order
`sections.about.stats`, `sections.about.facts`, `sections.contact.links` and
`navigation` — each is a small self-documenting array; edit in place.
Keyboard order (1–5, j/k, Home/End) follows the `navigation` order.

### 5. Rebuild (required after every content edit)
```bash
npm run build    # scripts/build.mjs — two jobs:
                 #   1. regenerates assets/js/minified/*.js (esbuild)
                 #   2. regenerates assets/media/og-image.png from content.js
```
The pages load the **minified** bundles only, so an edit without a rebuild is
not visible on the deployed site.

The OG card (1200×630, `assets/media/og-image.png`) is **generated, never
hand-made**: the build draws it from your own data — `meta.description`,
`identity.badge` / `identity.name`, your logo (`meta.favicon`, currently the
optimised `favicon.webp` you switched to) and prints `meta.url` at the bottom.
Edit those in content.js, rebuild, and the card follows. The rasterizer ladder
prefers `rsvg-convert` / `magick` / `inkscape`; on a plain macOS box it falls
back to the native `qlmanage` + `sips` pair, so no extra installs are needed.
Both index.html and the topic-page OG fallback point at that same file.

## What is intentionally *not* in content.js

The `<head>` of each HTML file (`<title>`, meta description, Open Graph and
Twitter tags, JSON-LD) is static HTML so crawlers get it without executing
scripts. Those mirror `meta` / `identity` values — `meta.description`,
`meta.favicon` and the OG image path unified at
`/assets/media/og-image.png` — keep the static tags in sync by hand when you
rename something. The topic page injects its *own* head tags at runtime from
content.js (`site.meta.url`, `site.topics[].summary`, and each topic's first
image as its own og:image card, falling back to the generated site card).

## Performance notes

- One script request per page, `defer`red → non-blocking, cacheable.
- esbuild bundling tree-shakes unused exports; bundles are gzip-friendly.
- The favicon is a small WebP (`favicon.webp`) instead of a heavy SVG, and the
  OG card is a static PNG generated at build time (~107 KB, flat design) —
  crawlers get it without executing any script.
- Topic images render `loading="lazy"` and can declare `width`/`height` to
  avoid layout shifts.
- No framework runtime, no CSS build step, no fonts to fetch.

## Files

```
index.html               main page shell (nav + renderview)
monologue/index.html     article page shell
topic/index.html         personal-topic page shell
assets/js/content.js     ★ ALL content — edit everything here
assets/js/site.js        shared helpers (escape, meta, identity sync)
assets/js/script.js      main page renderer + router/keyboard nav
assets/js/monologue.js   article renderer
assets/js/topic.js       topic renderer + per-topic SEO injection
assets/js/entries/       the three per-page entry points (bundled)
assets/js/minified/      build output loaded by the pages (do not edit)
assets/css/layout.css    single stylesheet (structure only, no content)
favicon.webp · sitemap.xml · robots.txt
```
