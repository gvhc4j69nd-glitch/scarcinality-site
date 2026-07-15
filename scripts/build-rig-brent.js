#!/usr/bin/env node
/* Build rig-brent.json
   Brent crude: EIA API (free, no key).
   US rig count: Baker Hughes monthly averages (no public API — hardcoded
   from published data; update the RIG_COUNT table each quarter).
   Output: public/data/rig-brent.json                                     */

const fs   = require("fs");
const path = require("path");
const https = require("https");
const OUT  = path.join(__dirname, "..", "public", "data", "rig-brent.json");

/* Baker Hughes US Total Rotary Rig Count — monthly averages, oil + gas.
   Source: Baker Hughes North America Rotary Rig Count (published weekly).
   Last updated: 2025-07.                                                  */
const RIG_COUNT = {
  "2015-01":1633,"2015-02":1536,"2015-03":1397,"2015-04":1216,"2015-05":1064,"2015-06":906,
  "2015-07":874, "2015-08":885, "2015-09":826, "2015-10":790, "2015-11":772, "2015-12":709,
  "2016-01":664, "2016-02":587, "2016-03":480, "2016-04":437, "2016-05":408, "2016-06":421,
  "2016-07":449, "2016-08":485, "2016-09":511, "2016-10":544, "2016-11":597, "2016-12":637,
  "2017-01":659, "2017-02":720, "2017-03":789, "2017-04":856, "2017-05":897, "2017-06":942,
  "2017-07":950, "2017-08":950, "2017-09":933, "2017-10":912, "2017-11":908, "2017-12":930,
  "2018-01":947, "2018-02":981, "2018-03":1006,"2018-04":1013,"2018-05":1046,"2018-06":1058,
  "2018-07":1048,"2018-08":1049,"2018-09":1054,"2018-10":1067,"2018-11":1082,"2018-12":1075,
  "2019-01":1047,"2019-02":1031,"2019-03":1022,"2019-04":988, "2019-05":982, "2019-06":971,
  "2019-07":955, "2019-08":927, "2019-09":857, "2019-10":826, "2019-11":802, "2019-12":805,
  "2020-01":795, "2020-02":790, "2020-03":696, "2020-04":476, "2020-05":339, "2020-06":277,
  "2020-07":254, "2020-08":244, "2020-09":255, "2020-10":283, "2020-11":318, "2020-12":351,
  "2021-01":378, "2021-02":385, "2021-03":428, "2021-04":466, "2021-05":453, "2021-06":473,
  "2021-07":500, "2021-08":497, "2021-09":523, "2021-10":543, "2021-11":570, "2021-12":586,
  "2022-01":610, "2022-02":644, "2022-03":673, "2022-04":699, "2022-05":727, "2022-06":753,
  "2022-07":764, "2022-08":765, "2022-09":764, "2022-10":771, "2022-11":778, "2022-12":781,
  "2023-01":764, "2023-02":755, "2023-03":756, "2023-04":753, "2023-05":720, "2023-06":696,
  "2023-07":670, "2023-08":641, "2023-09":624, "2023-10":628, "2023-11":620, "2023-12":622,
  "2024-01":619, "2024-02":621, "2024-03":619, "2024-04":614, "2024-05":602, "2024-06":591,
  "2024-07":586, "2024-08":581, "2024-09":579, "2024-10":576, "2024-11":578, "2024-12":580,
  "2025-01":576, "2025-02":589, "2025-03":583, "2025-04":575, "2025-05":566, "2025-06":558,
};

function fetchBrent() {
  return new Promise((resolve, reject) => {
    const url = "https://api.eia.gov/v2/petroleum/pri/spt/data/" +
      "?api_key=DEMO_KEY&frequency=monthly&data[0]=value" +
      "&facets[product][]=EPCBRENT&start=2015-01" +
      "&sort[0][column]=period&sort[0][direction]=asc&length=200";
    https.get(url, res => {
      let b = ""; res.on("data", d => b += d);
      res.on("end", () => {
        try {
          const rows = JSON.parse(b).response.data;
          const out = {};
          rows.forEach(r => { if (r.value) out[r.period] = +parseFloat(r.value).toFixed(2); });
          resolve(out);
        } catch(e) { reject(e); }
      });
    }).on("error", reject);
  });
}

async function main() {
  console.log("Fetching Brent from EIA...");
  const brent = await fetchBrent();
  console.log(`  ${Object.keys(brent).length} months of Brent data`);

  // Merge on shared periods
  const periods = [...new Set([...Object.keys(brent), ...Object.keys(RIG_COUNT)])].sort();
  const rows = periods
    .filter(p => brent[p] && RIG_COUNT[p])
    .map(p => ({ period: p, brent: brent[p], rigs: RIG_COUNT[p] }));

  const out = {
    meta: {
      brent_source: "EIA API: Europe Brent Spot Price FOB ($/barrel)",
      rig_source: "Baker Hughes North America Rotary Rig Count (US total, oil + gas)",
      as_of: new Date().toISOString().slice(0, 10),
    },
    rows,
  };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log(`Wrote ${rows.length} rows to ${OUT}`);
  const first = rows[0], last = rows[rows.length - 1];
  console.log(`  ${first.period}: Brent $${first.brent}  rigs ${first.rigs}`);
  console.log(`  ${last.period}:  Brent $${last.brent}  rigs ${last.rigs}`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
