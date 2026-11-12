/**
 * Entry of the personal topic pages (topic/index.html?p=<slug>).
 *
 * One deferred script bundles the site content, the shared helpers and the
 * topic page renderer.
 */

import { syncIdentity, initPingButton, initVisitPing } from '../site.js';
import { initTopicPage } from '../topic.js';

// Keep the static header identity in sync with content.js.
syncIdentity();

// The bottom-right disturb-me pill (a no-op while ping.enabled is false).
initPingButton();

// The quiet visit doorbell (a no-op while visits.enabled is false).
initVisitPing();

// Render once the document is ready (see entries/main.js for the guard).
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTopicPage);
} else {
  initTopicPage();
}
