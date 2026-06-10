/**
 * Matches FBN_FUEL_IMPORT.csv rows to REAL Supabase vehicles (scripts/fuel_vehicles.json).
 * Outputs:
 *   - FBN_FUEL_MATCH_REPORT.json  (per-registration summary + unmatched)
 *   - FBN_FUEL_ENTRIES.json       (ready-to-load fuel_entries with vehicle_id)
 */
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const csvPath = path.join(repoRoot, 'FBN_FUEL_IMPORT.csv');
const vehPath = path.join(__dirname, 'fuel_vehicles.json');

// Strip a trailing parenthetical " (ND...)" then keep only A-Z0-9.
const norm = (s) => (s || '').toString().toUpperCase().replace(/\(.*?\)/g, '').replace(/[^A-Z0-9]/g, '');

// Proper CSV line parse: handles quoted fields containing commas (e.g. "LIONLIFT 2,5T NO 12").
function parseLine(line) {
  const out = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQ = !inQ; continue; }
    if (c === ',' && !inQ) { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  out.push(cur);
  return out.map(s => s.trim());
}

const { org_id, vehicles } = JSON.parse(fs.readFileSync(vehPath, 'utf8'));

// Build lookups
const byNorm = new Map();        // exact normalized reg -> vehicle
const forkliftByNum = new Map(); // forklift number -> vehicle  (No. 8, NO 9 ...)
for (const v of vehicles) {
  byNorm.set(norm(v.registration), v);
  const fk = v.registration.match(/^NO\.?\s*0*(\d+)/i);
  if (fk) forkliftByNum.set(fk[1], v);
}

function matchVehicle(reg, assetType) {
  const n = norm(reg);
  if (!n) return null;

  // Forklift handling: CSV like "BAOLI 3T NO 10" / "LIONLIFT 2,5T NO 12"
  if (/forklift/i.test(assetType) || /\bNO\.?\s*\d+/i.test(reg) || /(BAOLI|MANHAND|LIONLIFT|ZOOMLION)/i.test(reg)) {
    const m = reg.match(/NO\.?\s*0*(\d+)\s*$/i);
    if (m && forkliftByNum.has(m[1])) return { vehicle: forkliftByNum.get(m[1]), how: 'forklift-number' };
  }

  // 1. Exact normalized
  if (byNorm.has(n)) return { vehicle: byNorm.get(n), how: 'exact' };

  // 2. Substring: CSV reg is a tail of the DB reg (handles dropped 2-letter prefix,
  //    e.g. CSV "42XYZN" -> DB "BS42XYZN", CSV "74PDZN" -> DB "CJ74PDZN")
  const subs = vehicles.filter(v => { const vn = norm(v.registration); return vn.endsWith(n) || n.endsWith(vn); });
  if (subs.length === 1) return { vehicle: subs[0], how: 'suffix' };
  if (subs.length > 1) return { ambiguous: subs };

  return null;
}

const raw = fs.readFileSync(csvPath, 'utf8').split(/\r?\n/).filter(l => l.trim());
const header = parseLine(raw[0]);
const col = (name) => header.indexOf(name);
const ci = {
  registration: col('registration'), date: col('date'), odometer: col('odometer'),
  litres: col('litres'), trip: col('trip_distance'), depot: col('depot'),
  asset: col('asset_type'),
};

const entries = [];
const perReg = new Map(); // registration -> {count, vehicle, how, sample}
const unmatched = new Map();

for (let i = 1; i < raw.length; i++) {
  const cells = parseLine(raw[i]);
  const reg = cells[ci.registration] || '';
  const assetType = cells[ci.asset] || '';
  const res = matchVehicle(reg, assetType);

  if (res && res.vehicle) {
    if (!perReg.has(reg)) perReg.set(reg, { count: 0, vehicle: `${res.vehicle.name} (${res.vehicle.registration})`, vehicleId: res.vehicle.id, how: res.how });
    perReg.get(reg).count++;

    const odo = Number(cells[ci.odometer]);
    const lit = Number(cells[ci.litres]);
    const trip = cells[ci.trip] ? Number(cells[ci.trip]) : null;
    if (cells[ci.date] && Number.isFinite(odo) && Number.isFinite(lit)) {
      entries.push({
        organization_id: org_id,
        vehicle_id: res.vehicle.id,
        date: cells[ci.date],
        odometer: odo,
        liters: lit,
        trip_distance_km: Number.isFinite(trip) ? trip : null,
        notes: 'Imported from FBN_FUEL_IMPORT.csv',
        _line: i + 1,
        _reg: reg,
      });
    }
  } else {
    const key = reg;
    if (!unmatched.has(key)) unmatched.set(key, { registration: reg, count: 0, ambiguous: res && res.ambiguous ? res.ambiguous.map(v => `${v.name} (${v.registration})`) : null });
    unmatched.get(key).count++;
  }
}

const report = {
  totalRows: raw.length - 1,
  uniqueRegistrations: perReg.size + unmatched.size,
  matchedRows: entries.length,
  matchedRegistrations: [...perReg.entries()].map(([reg, v]) => ({ csvRegistration: reg, ...v })).sort((a, b) => b.count - a.count),
  unmatchedRegistrations: [...unmatched.values()].sort((a, b) => b.count - a.count),
};

fs.writeFileSync(path.join(repoRoot, 'FBN_FUEL_MATCH_REPORT.json'), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(repoRoot, 'FBN_FUEL_ENTRIES.json'), JSON.stringify(entries, null, 2));

console.log('=== FUEL MATCH SUMMARY ===');
console.log('Total CSV rows      :', report.totalRows);
console.log('Unique registrations:', report.uniqueRegistrations);
console.log('Matched rows (loadable):', report.matchedRows);
console.log('Matched registrations  :', report.matchedRegistrations.length);
console.log('Unmatched registrations:', report.unmatchedRegistrations.length);
if (report.unmatchedRegistrations.length) {
  console.log('\n--- UNMATCHED (need a decision) ---');
  for (const u of report.unmatchedRegistrations) {
    console.log(`  ${u.registration.padEnd(20)} ${String(u.count).padStart(3)} rows${u.ambiguous ? '  AMBIGUOUS -> ' + u.ambiguous.join(' | ') : ''}`);
  }
}
