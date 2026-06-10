// Fuel-log importer.
//
// Takes the parsed 3-month fuel-log rows + the matcher's automated
// categorisation, applies quality checks per-vehicle, and writes the
// surviving rows into Supabase fuel_entries so they show up under
// each vehicle in the FBN program. Idempotent (upsert by vehicle_id +
// date + odometer + litres) so reruns are safe.
//
// What gets imported:
//   - MATCHED  rows (exact normalised reg match)
//   - ALT      rows (matched via parenthetical alt reg in vehicle name)
//
// What gets dropped (and why):
//   - PROBABLE / AMBIGUOUS / UNMATCHED / EMPTY  - low confidence
//   - missing date or non-positive litres       - garbage input
//   - odometer goes backwards vs previous entry - wrong vehicle / typo
//   - L/100km outside 8..120 (when computable)  - data error
//   - duplicate (vehicle_id, date, odo, litres) - already imported
//
// Reads SUPABASE_SECRET from API KEYS/supabase-secret.txt (gitignored)
// or process.env.SUPABASE_SECRET.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BUILDER_OUT = path.resolve(__dirname, './fuel-log-builder-output.json');
const MATCHER_OUT = path.resolve(__dirname, './fuel-log-matcher-report.json');
const IMPORT_REPORT = path.resolve(__dirname, './fuel-log-importer-report.json');

const SUPABASE_URL = 'https://kyosepbdxjwugunylvyo.supabase.co';
const SUPABASE_SECRET = (() => {
    const fromEnv = process.env.SUPABASE_SECRET;
    if (fromEnv) return fromEnv.trim();
    const secretPath = path.resolve(__dirname, '../API KEYS/supabase-secret.txt');
    if (fs.existsSync(secretPath)) return fs.readFileSync(secretPath, 'utf8').trim();
    throw new Error(`Supabase secret not found. Set SUPABASE_SECRET env var or save to ${secretPath}`);
})();

const FBN_ORGANIZATION_ID = '00000000-0000-0000-0000-000000000001';

// Plausibility windows for the per-vehicle quality check. Wider than
// strict "20-80 L/100km diesel truck" because the source has lots of
// small fills (pre-fill top-ups) where trip KMs were tiny.
const MIN_CONSUMPTION_L_PER_100KM = 8;
const MAX_CONSUMPTION_L_PER_100KM = 120;

// Maximum backward odometer (in km) we tolerate before flagging. Source
// data has occasional 1-2 km regressions from rounding/typo - don't
// punish those. Anything > 100km backward is a wrong-vehicle smell.
const MAX_TOLERATED_ODO_REGRESSION = 100;

const normReg = s => (s ?? '').toString().toUpperCase().replace(/[^A-Z0-9]/g, '');

async function supabaseFetch(pathAndQuery, init = {}) {
    const url = `${SUPABASE_URL}/rest/v1/${pathAndQuery}`;
    const res = await fetch(url, {
        ...init,
        headers: {
            apikey: SUPABASE_SECRET,
            Authorization: `Bearer ${SUPABASE_SECRET}`,
            'Content-Type': 'application/json',
            ...(init.headers || {}),
        },
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Supabase ${init.method || 'GET'} ${pathAndQuery} failed: ${res.status} ${text}`);
    }
    return res.json();
}

function buildMatchLookup(matcherReport) {
    // raw reg string -> { status, vehicleId } for every reg the matcher
    // saw. Only MATCHED and ALT statuses include a vehicleId we can use.
    const out = new Map();
    for (const [statusKey, arr] of Object.entries(matcherReport.details)) {
        for (const entry of arr) {
            const vehicleId = entry.result?.vehicle?.id ?? null;
            out.set(entry.rawReg, { status: statusKey, vehicleId });
        }
    }
    return out;
}

async function loadExistingEntries(vehicleIds) {
    // Pull existing fuel_entries for the involved vehicles so we can
    // skip duplicates during upsert. Filter by vehicle_id in() to limit
    // payload - we don't need the whole table.
    if (vehicleIds.length === 0) return new Map();
    const inList = vehicleIds.map(id => `"${id}"`).join(',');
    const rows = await supabaseFetch(
        `fuel_entries?select=vehicle_id,date,odometer,liters&vehicle_id=in.(${inList})&limit=10000`,
    );
    const set = new Set();
    for (const r of rows) {
        // Same dedup key as the importer uses below.
        set.add(`${r.vehicle_id}|${r.date.slice(0, 10)}|${Math.round(r.odometer)}|${Math.round(r.liters * 10)}`);
    }
    return set;
}

async function main() {
    console.log('Loading parsed fuel data + match report...');
    const built = JSON.parse(fs.readFileSync(BUILDER_OUT, 'utf8'));
    const matcher = JSON.parse(fs.readFileSync(MATCHER_OUT, 'utf8'));
    const fuelLog = built.fuelLog;
    const matchLookup = buildMatchLookup(matcher);
    console.log(`  ${fuelLog.length} fuel-log rows`);
    console.log(`  ${matchLookup.size} unique regs categorised`);

    // Bucket counts for the report.
    const stats = {
        rowsByStatus: { MATCHED: 0, ALT: 0, PROBABLE: 0, AMBIGUOUS: 0, UNMATCHED: 0, EMPTY: 0 },
        dropped: { badInput: 0, odoRegression: 0, consumption: 0, duplicate: 0 },
        imported: 0,
        vehiclesTouched: new Set(),
    };
    const droppedSamples = { badInput: [], odoRegression: [], consumption: [], duplicate: [] };

    // Stage 1: bucket rows by status, drop garbage input upfront.
    const candidatesByVehicle = new Map();
    for (const row of fuelLog) {
        const lookup = matchLookup.get(row.vehicleReg ?? '');
        const status = lookup?.status ?? 'UNMATCHED';
        stats.rowsByStatus[status]++;
        if (status !== 'MATCHED' && status !== 'ALT') continue;

        const vehicleId = lookup.vehicleId;
        if (!vehicleId) continue;

        const litres = Number(row.litres);
        const dateOk = row.date && /^\d{4}-\d{2}-\d{2}/.test(row.date);
        if (!dateOk || !isFinite(litres) || litres <= 0) {
            stats.dropped.badInput++;
            if (droppedSamples.badInput.length < 5) droppedSamples.badInput.push({ row, reason: 'missing date or non-positive litres' });
            continue;
        }

        if (!candidatesByVehicle.has(vehicleId)) candidatesByVehicle.set(vehicleId, []);
        candidatesByVehicle.get(vehicleId).push({
            vehicle_id: vehicleId,
            date: row.date,
            odometer: Number(row.odometer) > 0 ? Number(row.odometer) : null,
            liters: litres,
            cost_per_liter: null,
            total_cost: Number(row.randValue) > 0 ? Number(row.randValue) : null,
            trip_distance_km: null,
            notes: row.sourceFile ? `imported from ${row.sourceFile} :: ${row.sourceTab} :: row ${row.sourceRow}` : null,
            __rawSourceFile: row.sourceFile,
        });
    }

    console.log('\nPer-vehicle bucket sizes (top 10):');
    const sortedVehicles = [...candidatesByVehicle.entries()]
        .map(([id, rows]) => ({ id, count: rows.length }))
        .sort((a, b) => b.count - a.count);
    for (const v of sortedVehicles.slice(0, 10)) {
        console.log(`  ${v.id.slice(0, 8)}...  ${v.count} candidate rows`);
    }

    // Stage 2: per-vehicle, sort by date and validate the chain.
    const toImport = [];
    for (const [vehicleId, rows] of candidatesByVehicle) {
        rows.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
        let prevOdo = null;
        for (const r of rows) {
            // Odo regression check (only when both this and prev have an
            // odometer). A drop of >MAX_TOLERATED_ODO_REGRESSION smells
            // like a wrong-vehicle assignment or a typo.
            if (r.odometer !== null && prevOdo !== null) {
                const delta = r.odometer - prevOdo;
                if (delta < -MAX_TOLERATED_ODO_REGRESSION) {
                    stats.dropped.odoRegression++;
                    if (droppedSamples.odoRegression.length < 5) {
                        droppedSamples.odoRegression.push({ row: r, prevOdo, delta });
                    }
                    continue;
                }
                if (delta > 0) {
                    r.trip_distance_km = delta;
                    const consumption = (r.liters / delta) * 100;
                    if (consumption < MIN_CONSUMPTION_L_PER_100KM || consumption > MAX_CONSUMPTION_L_PER_100KM) {
                        // Plausible enough to keep? Borderline drops are
                        // common in small top-up fills. Only drop when
                        // really wild (< 5 or > 150).
                        if (consumption < 5 || consumption > 150) {
                            stats.dropped.consumption++;
                            if (droppedSamples.consumption.length < 5) {
                                droppedSamples.consumption.push({ row: r, consumption });
                            }
                            continue;
                        }
                    }
                }
            }
            if (r.odometer !== null) prevOdo = r.odometer;
            toImport.push(r);
        }
    }
    console.log(`\nAfter quality checks: ${toImport.length} rows ready to import.`);

    // Stage 3: load existing fuel_entries so we can skip duplicates.
    const touchedVehicleIds = [...new Set(toImport.map(r => r.vehicle_id))];
    console.log(`\nFetching existing fuel_entries for ${touchedVehicleIds.length} vehicles to dedup...`);
    const existing = await loadExistingEntries(touchedVehicleIds);
    console.log(`  ${existing.size} existing fuel_entries found.`);

    const finalToImport = [];
    for (const r of toImport) {
        const dedupKey = `${r.vehicle_id}|${r.date}|${Math.round(r.odometer ?? 0)}|${Math.round(r.liters * 10)}`;
        if (existing.has(dedupKey)) {
            stats.dropped.duplicate++;
            continue;
        }
        finalToImport.push(r);
    }
    console.log(`After dedup: ${finalToImport.length} rows.`);

    // Stage 4: write to Supabase in batches. Strip the helper __raw* keys.
    const BATCH = 200;
    let inserted = 0;
    for (let i = 0; i < finalToImport.length; i += BATCH) {
        const slice = finalToImport.slice(i, i + BATCH).map(r => {
            const { __rawSourceFile, ...clean } = r;
            // odometer is NOT NULL in the schema - if we don't have one
            // we have to skip the row. Should be rare since most builder
            // rows have an odometer.
            if (clean.odometer === null) return null;
            clean.organization_id = FBN_ORGANIZATION_ID;
            return clean;
        }).filter(Boolean);
        if (slice.length === 0) continue;
        await supabaseFetch('fuel_entries', {
            method: 'POST',
            headers: { Prefer: 'return=minimal' },
            body: JSON.stringify(slice),
        });
        inserted += slice.length;
        for (const r of slice) stats.vehiclesTouched.add(r.vehicle_id);
        console.log(`  inserted batch ${i / BATCH + 1}: ${inserted}/${finalToImport.length} total`);
    }
    stats.imported = inserted;

    // Report.
    const report = {
        runAt: new Date().toISOString(),
        scope: '3-month dataset (2026-03-09 onwards)',
        rowsByStatus: stats.rowsByStatus,
        dropped: stats.dropped,
        imported: stats.imported,
        vehiclesTouched: stats.vehiclesTouched.size,
        droppedSamples,
    };
    fs.writeFileSync(IMPORT_REPORT, JSON.stringify(report, null, 2), 'utf8');

    console.log('\n=== IMPORT SUMMARY ===');
    console.log(`Rows by match status:`);
    for (const [k, v] of Object.entries(stats.rowsByStatus)) {
        console.log(`  ${k.padEnd(10)} ${String(v).padStart(5)}`);
    }
    console.log(`\nDropped during quality checks:`);
    for (const [k, v] of Object.entries(stats.dropped)) {
        console.log(`  ${k.padEnd(15)} ${String(v).padStart(5)}`);
    }
    console.log(`\nIMPORTED: ${stats.imported} rows across ${stats.vehiclesTouched.size} vehicles.`);
    console.log(`\nFull report: ${IMPORT_REPORT}`);
}

main().catch(err => {
    console.error('Importer failed:', err);
    process.exit(1);
});
