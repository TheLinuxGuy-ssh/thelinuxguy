/**
 * Entry of the personal topic pages (topic/index.html?p=<slug>).
 *
 * One deferred script bundles the site content, the shared helpers and the
 * topic page renderer.
 */

import { syncIdentity } from '../site.js';
import { initTopicPage } from '../topic.js';

// Keep the static header identity in sync with content.js.
syncIdentity();

// Render once the document is ready (see entries/main.js for the guard).
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTopicPage);
} else {
  initTopicPage();
}
