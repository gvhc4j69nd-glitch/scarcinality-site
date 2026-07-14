#!/usr/bin/env node
/* Scarcinality CCI quarterly updater.
   Usage:  FRED_API_KEY=yourkey node scripts/update-cci.js 2026Q3 --rb 0.4
           node scripts/update-cci.js 2026Q3 --rb 0.4 --hy 2.8 --sloos 10 --ffr 3.6 --pce 3.3 --m2 4.6
   With a FRED key it fetches the quarter's inputs; without one, pass them manually.
   RB (Real Bind, 0 = no genuine physical scarcity) is always yours to judge:
   that judgment IS the framework. The script recomputes all z-scores over the
   full window, rewrites public/data/cci.json, and both the homepage widget and
   the Gauge dispatch update on next page load. Commit and push to deploy.
   Get a free key: https://fred.stlouisfed.org/docs/api/api_key.html            */

const fs = require("fs");
const path = require("path");
const https = require("https");

const DATA = path.join(__dirname, "..", "public", "data", "cci.json");
const args = process.argv.slice(2);
const quarter = args[0];
if (!quarter || !/^\d{4}Q[1-4]$/.test(quarter)) {
  console.error("Usage: node scripts/update-cci.js 2026Q3 --rb 0.4 [--hy --sloos --ffr --pce --m2]");
  process.exit(1);
}
function flag(name) {
  const i = args.indexOf("--" + name);
  return i >= 0 ? parseFloat(args[i + 1]) : undefined;
}
const KEY = process.env.FRED_API_KEY;

const Q_MONTHS = { Q1: ["01","02","03"], Q2: ["04","05","06"], Q3: ["07","08","09"], Q4: ["10","11","12"] };
const [yr, qq] = [quarter.slice(0,4), quarter.slice(4)];
const months = Q_MONTHS[qq].map(m => `${yr}-${m}-01`);
const start = months[0], end = `${yr}-${qq==="Q4" ? "12-31" : Q_MONTHS[qq][2]+"-28"}`;

function fred(series) {
  return new Promise((resolve, reject) => {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${series}&api_key=${KEY}&file_type=json&observation_start=${start}&observation_end=${end}`;
    https.get(url, res => {
      let b = ""; res.on("data", d => b += d);
      res.on("end", () => {
        try {
          const obs = JSON.parse(b).observations.map(o => parseFloat(o.value)).filter(v => !isNaN(v));
          resolve(obs.length ? obs.reduce((a,c)=>a+c,0)/obs.length : NaN);
        } catch (e) { reject(e); }
      });
    }).on("error", reject);
  });
}

function yoy(series) {
  // quarter-average level this year vs same quarter last year
  const lastYr = String(Number(yr) - 1);
  const s2 = `${lastYr}-${Q_MONTHS[qq][0]}-01`, e2 = `${lastYr}-${qq==="Q4" ? "12-31" : Q_MONTHS[qq][2]+"-28"}`;
  function get(s, e) {
    return new Promise((resolve, reject) => {
      const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${series}&api_key=${KEY}&file_type=json&observation_start=${s}&observation_end=${e}`;
      https.get(url, res => {
        let b = ""; res.on("data", d => b += d);
        res.on("end", () => {
          try {
            const obs = JSON.parse(b).observations.map(o => parseFloat(o.value)).filter(v => !isNaN(v));
            resolve(obs.length ? obs.reduce((a,c)=>a+c,0)/obs.length : NaN);
          } catch (e2) { reject(e2); }
        });
      }).on("error", reject);
    });
  }
  return Promise.all([get(start, end), get(s2, e2)]).then(([a, b]) => (a / b - 1) * 100);
}

async function main() {
  const rb = flag("rb");
  if (rb === undefined || isNaN(rb)) {
    console.error("Real Bind is required: --rb <0..3>. 0 = no genuine physical scarcity.");
    console.error("This input is deliberately manual: deciding which shortage is real is the framework.");
    process.exit(1);
  }

  let hy = flag("hy"), sloos = flag("sloos"), ffr = flag("ffr"), pce = flag("pce"), m2g = flag("m2");

  if ([hy, sloos, ffr, pce, m2g].some(v => v === undefined)) {
    if (!KEY) {
      console.error("Missing inputs and no FRED_API_KEY set. Either export a key or pass all of --hy --sloos --ffr --pce --m2.");
      process.exit(1);
    }
    console.log("Fetching FRED for " + quarter + " ...");
    const [hyF, sloosF, ffrF, pceYoY, m2YoY] = await Promise.all([
      hy    !== undefined ? hy    : fred("BAMLH0A0HYM2"),   // HY OAS, %
      sloos !== undefined ? sloos : fred("DRTSCILM"),       // SLOOS net % tightening C&I
      ffr   !== undefined ? ffr   : fred("FEDFUNDS"),       // fed funds, %
      pce   !== undefined ? pce   : yoy("PCEPILFE"),        // core PCE YoY, %
      m2g   !== undefined ? m2g   : yoy("M2SL"),            // nominal M2 YoY, %
    ]);
    hy = hyF; sloos = sloosF; ffr = ffrF; pce = pceYoY; m2g = m2YoY;
  }

  const real_ffr = +(ffr - pce).toFixed(2);
  const real_m2  = +(m2g - pce).toFixed(2);

  const data = JSON.parse(fs.readFileSync(DATA, "utf8"));
  // drop projected rows and any existing row for this quarter
  data.quarters = data.quarters.filter(q => !q.projected && q.q !== quarter);
  data.quarters.push({ q: quarter, hy_oas: +(+hy).toFixed(2), sloos: +(+sloos).toFixed(1),
                       real_ffr, real_m2, rb: +rb });

  // recompute z-scores + MB + CCI over the full window
  function z(arr) {
    const m = arr.reduce((a,c)=>a+c,0)/arr.length;
    const sd = Math.sqrt(arr.reduce((a,c)=>a+(c-m)*(c-m),0)/arr.length) || 1;
    return arr.map(v => (v - m) / sd);
  }
  const zh = z(data.quarters.map(q=>q.hy_oas));
  const zs = z(data.quarters.map(q=>q.sloos));
  const zf = z(data.quarters.map(q=>q.real_ffr));
  const zm = z(data.quarters.map(q=>q.real_m2)).map(v=>-v);
  data.quarters.forEach((q,i) => {
    q.mb  = +((zh[i]+zs[i]+zf[i]+zm[i])/4).toFixed(2);
    q.cci = +(q.mb - q.rb).toFixed(2);
  });
  data.meta.as_of = new Date().toISOString().slice(0,10);

  fs.writeFileSync(DATA, JSON.stringify(data, null, 2));
  const last = data.quarters[data.quarters.length-1];
  const dist = (data.meta.threshold - last.cci).toFixed(2);
  console.log(`\n${quarter}: MB ${last.mb >= 0 ? "+" : ""}${last.mb}  RB ${last.rb}  CCI ${last.cci >= 0 ? "+" : ""}${last.cci}`);
  console.log(last.cci >= data.meta.threshold
    ? ">>> BREACH: credit is the counterfeiter this quarter."
    : `${dist} below the tipping point.`);
  console.log("cci.json updated. Note: z-scores recompute over the whole window, so history shifts slightly each quarter (by design). Commit and push to deploy.");
}

main().catch(e => { console.error("Update failed:", e.message); process.exit(1); });
