#!/usr/bin/env node
/**
 * Build script for the site.
 *
 *  1. Bundles the three page entry points with esbuild — the exact same
 *     flags the old CLI-only build used (--bundle --minify --outdir).
 *  2. Generates the Open Graph card image, `assets/media/og-image.png`,
 *     straight from the user's own data in assets/js/content.js:
 *     meta.description + identity badge/name + meta.favicon (the logo).
 *     Hand-made og images go stale; this one can never drift from content.
 *
 * OG rasterizer ladder (first tool that exists AND renders exactly wins):
 *   rsvg-convert | magick | inkscape   -> direct 1200x630 render
 *   qlmanage (macOS, always present)   -> renders a padded 1200x1200
 *                                         square, center-cropped to
 *                                         1200x630 with sips afterwards
 *                                        (qlmanage "slice"-crops anything
 *                                         that is not square, so we pad)
 * If no rasterizer succeeds and a previous og-image.png exists, the old
 * file is kept and the build continues with a warning; otherwise it fails.
 *
 * PNG sizes are read straight from the IHDR header — no imaging deps.
 */
import { build as esbuild } from 'esbuild';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(import.meta.dirname, '..');
const OG_W = 1200;              // OG canvas width  (index.html og:image:width)
const OG_H = 630;               // OG canvas height (index.html og:image:height)
const OUT = path.join(ROOT, 'assets/media/og-image.png');

/* ------------------------------------------------------------------ *
 * Content loading (no bundler needed — content.js has no imports).
 * ------------------------------------------------------------------ */
function loadContent() {
  const src = fs
    .readFileSync(path.join(ROOT, 'assets/js/content.js'), 'utf8')
    .replace('export const SITE_CONTENT', 'const SITE_CONTENT');
  const sandbox = { console };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(`${src}\n;globalThis.__C = SITE_CONTENT;`, sandbox, { filename: 'content.js' });
  return sandbox.globalThis.__C;
}

/* ------------------------------------------------------------------ *
 * 1. JS bundles (same output as the previous esbuild CLI line).
 * ------------------------------------------------------------------ */
async function bundle() {
  await esbuild({
    entryPoints: [
      'assets/js/entries/main.js',
      'assets/js/entries/post.js',
      'assets/js/entries/topic-page.js',
    ].map((p) => path.join(ROOT, p)),
    bundle: true,
    minify: true,
    outdir: path.join(ROOT, 'assets/js/minified'),
    logLevel: 'info',
  });
}

/* ------------------------------------------------------------------ *
 * 2. OG image.
 * ------------------------------------------------------------------ */
const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Naive word wrap — conservative because there is no text measuring here. */
function wrap(text, maxChars) {
  const lines = [];
  for (const raw of String(text).split('\n')) {
    let line = '';
    for (const word of raw.split(' ')) {
      if (line && `${line} ${word}`.length > maxChars) {
        lines.push(line);
        line = word;
      } else {
        line = line ? `${line} ${word}` : word;
      }
    }
    if (line || raw === '') lines.push(line);
  }
  return lines;
}

/** Which executables exist on PATH? */
function which(bin) {
  try {
    execFileSync('sh', ['-c', `command -v ${bin}`], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/** Convert a WebP logo to PNG bytes (data URIs embed best as PNG). */
function faviconBytes(file) {
  for (const tool of [
    { bin: 'sips', argv: (out) => ['-s', 'format', 'png', '-Z', '256', file, '--out', out] },
    { bin: 'magick', argv: (out) => [file, '-background', 'none', out] },
  ]) {
    if (!which(tool.bin)) continue;
    const out = path.join(TMPDIR, 'favicon.png');
    try {
      execFileSync(tool.bin, tool.argv(out), { stdio: 'pipe' });
      console.log(`og: logo converted for embedding via ${tool.bin}`);
      return { bytes: fs.readFileSync(out), mime: 'image/png' };
    } catch (e) {
      console.warn(`og: ${tool.bin} logo conversion failed — trying next (${e.message.split('\n')[0]})`);
    }
  }
  // Last resort: embed the raw webp. WebKit-based renderers (qlmanage)
  // handle it fine; rsvg/magick may ignore it — warned either way.
  console.warn('og: no webp->png tool found, embedding raw webp logo');
  return { bytes: fs.readFileSync(file), mime: 'image/webp' };
}

/**
 * The card design, drawn in the site's own visual language (white, ink,
 * double border) at the declared OG ratio. When the canvas is a padded
 * square (qlmanage needs it) the design band is centered vertically.
 */
function ogSvg({ badge, name, description, url, logo }, canvasH = OG_H) {
  const ink = '#161616';                  // single design for any canvas height:
  const y0 = (canvasH - OG_H) / 2;        // 0 for the direct 630 canvas, 285
                                          // for the qlmanage padded square

  // Auto-shrink the headline only if a very long badge would overflow.
  const badgeSize = Math.min(84, Math.floor(760 / (0.62 * badge.length)));

  const descLines = wrap(description, 60);

  // Baselines (local within the 630 band, then + y0):
  //   logo 170..370 | badge 245 | name 300 | desc 352+i*40 | site url 560
  const parts = [
    `<rect width="1200" height="${canvasH}" fill="#ffffff"/>`,
    `<rect x="8" y="${y0 + 8}" width="${OG_W - 16}" height="${OG_H - 16}" fill="none" stroke="${ink}" stroke-width="4"/>`,
    `<rect x="20" y="${y0 + 20}" width="${OG_W - 40}" height="${OG_H - 40}" fill="none" stroke="${ink}" stroke-width="2"/>`,
    `<image x="96" y="${y0 + 170}" width="200" height="200" href="${logo.uri}" ${logo.mime === 'image/png' ? '' : 'preserveAspectRatio="xMidYMid meet"'}/>`,
    `<text x="352" y="${y0 + 245}" font-family="Helvetica, Arial, sans-serif" font-size="${badgeSize}" font-weight="bold" fill="${ink}">${esc(badge)}</text>`,
    `<text x="352" y="${y0 + 300}" font-family="Helvetica, Arial, sans-serif" font-size="34" fill="${ink}">${esc(name)}</text>`,
  ];
  descLines.forEach((line, i) => {
    parts.push(
      `<text x="352" y="${y0 + 352 + i * 40}" font-family="Helvetica, Arial, sans-serif" font-size="26" fill="${ink}">${esc(line)}</text>`
    );
  });
  parts.push(
    `<text x="352" y="${y0 + 560}" font-family="Helvetica, Arial, sans-serif" font-size="20" font-weight="bold" letter-spacing="2" fill="${ink}">${esc(url)}</text>`
  );

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="${canvasH}" viewBox="0 0 1200 ${canvasH}">
  ${parts.join('\n  ')}
</svg>\n`;
}

function pngSize(buf) {
  // PNG IHDR: width at byte 16, height at byte 20 (big endian).
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

let TMPDIR = '';

/** Rasterize + verify. Returns the final PNG bytes at exactly OG_WxOG_H. */
function rasterize(svgDirect, svgSquare) {
  // Each entry: how to run, which svg it wants, and whether a sips crop
  // is needed afterwards (only the qlmanage square route).
  const ladder = [
    { bin: 'rsvg-convert', input: svgDirect, file: 'og.svg', argv: (svg, out) => ['-w', String(OG_W), '-h', String(OG_H), '-o', out, svg], crop: false, find: (dir) => path.join(dir, 'out.png') },
    { bin: 'magick', input: svgDirect, file: 'og.svg', argv: (svg, out) => [svg, '-resize', `${OG_W}x${OG_H}!`, '-background', 'white', '-flatten', out], crop: false, find: (dir) => path.join(dir, 'out.png') },
    { bin: 'inkscape', input: svgDirect, file: 'og.svg', argv: (svg, out) => [svg, '-w', String(OG_W), '-h', String(OG_H), '-o', out], crop: false, find: (dir) => path.join(dir, 'out.png') },
    { bin: 'qlmanage', input: svgSquare, file: 'og.svg', argv: (svg, dir) => ['-t', '-s', '1200', '-o', dir, svg], crop: true, find: (dir) => path.join(dir, 'og.svg.png') },
  ];

  for (const step of ladder) {
    if (!which(step.bin)) continue;
    const svgFile = path.join(TMPDIR, step.file);
    fs.writeFileSync(svgFile, step.input);
    try {
      const outArg = path.join(TMPDIR, 'out.png');
      execFileSync(step.bin, step.argv(svgFile, step.crop ? TMPDIR : outArg), { stdio: 'pipe' });
      let buf = fs.readFileSync(step.find(TMPDIR));
      if (step.crop) {
        // Center-crop the padded square down to the real OG ratio.
        const cropped = path.join(TMPDIR, 'cropped.png');
        execFileSync('sips', ['-c', String(OG_H), String(OG_W), step.find(TMPDIR), '--out', cropped], { stdio: 'pipe' });
        buf = fs.readFileSync(cropped);
      }
      const { width, height } = pngSize(buf);
      if (width === OG_W && height === OG_H) {
        console.log(`og: rendered ${OG_W}x${OG_H} via ${step.bin}`);
        return buf;
      }
      console.warn(`og: ${step.bin} rendered ${width}x${height}, expected ${OG_W}x${OG_H} — trying next tool`);
    } catch (e) {
      console.warn(`og: ${step.bin} failed — trying next tool (${e.message.split('\n')[0]})`);
    }
  }
  return null;
}

async function generateOg() {
  const C = loadContent();
  const source = C.meta.favicon || 'favicon.webp';
  const logoFile = path.join(ROOT, source);
  if (!fs.existsSync(logoFile)) {
    throw new Error(`og: meta.favicon points at "${source}" but the file is missing`);
  }

  const logoRaw = faviconBytes(logoFile);
  const logo = {
    uri: `data:${logoRaw.mime};base64,${logoRaw.bytes.toString('base64')}`,
    mime: logoRaw.mime,
  };

  const ogData = {
    badge: C.identity.badge,
    name: C.identity.name,
    description: C.meta.description || '',
    url: C.meta.url.replace(/^https?:\/\//, ''),
    logo,
  };
  const svgDirect = ogSvg(ogData, OG_H);   // exact 1200x630 canvas
  const svgSquare = ogSvg(ogData, 1200);   // padded square for qlmanage

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const png = rasterize(svgDirect, svgSquare);
  if (png) {
    fs.writeFileSync(OUT, png);
    console.log(`og: wrote assets/media/og-image.png (${(png.length / 1024).toFixed(1)} KB)`);
    return;
  }
  if (fs.existsSync(OUT)) {
    console.warn(`og: no rasterizer worked — keeping the existing og-image.png`);
    return;
  }
  throw new Error('og: no rasterizer available (rsvg-convert/magick/inkscape/qlmanage) and no existing og-image.png');
}

/* ------------------------------------------------------------------ */

let failed = false;
try {
  TMPDIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tlg-og-'));
  await bundle();
  await generateOg();
} catch (e) {
  failed = true;
  console.error(e);
} finally {
  fs.rmSync(TMPDIR, { recursive: true, force: true });
}
process.exitCode = failed ? 1 : 0;
