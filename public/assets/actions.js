/* Scarcinality — end-of-page actions: "do you like this" and "share this".
   Self-contained: injects its own styles so it works on the curiosity pages
   that do not link /assets/style.css. Like state is per-visitor in
   localStorage and the aggregate goes to /api/likes; share reports to Google
   Analytics as a 'share_page' event with the method used.

   Replaces the older /assets/like.js. Both controls mount into one bar so
   they share the placement cascade at the bottom of this file. */
(function () {
  if (window.__scarcActions) return;
  window.__scarcActions = true;

  var CSS =
    /* shared button shell */
    '.scarc-act{display:inline-flex;align-items:center;gap:.4rem;' +
    'font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:.62rem;' +
    'letter-spacing:.1em;text-transform:uppercase;white-space:nowrap;' +
    'padding:.3rem .68rem;border:1px solid #ddd3c2;border-radius:2px;' +
    'color:#8a8073;background:none;cursor:pointer;flex-shrink:0;' +
    'transition:color .15s,border-color .15s,background .15s;}' +
    '.scarc-act:hover{color:#8a3324;border-color:#8a3324;}' +
    '.scarc-act:focus-visible{outline:2px solid #8a3324;outline-offset:2px;}' +
    '.scarc-act svg{width:12px;height:12px;display:block;flex-shrink:0;' +
    'transition:transform .18s cubic-bezier(.34,1.56,.64,1);}' +
    /* like */
    '.scarc-like:hover svg{transform:translateY(-1px);}' +
    '.scarc-like.on{color:#8a3324;border-color:#8a3324;background:#f2e4e0;}' +
    '.scarc-like.on svg{transform:translateY(-1px);}' +
    '.scarc-like.pop svg{transform:translateY(-3px) scale(1.18);}' +
    '.scarc-like .n{font-variant-numeric:tabular-nums;opacity:.75;' +
    'padding-left:.15rem;transition:opacity .15s;}' +
    '.scarc-like.on .n{opacity:1;font-weight:500;}' +
    /* share */
    '.scarc-share:hover svg{transform:translateY(-1px);}' +
    '.scarc-share.done{color:#3f6b3a;border-color:#3f6b3a;background:#e9f0e6;}' +
    '.scarc-share-wrap{position:relative;display:inline-flex;flex-shrink:0;}' +
    '.scarc-menu{position:absolute;z-index:40;bottom:calc(100% + .4rem);right:0;' +
    'min-width:11rem;background:#fbf9f4;border:1px solid #ddd3c2;border-radius:2px;' +
    'box-shadow:0 6px 20px rgba(33,29,24,.13);padding:.25rem;' +
    'display:flex;flex-direction:column;}' +
    '.scarc-menu[hidden]{display:none;}' +
    /* the standfirst button sits near the top left, so its menu drops down
       and aligns to the left edge instead */
    '.scarc-menu.down{bottom:auto;top:calc(100% + .4rem);left:0;right:auto;}' +
    '.scarc-menu a,.scarc-menu button{display:flex;align-items:center;gap:.55rem;' +
    'font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:.63rem;' +
    'letter-spacing:.07em;text-transform:uppercase;color:#4a4238;background:none;' +
    'border:0;border-radius:2px;padding:.5rem .6rem;cursor:pointer;text-align:left;' +
    'text-decoration:none;width:100%;transition:background .12s,color .12s;}' +
    '.scarc-menu a:hover,.scarc-menu button:hover,' +
    '.scarc-menu a:focus-visible,.scarc-menu button:focus-visible{' +
    'background:#f2ece0;color:#8a3324;outline:none;}' +
    '.scarc-menu svg{width:13px;height:13px;flex-shrink:0;opacity:.7;}' +
    /* the bar they sit in */
    '.scarc-like-bar{display:flex;align-items:center;gap:.7rem;flex-wrap:wrap;' +
    'max-width:54rem;margin:2.2rem 0 .5rem;padding:.85rem 0 0;' +
    'border-top:1px solid #ddd3c2;}' +
    '.scarc-like-bar .q{font-family:"IBM Plex Mono",ui-monospace,monospace;' +
    'font-size:.68rem;letter-spacing:.08em;color:#8a8073;}' +
    '.scarc-like-bar .scarc-spacer{margin-left:auto;}' +
    '.scarc-like-inline{margin-left:auto;flex-shrink:0;}' +
    '.scarc-share-wrap.scarc-like-inline{margin-left:.5rem;}' +
    '@media(max-width:520px){.scarc-like-bar .scarc-spacer{margin-left:0;}}' +
    '@media(prefers-reduced-motion:reduce){.scarc-act svg{transition:none;}}';

  var st = document.createElement('style');
  st.textContent = CSS;
  document.head.appendChild(st);

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
  var ICON_SHARE =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>' +
    '<path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>';
  var ICON_CHECK =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M4 12.5l5.5 5.5L20 6.5"/></svg>';
  var ICON_LINK =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/>' +
    '<path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>';
  var ICON_FB =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.45 2.89h-2.33v6.99A10 10 0 0 0 22 12z"/></svg>';
  var ICON_LI =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9h4v12H3zM10 9h3.8v1.7h.05c.53-.95 1.83-1.95 3.75-1.95 4 0 4.4 2.5 4.4 5.9V21h-4v-5.5c0-1.3-.03-3-1.9-3-1.9 0-2.2 1.45-2.2 2.9V21h-4z"/></svg>';
  var ICON_X =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.5 3h3.1l-6.8 7.7L21.8 21h-6.2l-4.9-6.3L5.1 21H2l7.2-8.3L2.4 3h6.4l4.4 5.8L17.5 3zm-1.1 16.1h1.7L7.7 4.8H5.9l10.5 14.3z"/></svg>';
  var ICON_MAIL =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="2.5" y="4.5" width="19" height="15" rx="2"/><path d="M3 6l9 6.5L21 6"/></svg>';

  /* ---------- what we are sharing ---------- */
  function meta(sel, attr) {
    var el = document.querySelector(sel);
    return el ? (el.getAttribute(attr) || '').trim() : '';
  }
  var canon = document.querySelector('link[rel="canonical"]');
  var SHARE_URL = (canon && canon.href) ||
                  meta('meta[property="og:url"]', 'content') ||
                  location.href.split('#')[0];
  var SHARE_TITLE = meta('meta[property="og:title"]', 'content') || document.title;
  var SHARE_TEXT = meta('meta[property="og:description"]', 'content') ||
                   meta('meta[name="description"]', 'content') || '';

  var slug = location.pathname.replace(/index\.html$/, '').replace(/\.html$/, '') || '/';
  var KEY = 'scarc:like:' + slug;

  function track(ev, extra) {
    if (typeof window.gtag !== 'function') return;
    var d = { page_path: slug, page_title: document.title };
    for (var k in extra) d[k] = extra[k];
    window.gtag('event', ev, d);
  }

  /* ---------- like ---------- */
  var btn = document.createElement('button');
  btn.className = 'scarc-act scarc-like';
  btn.type = 'button';

  function liked() { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } }

  var count = null;   // null until the server answers

  function paint() {
    var on = liked();
    btn.classList.toggle('on', on);
    var n = (count === null || count <= 0) ? '' : '<span class="n">' + count + '</span>';
    btn.innerHTML = (on ? THUMB_FILLED : THUMB_OUTLINE) +
                    '<span>' + (on ? 'Liked' : 'Like') + '</span>' + n;
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.setAttribute('aria-label', on ? 'You liked this page. Click to undo.' : 'Do you like this page?');
    btn.title = on ? 'Thanks. Click to undo.' : 'Do you like this?';
  }

  btn.addEventListener('click', function () {
    var next = !liked();
    try { next ? localStorage.setItem(KEY, '1') : localStorage.removeItem(KEY); } catch (e) {}
    if (count !== null) count = Math.max(0, count + (next ? 1 : -1));
    paint();

    fetch('/api/likes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: slug, delta: next ? 1 : -1 })
    }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { if (d && typeof d.count === 'number') { count = d.count; paint(); } })
      .catch(function () { /* count stays optimistic; the like still registered locally */ });
    if (next) {
      btn.classList.add('pop');
      setTimeout(function () { btn.classList.remove('pop'); }, 220);
    }
    track(next ? 'like_page' : 'unlike_page');
  });

  paint();

  fetch('/api/likes?page=' + encodeURIComponent(slug))
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) { if (d && typeof d.count === 'number') { count = d.count; paint(); } })
    .catch(function () { /* no store: the button still works, just without a number */ });

  /* ---------- share ---------- */
  var wrap = document.createElement('div');
  wrap.className = 'scarc-share-wrap';

  var sbtn = document.createElement('button');
  sbtn.className = 'scarc-act scarc-share';
  sbtn.type = 'button';
  sbtn.innerHTML = ICON_SHARE + '<span>Share</span>';
  sbtn.title = 'Share this page';
  sbtn.setAttribute('aria-label', 'Share this page');

  var menu = document.createElement('div');
  menu.className = 'scarc-menu';
  menu.hidden = true;

  var u = encodeURIComponent(SHARE_URL);
  var t = encodeURIComponent(SHARE_TITLE);

  function link(label, href, icon, method) {
    var a = document.createElement('a');
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener';
    a.innerHTML = icon + '<span>' + label + '</span>';
    a.addEventListener('click', function () { track('share_page', { method: method }); close(); });
    return a;
  }

  var copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.innerHTML = ICON_LINK + '<span>Copy link</span>';
  copyBtn.addEventListener('click', function () { copy(); close(); });

  menu.appendChild(copyBtn);
  menu.appendChild(link('Facebook', 'https://www.facebook.com/sharer/sharer.php?u=' + u, ICON_FB, 'facebook'));
  menu.appendChild(link('LinkedIn', 'https://www.linkedin.com/sharing/share-offsite/?url=' + u, ICON_LI, 'linkedin'));
  menu.appendChild(link('X', 'https://twitter.com/intent/tweet?url=' + u + '&text=' + t, ICON_X, 'x'));
  menu.appendChild(link('Email', 'mailto:?subject=' + t + '&body=' +
    encodeURIComponent((SHARE_TEXT ? SHARE_TEXT + '\n\n' : '') + SHARE_URL), ICON_MAIL, 'email'));

  wrap.appendChild(sbtn);
  wrap.appendChild(menu);

  var flashTimer = null;
  function flash(word) {
    clearTimeout(flashTimer);
    var rest = sbtn.innerHTML;
    sbtn.classList.add('done');
    sbtn.innerHTML = ICON_CHECK + '<span>' + word + '</span>';
    flashTimer = setTimeout(function () {
      sbtn.classList.remove('done');
      sbtn.innerHTML = rest;
    }, 1900);
  }

  function copy() {
    function ok() { flash('Copied'); track('share_page', { method: 'copy' }); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(SHARE_URL).then(ok, legacy);
    } else { legacy(); }
    function legacy() {
      var ta = document.createElement('textarea');
      ta.value = SHARE_URL;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
      document.body.appendChild(ta);
      ta.select();
      var done = false;
      try { done = document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta);
      if (done) ok(); else { open_(); }
    }
  }

  function open_() {
    menu.hidden = false;
    sbtn.setAttribute('aria-expanded', 'true');
    document.addEventListener('click', away, true);
    document.addEventListener('keydown', esc);
  }
  function close() {
    menu.hidden = true;
    sbtn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', away, true);
    document.removeEventListener('keydown', esc);
  }
  function away(e) { if (!wrap.contains(e.target)) close(); }
  function esc(e) { if (e.key === 'Escape') { close(); sbtn.focus(); } }

  function wire(b) {
    b.setAttribute('aria-expanded', 'false');
    b.addEventListener('click', function (e) {
      e.preventDefault();
      /* On phones and tablets the operating system sheet is better than any
         menu we could draw, and it reaches apps we cannot link to. */
      if (navigator.share) {
        navigator.share({ title: SHARE_TITLE, text: SHARE_TEXT, url: SHARE_URL })
          .then(function () { track('share_page', { method: 'native' }); })
          .catch(function () { /* the reader dismissed the sheet */ });
        return;
      }
      menu.hidden ? open_() : close();
    });
  }
  wire(sbtn);

  /* ---------- placement ---------- */
  var adopted = false;

  /* Most pages already carry a "Share this dispatch" button under the
     standfirst that only copied the link. Take that one over rather than
     printing a second share control further down: same position, same look,
     but now the system sheet on a phone and the full menu on a desktop. */
  function adopt() {
    var old = document.querySelector('.share-btn');
    if (!old) return false;
    var host = document.createElement('span');
    host.className = 'scarc-share-wrap';
    old.parentNode.insertBefore(host, old);

    var fresh = old.cloneNode(true);      /* drops the inline onclick */
    fresh.removeAttribute('onclick');
    fresh.type = 'button';
    fresh.title = 'Share this page';
    fresh.setAttribute('aria-expanded', 'false');
    old.parentNode.removeChild(old);

    sbtn = fresh;
    menu.classList.add('down');
    host.appendChild(fresh);
    host.appendChild(menu);
    wrap = host;
    wire(fresh);
    adopted = true;
    return true;
  }

  function bar() {
    var w = document.createElement('div');
    w.className = 'scarc-like-bar';
    var q = document.createElement('span');
    q.className = 'q';
    q.textContent = 'Was this useful?';
    w.appendChild(q);
    w.appendChild(btn);
    if (!adopted) {
      wrap.classList.add('scarc-spacer');
      w.appendChild(wrap);
    }
    return w;
  }

  function mount() {
    adopt();

    /* 1. chart curiosities: after the closing note */
    var note = document.querySelector('.prose-note');
    if (note) { note.parentNode.insertBefore(bar(), note.nextSibling); return; }

    /* 2. dispatches and essays: end of the last prose block */
    var proses = document.querySelectorAll('article.prose, .prose');
    if (proses.length) { proses[proses.length - 1].appendChild(bar()); return; }

    /* 3. full-viewport map apps have no prose or footer at all, so sit in the
          header strip beside the source badge, which is always on screen */
    var hdr = document.querySelector('.map-header, .sub-header');
    if (hdr) {
      btn.className += ' scarc-like-inline';
      wrap.className += ' scarc-like-inline';
      hdr.appendChild(btn);
      hdr.appendChild(wrap);
      return;
    }

    /* 4. anything else */
    var main = document.querySelector('main') || document.querySelector('.chart-wrap');
    if (main) { main.appendChild(bar()); return; }
    var f = document.querySelector('.site-footer');
    if (f) { f.parentNode.insertBefore(bar(), f); return; }
    document.body.appendChild(bar());
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
