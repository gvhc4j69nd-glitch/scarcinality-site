/* Scarcinality CCI widget.
   Renders the Credit Counterfeit Index into <div id="cci-widget"></div>.
   Reads /data/cci.json, so it updates automatically whenever that file
   is refreshed by scripts/update-cci.js. No dependencies.
   Embed:  <div id="cci-widget"></div>
           <script src="/assets/cci-widget.js"></script>            */

(function () {
  var el = document.getElementById("cci-widget");
  if (!el) return;

  fetch("/data/cci.json")
    .then(function (r) { return r.json(); })
    .then(render)
    .catch(function () {
      el.innerHTML = "<p style='font-family:monospace;font-size:.75rem;color:#8A2C26'>CCI unavailable</p>";
    });

  function render(data) {
    var qs = data.quarters;
    var actual = qs.filter(function (q) { return !q.projected; });
    var latest = actual[actual.length - 1];
    var prev = actual[actual.length - 2];
    var thr = data.meta.threshold;

    var dirWord, dirColor;
    var delta = latest.cci - prev.cci;
    if (latest.cci >= thr) { dirWord = "BREACH"; dirColor = "#6E1F1B"; }
    else if (delta > 0.05) { dirWord = "approaching"; dirColor = "#8A2C26"; }
    else if (delta < -0.05) { dirWord = "retreating"; dirColor = "#4A453C"; }
    else { dirWord = "holding"; dirColor = "#4A453C"; }

    /* distance to tipping point */
    var dist = (thr - latest.cci).toFixed(2);

    /* sparkline: last 12 points incl. projections */
    var pts = qs.slice(-12);
    var W = 260, H = 64, PAD = 4;
    var vals = pts.map(function (p) { return p.cci; }).concat([thr]);
    var min = Math.min.apply(null, vals) - 0.2;
    var max = Math.max.apply(null, vals) + 0.2;
    function X(i) { return PAD + (i / (pts.length - 1)) * (W - 2 * PAD); }
    function Y(v) { return H - PAD - ((v - min) / (max - min)) * (H - 2 * PAD); }

    var lastActualIdx = -1;
    pts.forEach(function (p, i) { if (!p.projected) lastActualIdx = i; });

    var solid = "", dashed = "";
    pts.forEach(function (p, i) {
      var seg = X(i).toFixed(1) + "," + Y(p.cci).toFixed(1);
      if (i <= lastActualIdx) solid += (solid ? " " : "") + seg;
      if (i >= lastActualIdx) dashed += (dashed ? " " : "") + seg;
    });

    var thrY = Y(thr).toFixed(1);
    var dotX = X(lastActualIdx).toFixed(1), dotY = Y(pts[lastActualIdx].cci).toFixed(1);

    el.innerHTML =
      '<div style="border:1px solid #C9BFA8;border-left:3px solid #6E1F1B;background:#ECE7DA;padding:.9rem 1.05rem;max-width:22rem;font-family:\'IBM Plex Mono\',ui-monospace,monospace;">' +
        '<div style="font-size:.68rem;letter-spacing:.12em;text-transform:uppercase;color:#6E1F1B;">Credit Counterfeit Index</div>' +
        '<div style="display:flex;align-items:baseline;gap:.6rem;margin:.25rem 0 .1rem;">' +
          '<span style="font-size:1.9rem;font-weight:600;color:#23201B;">' + latest.cci.toFixed(2) + '</span>' +
          '<span style="font-size:.78rem;color:' + dirColor + ';font-weight:600;">' + dirWord + '</span>' +
        '</div>' +
        '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="' + H + '" role="img" aria-label="CCI sparkline">' +
          '<line x1="' + PAD + '" y1="' + thrY + '" x2="' + (W - PAD) + '" y2="' + thrY + '" stroke="#6E1F1B" stroke-width="1" stroke-dasharray="4 3"/>' +
          '<polyline points="' + solid + '" fill="none" stroke="#6E1F1B" stroke-width="1.8"/>' +
          '<polyline points="' + dashed + '" fill="none" stroke="#8A2C26" stroke-width="1.4" stroke-dasharray="3 3"/>' +
          '<circle cx="' + dotX + '" cy="' + dotY + '" r="3" fill="#6E1F1B"/>' +
          '<text x="' + (W - PAD) + '" y="' + (thrY - 3) + '" text-anchor="end" font-size="8" fill="#6E1F1B">tipping point +' + thr.toFixed(1) + '</text>' +
        '</svg>' +
        '<div style="font-size:.68rem;color:#4A453C;line-height:1.45;margin-top:.15rem;">' +
          latest.q + ' \u00b7 ' + dist + ' below the tipping point \u00b7 dashed = projected' +
        '</div>' +
        '<a href="/dispatch-counterfeiters-gauge" style="font-size:.68rem;color:#6E1F1B;text-decoration:none;border-bottom:1px solid rgba(110,31,27,.32);">methodology &amp; ledger \u2192</a>' +
      '</div>';
  }
})();
