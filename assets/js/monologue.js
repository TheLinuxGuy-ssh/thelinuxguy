/**
 * Renderer of the monologue page (monologue/index.html?p=<slug>).
 *
 * Reads everything from <code>content.js</code>:
 *   site.posts               -> the articles
 *   site.identity            -> the document title suffix
 *   site.pages.monologue     -> back link, title suffix, not-found screen
 *
 * The article body (`post.content`) is the author's own HTML and is
 * intentionally inserted as is.
 */

import { SITE_CONTENT } from './content.js';

const S = SITE_CONTENT;

/**
 * Renders the monologue page for the current `?p=` slug and sets the
 * document title. Called from entries/post.js.
 */
export function initMonologuePage() {
  const view = document.getElementById('post');
  const slug = new URLSearchParams(window.location.search).get('p');
  const post = S.posts.find((item) => item.slug === slug);
  const page = S.pages.monologue;

  if (!post) {
    document.title = page.notFound.title;
    view.innerHTML = `
      <a class="back-link" href="${page.errorHref}">${page.backLabel}</a>
      <h1 class="post-title">${page.notFound.heading}</h1>
      <p>${page.notFound.body}</p>`;
    return;
  }

  document.title = `${post.title}${page.titleSuffix}`;

  // The content is your own HTML, so it is inserted as is.
  view.innerHTML = `
    <a class="back-link" href="${page.backHref}">${page.backLabel}</a>
    <p class="post-meta"></p>
    <h1 class="post-title"></h1>
    <div class="post-body">${post.content}</div>`;

  view.querySelector('.post-meta').textContent = `${post.date} ${post.year}`;
  view.querySelector('.post-title').textContent = post.title;
}
