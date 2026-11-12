#!/usr/bin/env node
/**
 * Keeps a signature: adds one row to the wall (sections.wall.entries in
 * content.js) and rebuilds, so a liked ping becomes a wall row in one
 * command:
 *
 *   npm run wall -- "the alias" "the line they left"
 *   npm run wall -- "the line they left"            (alias: "anonymous")
 *
 * The newest row goes to the top of the list. Nothing is sent anywhere —
 * the row only exists in content.js once you run this; commit & push as
 * usual to publish it. Escaping of quotes/backslashes is handled here.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const contentPath = path.join(root, 'assets', 'js', 'content.js');

const args = process.argv.slice(2).map((a) => a.trim()).filter(Boolean);
let alias = 'anonymous';
let line = '';
if (args.length === 1) {
  line = args[0];
} else if (args.length >= 2) {
  alias = args[0] || 'anonymous';
  line = args[1];
} else {
  console.error('usage: npm run wall -- ["the alias"] "the line they left"');
  process.exit(1);
}

/* JS string literals: escape backslashes first, then single quotes. */
const esc = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

const src = fs.readFileSync(contentPath, 'utf8');
const anchor = src.match(/entries: \[\n/);
if (!anchor) {
  console.error('could not find "entries: [" in content.js — paste the row by hand (see README, recipe 7)');
  process.exit(1);
}
const row = `          { alias: '${esc(alias)}', line: '${esc(line)}' },\n`;
const next = src.slice(0, anchor.index + anchor[0].length) + row + src.slice(anchor.index + anchor[0].length);
fs.writeFileSync(contentPath, next);
console.log(`wall: kept "${alias}" — "${line}" (sections.wall.entries, newest first)`);

console.log('wall: rebuilding…');
execSync('npm run build', { cwd: root, stdio: 'inherit' });
console.log('wall: done — commit & push to publish it');
