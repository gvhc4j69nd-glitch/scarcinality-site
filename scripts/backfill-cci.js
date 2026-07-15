#!/usr/bin/env node
/* CCI backfill: 2006Q1–2021Q2 using hardcoded FRED quarterly averages.
   Sources: BAMLH0A0HYM2, DRTSCILM, FEDFUNDS, PCEPILFE YoY, M2SL YoY.
   RB = Real Bind, manual judgment (0 = no genuine physical scarcity).
   Run: node scripts/backfill-cci.js
   This prepends historical rows to cci.json and recomputes all z-scores. */

const fs = require("fs");
const path = require("path");
const DATA = path.join(__dirname, "..", "public", "data", "cci.json");

// [quarter, hy_oas, sloos, ffr, pce_yoy, m2_yoy, rb]
// real_ffr = ffr - pce_yoy
// real_m2  = m2_yoy - pce_yoy
const HISTORY = [
  // 2006 — benign credit conditions, housing still inflating
  ["2006Q1", 3.3,  -5,  4.50, 2.1, 4.5, 0.0],
  ["2006Q2", 3.2, -10,  5.00, 2.3, 3.8, 0.0],
  ["2006Q3", 3.0,  -5,  5.25, 2.4, 4.0, 0.0],
  ["2006Q4", 2.9,   0,  5.25, 2.3, 4.8, 0.0],
  // 2007 — credit stress emerging; no real scarcity
  ["2007Q1", 2.8,  -5,  5.25, 2.4, 5.5, 0.0],
  ["2007Q2", 2.7,   0,  5.25, 2.0, 5.2, 0.0],
  ["2007Q3", 3.5,  20,  5.10, 2.0, 5.5, 0.0],
  ["2007Q4", 4.6,  35,  4.50, 2.1, 6.2, 0.0],
  // 2008 — financial crisis + oil spike (genuine commodity scarcity Q1-Q3)
  ["2008Q1", 6.0,  55,  3.20, 2.2, 5.5, 1.0],
  ["2008Q2", 7.0,  60,  2.00, 2.3, 5.3, 1.5],
  ["2008Q3", 8.0,  75,  2.00, 2.3, 5.3, 0.8],
  ["2008Q4",16.5,  80,  0.50, 1.6, 9.5, 0.2],
  // 2009 — crisis peak, then recovery; real scarcity gone
  ["2009Q1",17.0,  75,  0.20, 1.5,10.5, 0.0],
  ["2009Q2",12.0,  40,  0.20, 1.4, 7.5, 0.0],
  ["2009Q3", 8.5,  20,  0.20, 1.4, 6.5, 0.0],
  ["2009Q4", 6.5,   5,  0.10, 1.5, 3.5, 0.0],
  // 2010 — recovery; mild commodity re-inflation
  ["2010Q1", 6.0,   5,  0.10, 1.3, 1.8, 0.0],
  ["2010Q2", 6.5,  -5,  0.10, 1.4, 1.5, 0.0],
  ["2010Q3", 5.8,  -8,  0.20, 1.2, 2.2, 0.0],
  ["2010Q4", 5.0, -10,  0.20, 1.2, 3.5, 0.0],
  // 2011 — Arab Spring food spike + Euro debt crisis (moderate real bind)
  ["2011Q1", 4.8, -12,  0.10, 1.2, 5.5, 0.5],
  ["2011Q2", 5.0, -12,  0.10, 1.6, 7.5, 0.7],
  ["2011Q3", 6.5,   5,  0.10, 1.8,10.0, 0.4],
  ["2011Q4", 7.0,   5,  0.10, 1.7, 9.8, 0.2],
  // 2012 — Euro crisis lingers; Draghi "whatever it takes" Q3
  ["2012Q1", 6.5,  -8,  0.10, 1.8, 9.0, 0.2],
  ["2012Q2", 6.8, -10,  0.20, 1.7, 7.5, 0.2],
  ["2012Q3", 5.8, -12,  0.10, 1.7, 6.5, 0.1],
  ["2012Q4", 5.2, -15,  0.20, 1.5, 7.2, 0.1],
  // 2013 — taper tantrum Q2; conditions generally loose
  ["2013Q1", 4.8, -15,  0.15, 1.3, 7.5, 0.0],
  ["2013Q2", 5.2, -12,  0.10, 1.2, 7.0, 0.0],
  ["2013Q3", 4.6, -15,  0.10, 1.3, 6.5, 0.0],
  ["2013Q4", 4.2, -18,  0.10, 1.3, 5.8, 0.0],
  // 2014 — oil price collapse begins Q4; broadly benign
  ["2014Q1", 4.0, -18,  0.10, 1.3, 5.8, 0.0],
  ["2014Q2", 3.9, -20,  0.10, 1.6, 5.5, 0.0],
  ["2014Q3", 4.2, -15,  0.10, 1.5, 5.8, 0.0],
  ["2014Q4", 5.0, -10,  0.10, 1.5, 5.5, 0.2],
  // 2015 — China devaluation shock Q3; HY energy stress
  ["2015Q1", 5.2,  -8,  0.10, 1.3, 5.8, 0.0],
  ["2015Q2", 5.5,  -5,  0.10, 1.3, 5.5, 0.0],
  ["2015Q3", 6.5,   5,  0.10, 1.3, 5.0, 0.0],
  ["2015Q4", 7.5,  10,  0.30, 1.3, 5.0, 0.0],
  // 2016 — HY energy credit stress peaks Q1; then eases
  ["2016Q1", 8.0,  15,  0.40, 1.4, 5.8, 0.0],
  ["2016Q2", 6.5,  10,  0.40, 1.6, 6.0, 0.0],
  ["2016Q3", 5.5,   0,  0.40, 1.7, 7.0, 0.0],
  ["2016Q4", 4.8,  -5,  0.50, 1.7, 6.8, 0.0],
  // 2017 — Goldilocks; gradual tightening
  ["2017Q1", 4.2, -10,  0.70, 1.8, 6.0, 0.0],
  ["2017Q2", 4.0, -15,  1.00, 1.5, 5.8, 0.0],
  ["2017Q3", 3.8, -15,  1.20, 1.5, 5.0, 0.0],
  ["2017Q4", 3.6, -18,  1.30, 1.5, 5.0, 0.0],
  // 2018 — hiking cycle; Q4 equity selloff
  ["2018Q1", 3.6, -18,  1.50, 1.8, 4.0, 0.0],
  ["2018Q2", 3.7, -20,  1.80, 2.0, 4.0, 0.0],
  ["2018Q3", 3.4, -20,  2.00, 2.0, 3.5, 0.0],
  ["2018Q4", 4.7, -10,  2.30, 2.0, 3.8, 0.0],
  // 2019 — insurance cuts; conditions ease
  ["2019Q1", 4.5,  -5,  2.40, 1.6, 4.3, 0.0],
  ["2019Q2", 3.8,  -8,  2.40, 1.6, 5.5, 0.0],
  ["2019Q3", 3.8,   0,  2.20, 1.7, 5.5, 0.0],
  ["2019Q4", 3.5,   0,  1.70, 1.6, 6.8, 0.0],
  // 2020 — COVID; supply chain disruptions are genuinely real Q2-Q3
  ["2020Q1", 7.5,  35,  1.10, 1.8,10.5, 0.8],
  ["2020Q2", 7.5,  70,  0.10, 0.9,23.0, 1.5],
  ["2020Q3", 5.5,  25,  0.10, 1.4,24.0, 0.8],
  ["2020Q4", 4.5,   5,  0.10, 1.5,25.0, 0.5],
  // 2021Q1-Q2 — semiconductor/lumber/used car real shortages + stimulus flood
  ["2021Q1", 3.8,  -5,  0.10, 1.8,26.0, 1.0],
  ["2021Q2", 3.4, -18,  0.10, 3.5,13.0, 1.5],
];

function z(arr) {
  const m = arr.reduce((a, c) => a + c, 0) / arr.length;
  const sd = Math.sqrt(arr.reduce((a, c) => a + (c - m) * (c - m), 0) / arr.length) || 1;
  return arr.map(v => (v - m) / sd);
}

const data = JSON.parse(fs.readFileSync(DATA, "utf8"));

// Build historical rows
const histRows = HISTORY.map(([q, hy_oas, sloos, ffr, pce_yoy, m2_yoy, rb]) => ({
  q,
  hy_oas,
  sloos,
  real_ffr: +(ffr - pce_yoy).toFixed(2),
  real_m2:  +(m2_yoy - pce_yoy).toFixed(2),
  rb,
}));

// Merge: historical rows first, then existing non-projected rows
const existingQs = new Set(histRows.map(r => r.q));
const existing = data.quarters.filter(q => !q.projected && !existingQs.has(q.q));
const merged = [...histRows, ...existing];

// Recompute z-scores + MB + CCI
const zh = z(merged.map(r => r.hy_oas));
const zs = z(merged.map(r => r.sloos));
const zf = z(merged.map(r => r.real_ffr));
const zm = z(merged.map(r => r.real_m2)).map(v => -v);
merged.forEach((r, i) => {
  r.mb  = +((zh[i] + zs[i] + zf[i] + zm[i]) / 4).toFixed(2);
  r.cci = +(r.mb - r.rb).toFixed(2);
});

data.quarters = merged;
data.meta.as_of = new Date().toISOString().slice(0, 10);
fs.writeFileSync(DATA, JSON.stringify(data, null, 2));

// Print summary
const thr = data.meta.threshold;
console.log("\nCCI BACKFILL — 2006Q1 to present\n");
console.log("Quarter   HY    SLOOS  rFFR  rM2   RB    MB    CCI   Status");
console.log("─".repeat(72));
merged.forEach(r => {
  const status = r.cci >= thr ? "▲ BREACH" : r.cci >= 0.5 ? "  warning" : "  clear";
  const flag = r.projected ? " *" : "";
  console.log(
    `${r.q}${flag}  ${String(r.hy_oas).padStart(5)}  ${String(r.sloos).padStart(5)}  ` +
    `${String(r.real_ffr).padStart(5)}  ${String(r.real_m2).padStart(5)}  ` +
    `${String(r.rb).padStart(4)}  ${String(r.mb).padStart(5)}  ${String(r.cci).padStart(5)}  ${status}`
  );
});

const breaches = merged.filter(r => r.cci >= thr);
console.log(`\n${breaches.length} BREACH quarters of ${merged.length} total:`);
breaches.forEach(r => console.log(`  ${r.q}: CCI ${r.cci >= 0 ? "+" : ""}${r.cci}  (MB ${r.mb >= 0 ? "+" : ""}${r.mb}, RB ${r.rb})`));
console.log("\ncci.json updated. Commit and push to deploy.");
