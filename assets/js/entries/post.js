/**
 * Entry of the monologue page (monologue/index.html?p=<slug>).
 *
 * One deferred script bundles the site content, the shared helpers and the
 * monologue page renderer.
 */

import { syncIdentity } from '../site.js';
import { initMonologuePage } from '../monologue.js';

// Keep the static header identity in sync with content.js.
syncIdentity();

// Render once the document is ready (see entries/main.js for the guard).
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMonologuePage);
} else {
  initMonologuePage();
}
