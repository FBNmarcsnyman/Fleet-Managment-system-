// Fuel-log matcher.
//
// Takes the parsed fuel-log rows from fuel-log-builder-output.json,
// queries Supabase for the current FBN vehicle fleet, and attempts to
// match each row's Vehicle Registration to a real vehicle. Writes a
// "Matching Review" tab into the existing consolidated Sheet so Marc
// can see every row + its match status, sort/filter by category, and
// approve before any import to fuel_entries runs.
//
// Match categories per row:
//   MATCHED      - normalised reg exactly matches one vehicle in the DB
//   ALT          - reg fragment in parentheses matches (e.g. "BN98ZZZN
//                  (ND478395)" matches vehicle ND478395 even when the
//                  primary reg differs)
//   PROBABLE     - 1-2 char Hamming distance on equal-length normalised
//                  regs (likely typo)
//   AMBIGUOUS    - multiple PROBABLE candidates - needs human
//   UNMATCHED    - no vehicle within reach. Most are forklifts,
//                  generators, driver names, retired regs, or admin entries.
//
// Read/write to the SHARED DRIVE Sheet. Source spreadsheets are NEVER
// touched.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { google } from 'googleapis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const KEY_PATH = path.resolve(__dirname, '../API KEYS/my-project-1539177112819-5db5fe898c97.json');
const INPUT = path.resolve(__dirname, './fuel-log-builder-output.json');
const REPORT_OUT = path.resolve(__dirname, './fuel-log-matcher-report.json');

// Target Sheet: "FBN Fuel Log Clean - 2026-06-07"
const TARGET_SHEET_ID = '1Y8naCZCFnj8xSZIJg6JW01VykMkm0C0bhu7gkWnGTNI';

// Supabase config. Secret key is read from API KEYS/supabase-secret.txt
// (gitignored) or from the SUPABASE_SECRET env var. NEVER hardcode it
// here - GitHub Push Protection blocks the push and rightly so, since
// anyone with the secret can bypass RLS and read every row.
const SUPABASE_URL = 'https://kyosepbdxjwugunylvyo.supabase.co';
const SUPABASE_SECRET = (() => {
    const fromEnv = process.env.SUPABASE_SECRET;
    if (fromEnv) return fromEnv.trim();
    const secretPath = path.resolve(__dirname, '../API KEYS/supabase-secret.txt');
    if (fs.existsSync(secretPath)) return fs.readFileSync(secretPath, 'utf8').trim();
    throw new Error(`Supabase secret not found. Set SUPABASE_SECRET env var or save the key to ${secretPath}`);
})();

const auth = new google.auth.GoogleAuth({
    keyFile: KEY_PATH,
    scopes: [
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/spreadsheets',
    ],
});

const normaliseReg = (s) => (s ?? '').toString().toUpperCase().replace(/[^A-Z0-9]/g, '');

// Hamming distance for same-length strings, capped at 3 (returns 999 for
// distance > 2 so the caller can treat it as "too far"). For
// different-length strings returns 999.
function hamming(a, b) {
    if (a.length !== b.length) return 999;
    let d = 0;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
            d++;
            if (d > 2) return 999;
        }
    }
    return d;
}

async function fetchVehicles() {
    const url = `${SUPABASE_URL}/rest/v1/vehicles?select=id,name,registration,branch_id,status&limit=1000`;
    const res = await fetch(url, {
        headers: {
            apikey: SUPABASE_SECRET,
            Authorization: `Bearer ${SUPABASE_SECRET}`,
            'User-Agent': 'fbn-fuel-log-matcher/1.0',
        },
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Supabase fetch failed: ${res.status} ${text}`);
    }
    return res.json();
}

function buildVehicleIndex(vehicles) {
    // Build two lookups:
    //   - byNormReg: normalised primary reg -> vehicle (exact lookup)
    //   - byAltReg: for entries like "BN98ZZZN (ND478395)" stored in the
    //              vehicle's `name` field. We sweep for any 5+ alphanumeric
    //              substring inside parentheses anywhere in name + reg.
    const byNormReg = new Map();
    const allNormRegs = [];
    const altMap = new Map();
    for (const v of vehicles) {
        const norm = normaliseReg(v.registration);
        if (norm) {
            byNormReg.set(norm, v);
            allNormRegs.push({ norm, v });
        }
        // Look at name + registration both for parenthetical alts.
        const haystack = `${v.name ?? ''} ${v.registration ?? ''}`;
        for (const m of haystack.matchAll(/\(([^)]+)\)/g)) {
            const alt = normaliseReg(m[1]);
            if (alt && alt.length >= 5) altMap.set(alt, v);
        }
    }
    return { byNormReg, allNormRegs, altMap };
}

function matchRow(reg, index) {
    const raw = (reg ?? '').toString().trim();
    if (!raw) return { status: 'EMPTY', reason: 'no registration on row' };

    // 1. Exact normalised match on primary reg
    const norm = normaliseReg(raw);
    if (norm && index.byNormReg.has(norm)) {
        return { status: 'MATCHED', vehicle: index.byNormReg.get(norm), confidence: 'exact' };
    }

    // 2. Parenthetical: "BN98ZZZN (ND478395)" - try the inner part too
    for (const m of raw.matchAll(/\(([^)]+)\)/g)) {
        const inner = normaliseReg(m[1]);
        if (inner && index.byNormReg.has(inner)) {
            return { status: 'MATCHED', vehicle: index.byNormReg.get(inner), confidence: 'paren-primary' };
        }
        if (inner && index.altMap.has(inner)) {
            return { status: 'ALT', vehicle: index.altMap.get(inner), confidence: 'paren-alt' };
        }
    }

    // 3. Alt map: maybe the whole raw is a known alt
    if (norm && index.altMap.has(norm)) {
        return { status: 'ALT', vehicle: index.altMap.get(norm), confidence: 'alt' };
    }

    // 4. Fuzzy: 1-2 char Hamming distance against any primary reg
    const candidates = [];
    for (const { norm: vNorm, v } of index.allNormRegs) {
        if (vNorm.length !== norm.length) continue;
        const d = hamming(norm, vNorm);
        if (d <= 2) candidates.push({ distance: d, vehicle: v });
    }
    if (candidates.length === 0) return { status: 'UNMATCHED', reason: 'no candidate within Hamming 2' };
    candidates.sort((a, b) => a.distance - b.distance);
    if (candidates.length > 1 && candidates[0].distance === candidates[1].distance) {
        return { status: 'AMBIGUOUS', candidates, reason: `${candidates.length} candidates at distance ${candidates[0].distance}` };
    }
    return { status: 'PROBABLE', vehicle: candidates[0].vehicle, confidence: `hamming-${candidates[0].distance}` };
}

async function main() {
    console.log('Loading parsed fuel-log rows...');
    const built = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
    const fuelLog = built.fuelLog;
    console.log(`  ${fuelLog.length} fuel-log rows`);

    console.log('Fetching FBN vehicles from Supabase...');
    const vehicles = await fetchVehicles();
    console.log(`  ${vehicles.length} vehicles in DB`);
    const index = buildVehicleIndex(vehicles);

    console.log('Matching rows...');
    const buckets = { MATCHED: [], ALT: [], PROBABLE: [], AMBIGUOUS: [], UNMATCHED: [], EMPTY: [] };
    const uniqueRegs = new Map(); // raw reg -> { result, count }
    for (const row of fuelLog) {
        const raw = row.vehicleReg ?? '';
        if (!uniqueRegs.has(raw)) {
            uniqueRegs.set(raw, { result: matchRow(raw, index), count: 0 });
        }
        const entry = uniqueRegs.get(raw);
        entry.count++;
    }
    for (const [raw, { result, count }] of uniqueRegs) {
        buckets[result.status].push({ rawReg: raw, rowsAffected: count, result });
    }

    const summary = Object.fromEntries(
        Object.entries(buckets).map(([k, arr]) => [k, {
            uniqueRegs: arr.length,
            rowsAffected: arr.reduce((s, e) => s + e.rowsAffected, 0),
        }]),
    );
    console.log('\nMatch summary (by unique registration string):');
    for (const [k, v] of Object.entries(summary)) {
        console.log(`  ${k.padEnd(10)} - ${v.uniqueRegs.toString().padStart(4)} unique regs, ${v.rowsAffected.toString().padStart(5)} rows`);
    }

    fs.writeFileSync(REPORT_OUT, JSON.stringify({
        builtAt: new Date().toISOString(),
        summary,
        details: Object.fromEntries(Object.entries(buckets).map(([k, arr]) => [k, arr])),
    }, null, 2), 'utf8');
    console.log(`\nWrote detailed report to ${REPORT_OUT}`);

    // Write a "Matching Review" tab to the consolidated Sheet so Marc can
    // sort/filter by status without leaving Drive.
    console.log('\nWriting "Matching Review" tab to the consolidated Sheet...');
    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });

    // Build the rows: one per unique reg, sorted by status priority then
    // by row count desc so the most-impactful unmatched entries float to
    // the top.
    const statusOrder = { UNMATCHED: 0, AMBIGUOUS: 1, PROBABLE: 2, ALT: 3, MATCHED: 4, EMPTY: 5 };
    const allRows = [];
    for (const [statusKey, arr] of Object.entries(buckets)) {
        for (const e of arr) allRows.push({ statusKey, ...e });
    }
    allRows.sort((a, b) => {
        const so = statusOrder[a.statusKey] - statusOrder[b.statusKey];
        if (so !== 0) return so;
        return b.rowsAffected - a.rowsAffected;
    });

    const headerRow = [
        'Status',
        'Raw Registration',
        'Rows Affected',
        'Matched Vehicle Name',
        'Matched Vehicle Reg',
        'Vehicle ID',
        'Confidence / Reason',
        'Notes (for Marc to fill)',
    ];
    const sheetRows = [headerRow];
    for (const r of allRows) {
        const v = r.result.vehicle;
        sheetRows.push([
            r.statusKey,
            r.rawReg,
            r.rowsAffected,
            v?.name ?? '',
            v?.registration ?? '',
            v?.id ?? '',
            r.result.confidence ?? r.result.reason ?? '',
            '',
        ]);
    }

    // Make sure the tab exists; recreate it (delete then add) so re-runs
    // produce a fresh review without merging stale rows.
    const meta = await sheets.spreadsheets.get({ spreadsheetId: TARGET_SHEET_ID });
    const existing = meta.data.sheets.find(s => s.properties.title === 'Matching Review');
    const requests = [];
    if (existing) {
        requests.push({ deleteSheet: { sheetId: existing.properties.sheetId } });
    }
    requests.push({
        addSheet: {
            properties: {
                title: 'Matching Review',
                gridProperties: { rowCount: sheetRows.length + 10, columnCount: headerRow.length },
            },
        },
    });
    await sheets.spreadsheets.batchUpdate({
        spreadsheetId: TARGET_SHEET_ID,
        requestBody: { requests },
    });

    // Write the data.
    await sheets.spreadsheets.values.update({
        spreadsheetId: TARGET_SHEET_ID,
        range: 'Matching Review!A1',
        valueInputOption: 'RAW',
        requestBody: { values: sheetRows },
    });

    // Freeze header + bold + colour-code the Status column. Look up
    // the new tab's sheetId from a fresh metadata fetch.
    const meta2 = await sheets.spreadsheets.get({ spreadsheetId: TARGET_SHEET_ID });
    const reviewTab = meta2.data.sheets.find(s => s.properties.title === 'Matching Review');
    await sheets.spreadsheets.batchUpdate({
        spreadsheetId: TARGET_SHEET_ID,
        requestBody: {
            requests: [
                {
                    updateSheetProperties: {
                        properties: {
                            sheetId: reviewTab.properties.sheetId,
                            gridProperties: { frozenRowCount: 1 },
                        },
                        fields: 'gridProperties.frozenRowCount',
                    },
                },
                {
                    repeatCell: {
                        range: { sheetId: reviewTab.properties.sheetId, startRowIndex: 0, endRowIndex: 1 },
                        cell: { userEnteredFormat: { textFormat: { bold: true } } },
                        fields: 'userEnteredFormat.textFormat.bold',
                    },
                },
                // Red tint for UNMATCHED rows so Marc's eye goes there first.
                {
                    addConditionalFormatRule: {
                        rule: {
                            ranges: [{
                                sheetId: reviewTab.properties.sheetId,
                                startRowIndex: 1,
                                endRowIndex: sheetRows.length,
                                startColumnIndex: 0,
                                endColumnIndex: headerRow.length,
                            }],
                            booleanRule: {
                                condition: {
                                    type: 'CUSTOM_FORMULA',
                                    values: [{ userEnteredValue: '=$A2="UNMATCHED"' }],
                                },
                                format: { backgroundColor: { red: 0.95, green: 0.78, blue: 0.78 } },
                            },
                        },
                        index: 0,
                    },
                },
                // Yellow tint for PROBABLE / AMBIGUOUS - "needs your eye".
                {
                    addConditionalFormatRule: {
                        rule: {
                            ranges: [{
                                sheetId: reviewTab.properties.sheetId,
                                startRowIndex: 1,
                                endRowIndex: sheetRows.length,
                                startColumnIndex: 0,
                                endColumnIndex: headerRow.length,
                            }],
                            booleanRule: {
                                condition: {
                                    type: 'CUSTOM_FORMULA',
                                    values: [{ userEnteredValue: '=OR($A2="PROBABLE",$A2="AMBIGUOUS")' }],
                                },
                                format: { backgroundColor: { red: 1, green: 0.95, blue: 0.75 } },
                            },
                        },
                        index: 1,
                    },
                },
                // Green for MATCHED / ALT.
                {
                    addConditionalFormatRule: {
                        rule: {
                            ranges: [{
                                sheetId: reviewTab.properties.sheetId,
                                startRowIndex: 1,
                                endRowIndex: sheetRows.length,
                                startColumnIndex: 0,
                                endColumnIndex: headerRow.length,
                            }],
                            booleanRule: {
                                condition: {
                                    type: 'CUSTOM_FORMULA',
                                    values: [{ userEnteredValue: '=OR($A2="MATCHED",$A2="ALT")' }],
                                },
                                format: { backgroundColor: { red: 0.85, green: 0.95, blue: 0.85 } },
                            },
                        },
                        index: 2,
                    },
                },
            ],
        },
    });

    console.log(`Done. Open the Sheet, switch to "Matching Review" tab:`);
    console.log(`  https://docs.google.com/spreadsheets/d/${TARGET_SHEET_ID}/edit`);
}

main().catch(err => {
    console.error('Matcher failed:', err);
    process.exit(1);
});
