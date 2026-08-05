/* Scarcinality — "do you like this" control.
   Self-contained: injects its own styles so it works on the curiosity pages
   that do not link /assets/style.css. State is per-visitor in localStorage;
   the aggregate signal goes to Google Analytics as a 'like_page' event. */
(function () {
  if (window.__scarcLike) return;
  window.__scarcLike = true;

  var CSS =
    '.scarc-like{display:inline-flex;align-items:center;gap:.4rem;' +
    'font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:.62rem;' +
    'letter-spacing:.1em;text-transform:uppercase;white-space:nowrap;' +
    'padding:.3rem .68rem;border:1px solid #ddd3c2;border-radius:2px;' +
    'color:#8a8073;background:none;cursor:pointer;flex-shrink:0;' +
    'transition:color .15s,border-color .15s,background .15s;}' +
    '.scarc-like:hover{color:#8a3324;border-color:#8a3324;}' +
    '.scarc-like svg{width:12px;height:12px;display:block;flex-shrink:0;' +
    'transition:transform .18s cubic-bezier(.34,1.56,.64,1);}' +
    '.scarc-like:hover svg{transform:translateY(-1px);}' +
    '.scarc-like.on{color:#8a3324;border-color:#8a3324;background:#f2e4e0;}' +
    '.scarc-like.on svg{transform:translateY(-1px);}' +
    '.scarc-like.pop svg{transform:translateY(-3px) scale(1.18);}' +
    '.scarc-like-bar{display:flex;align-items:center;gap:.7rem;flex-wrap:wrap;' +
    'max-width:54rem;margin:2.2rem 0 .5rem;padding:.85rem 0 0;' +
    'border-top:1px solid #ddd3c2;}' +
    '.scarc-like-bar .q{font-family:"IBM Plex Mono",ui-monospace,monospace;' +
    'font-size:.68rem;letter-spacing:.08em;color:#8a8073;}' +
    '.scarc-like-inline{margin-left:auto;flex-shrink:0;}';

  var THUMB_OUTLINE =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>' +
    '<path d="M7 11l4.5-8.5a2.5 2.5 0 0 1 4.7 1.6L15.5 9H20a2 2 0 0 1 2 2.4l-1.7 8A2 2 0 0 1 18.3 21H7z"/>' +
    '</svg>';
  var THUMB_FILLED =
    '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.4" ' +
    'stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3z"/>' +
    '<path d="M7 11l4.5-8.5a2.5 2.5 0 0 1 4.7 1.6L15.5 9H20a2 2 0 0 1 2 2.4l-1.7 8A2 2 0 0 1 18.3 21H7z"/>' +
    '</svg>';

  var st = document.createElement('style');
  st.textContent = CSS;
  document.head.appendChild(st);

  var slug = location.pathname.replace(/index\.html$/, '').replace(/\.html$/, '') || '/';
  var KEY = 'scarc:like:' + slug;

  var btn = document.createElement('button');
  btn.className = 'scarc-like';
  btn.type = 'button';

  function liked() { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } }

  function paint() {
    var on = liked();
    btn.classList.toggle('on', on);
    btn.innerHTML = (on ? THUMB_FILLED : THUMB_OUTLINE) + '<span>' + (on ? 'Liked' : 'Like') + '</span>';
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.setAttribute('aria-label', on ? 'You liked this page. Click to undo.' : 'Do you like this page?');
    btn.title = on ? 'Thanks. Click to undo.' : 'Do you like this?';
  }

  btn.addEventListener('click', function () {
    var next = !liked();
    try { next ? localStorage.setItem(KEY, '1') : localStorage.removeItem(KEY); } catch (e) {}
    paint();
    if (next) {
      btn.classList.add('pop');
      setTimeout(function () { btn.classList.remove('pop'); }, 220);
    }
    if (typeof window.gtag === 'function') {
      window.gtag('event', next ? 'like_page' : 'unlike_page', {
        page_path: slug,
        page_title: document.title
      });
    }
  });

  paint();

  /* Mount at the end of the content, where "was this useful" belongs.
     Never inside .curio-switch, which scrolls horizontally and would hide it. */
  function bar() {
    var w = document.createElement('div');
    w.className = 'scarc-like-bar';
    var q = document.createElement('span');
    q.className = 'q';
    q.textContent = 'Was this useful?';
    w.appendChild(q);
    w.appendChild(btn);
    return w;
  }

  function mount() {
    /* 1. chart curiosities: after the closing note */
    var note = document.querySelector('.prose-note');
    if (note) { note.parentNode.insertBefore(bar(), note.nextSibling); return true; }

    /* 2. dispatches and essays: end of the last prose block */
    var proses = document.querySelectorAll('article.prose, .prose');
    if (proses.length) { proses[proses.length - 1].appendChild(bar()); return true; }

    /* 3. full-viewport map apps have no prose or footer at all, so sit in the
          header strip beside the source badge, which is always on screen */
    var hdr = document.querySelector('.map-header, .sub-header');
    if (hdr) { btn.className += ' scarc-like-inline'; hdr.appendChild(btn); return true; }

    /* 4. anything else */
    var main = document.querySelector('main') || document.querySelector('.chart-wrap');
    if (main) { main.appendChild(bar()); return true; }
    var f = document.querySelector('.site-footer');
    if (f) { f.parentNode.insertBefore(bar(), f); return true; }
    document.body.appendChild(bar());
    return true;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
