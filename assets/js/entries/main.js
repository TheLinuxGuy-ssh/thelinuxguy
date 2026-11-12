/**
 * Entry of the main page (index.html).
 *
 * One deferred script is shipped for this page; it bundles the site content,
 * the shared helpers and the main page renderer, in load order:
 */

import { syncIdentity, syncNavigation, initPingButton, initVisitPing } from '../site.js';
import { initMainPage } from '../script.js';

// Keep the static header identity and nav labels in sync with content.js.
syncIdentity();
syncNavigation();

// The bottom-right disturb-me pill (a no-op while ping.enabled is false).
initPingButton();

// The quiet visit doorbell (a no-op while visits.enabled is false).
initVisitPing();

// Render once the document is ready. Deferred scripts run just before
// DOMContentLoaded, but the guard keeps the flow correct even if the script
// is ever loaded un-deferred.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMainPage);
} else {
  initMainPage();
}
