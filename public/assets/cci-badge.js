/* Scarcinality — Credit Counterfeit Index badge in the site header.
   Self-mounting and self-styling, so it works on the map pages that do not
   link /assets/style.css. Reads /data/cci.json, which is the same file the
   gauge dispatch and the full widget read, so the header can never drift
   from the published series.

   A page may place its own <a id="cci-header-badge"> to control where the
   badge sits; otherwise this appends one to .site-header. */
(function () {
  if (window.__scarcCCI) return;
  window.__scarcCCI = true;

  /* Literal fallbacks keep the badge readable on pages with no design
     tokens loaded; where style.css is present its own rules take over. */
  var CSS =
    '.cci-header-badge{display:inline-flex;align-items:baseline;gap:.5rem;' +
    'font-family:var(--mono,"IBM Plex Mono",ui-monospace,monospace);' +
    'font-size:.68rem;letter-spacing:.06em;color:var(--ink-soft,#4a453c);' +
    'text-decoration:none;border:none;padding:.22rem .6rem .22rem .55rem;' +
    'border-left:2px solid var(--oxblood,#8a3324);' +
    'background:var(--parchment-deep,#efe9dc);' +
    'white-space:nowrap;line-height:1.4;transition:color .15s;}' +
    '.cci-header-badge:hover{color:var(--ink,#211d18);}' +
    '.cci-header-badge:focus-visible{outline:2px solid var(--oxblood,#8a3324);outline-offset:2px;}' +
    '.cci-header-badge .cci-val{font-size:.82rem;font-weight:600;' +
    'color:var(--ink,#211d18);letter-spacing:.02em;font-variant-numeric:tabular-nums;}' +
    '.cci-header-badge .cci-dir{font-size:.62rem;letter-spacing:.1em;text-transform:uppercase;}' +
    '.cci-header-badge .cci-dir.breach{color:var(--oxblood,#8a3324);font-weight:600;}' +
    '.cci-header-badge .cci-dir.warn{color:#8A2C26;}' +
    '.cci-header-badge .cci-dir.clear{color:var(--ink-soft,#4a453c);}' +
    '.cci-header-badge .cci-k{font-size:.6rem;letter-spacing:.1em;' +
    'text-transform:uppercase;color:var(--ink-faint,#8a8073);}' +
    /* The header is tight on a phone, so drop the trailing word rather than
       the reading itself. The badge stays visible at every width. */
    '@media (max-width:560px){' +
    '.cci-header-badge{display:inline-flex;padding:.18rem .45rem .18rem .4rem;gap:.35rem;}' +
    '.cci-header-badge .cci-dir{display:none;}}';

  var st = document.createElement('style');
  st.textContent = CSS;
  document.head.appendChild(st);

  function mount() {
    var el = document.getElementById('cci-header-badge');
    if (!el) {
      /* Sit at the end of the nav rather than as a third child of the
         header: the header is space-between and would wrap the badge onto
         a row of its own, taller on every page. */
      var host = document.querySelector('.site-nav') ||
                 document.querySelector('.site-header');
      if (!host) return;
      el = document.createElement('a');
      el.id = 'cci-header-badge';
      el.className = 'cci-header-badge';
      el.href = '/dispatch-counterfeiters-gauge';
      el.setAttribute('aria-label', 'Credit Counterfeit Index');
      host.appendChild(el);
    }

    fetch('/data/cci.json')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var actual = data.quarters.filter(function (q) { return !q.projected; });
        var latest = actual[actual.length - 1];
        var prev = actual[actual.length - 2];
        var thr = data.meta.threshold;
        var delta = latest.cci - prev.cci;

        var word, cls;
        if (latest.cci >= thr) { word = 'breach'; cls = 'breach'; }
        else if (delta > 0.05) { word = 'rising'; cls = 'warn'; }
        else if (delta < -0.05) { word = 'retreating'; cls = 'clear'; }
        else { word = 'holding'; cls = 'clear'; }

        var sign = latest.cci >= 0 ? '+' : '';
        el.innerHTML =
          '<span class="cci-k">CCI</span>' +
          '<span class="cci-val">' + sign + latest.cci.toFixed(2) + '</span>' +
          '<span class="cci-dir ' + cls + '">' + word + '</span>';
        el.title = 'Credit Counterfeit Index, ' + latest.q + ': ' +
                   sign + latest.cci.toFixed(2) + ', ' + word + '. Tipping point +' +
                   thr.toFixed(1) + '. Read the methodology.';
      })
      .catch(function () {
        /* Never leave an empty box in the header. */
        el.innerHTML = '<span class="cci-k">CCI</span><span class="cci-val">&mdash;</span>';
        el.title = 'Credit Counterfeit Index: reading unavailable.';
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
