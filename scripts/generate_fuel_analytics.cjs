const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const csvPath = path.join(repoRoot, 'FBN_FUEL_IMPORT.csv');
const outPath = path.join(repoRoot, 'FBN_FUEL_ANALYTICS.json');

function parseCsv(content) {
  const lines = content.split(/\r?\n/).filter(Boolean);
  const header = lines.shift().split(',').map(h => h.trim());
  return lines.map((ln, idx) => {
    const parts = ln.split(',');
    const obj = {};
    for (let i = 0; i < header.length; i++) obj[header[i]] = parts[i] === undefined ? '' : parts[i].trim();
    obj._line = idx + 2;
    obj.litres = parseFloat(obj.litres) || 0;
    obj.date = obj.date || '';
    return obj;
  });
}

try {
  const csv = fs.readFileSync(csvPath, 'utf8');
  const rows = parseCsv(csv);

  const daily = new Map();
  const perVehicle = new Map();
  const depotTotals = new Map();

  for (const r of rows) {
    const d = r.date || 'unknown';
    daily.set(d, (daily.get(d) || 0) + r.litres);

    const reg = r.registration || 'UNKNOWN';
    if (!perVehicle.has(reg)) perVehicle.set(reg, []);
    perVehicle.get(reg).push({ date: d, litres: r.litres, odometer: r.odometer || '' });

    const depot = r.depot || 'UNKNOWN';
    depotTotals.set(depot, (depotTotals.get(depot) || 0) + r.litres);
  }

  const dailySeries = Array.from(daily.entries()).sort((a,b)=> new Date(a[0]) - new Date(b[0])).map(([date, litres])=>({date, litres}));
  const perVehicleSeries = Array.from(perVehicle.entries()).map(([reg, arr])=>({registration: reg, totalLitres: arr.reduce((s,x)=>s+x.litres,0), records: arr.sort((a,b)=> new Date(a.date) - new Date(b.date))}));
  const topVehicles = perVehicleSeries.slice().sort((a,b)=> b.totalLitres - a.totalLitres).slice(0,20);
  const depotSeries = Array.from(depotTotals.entries()).map(([depot, litres])=>({depot, litres}));

  const report = { totalRows: rows.length, dailySeries, perVehicleSeriesCount: perVehicleSeries.length, topVehicles, depotSeries };
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log('Analytics written to', outPath);
  console.log('Rows:', rows.length, 'Vehicles found:', perVehicleSeries.length);
} catch (err) {
  console.error(err.stack || err.message || err);
  process.exit(2);
}
