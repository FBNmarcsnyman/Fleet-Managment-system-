// Fuel-log consolidator.
//
// Takes the in-scope spreadsheets identified by the crawler, parses each
// one according to its shape (master file vs monthly-bowser vs per-vehicle
// tab), and emits two arrays of canonical rows:
//
//   fuelLog:        one row per fuel-up at a vehicle (date, branch, fleet#,
//                   reg, driver, odometer, litres, source, R amount, src file)
//   bowserLedger:   one row per bowser in/out movement (date, branch,
//                   reading A, reading B, litres, R/L, value, drop, balance)
//
// Output is written to scripts/fuel-log-builder-output.json so we can
// inspect the rows BEFORE pushing them up to the Google Sheet. Once
// verified, scripts/fuel-log-publisher.mjs (to be written) will create
// the target Google Sheet and upload these rows.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { google } from 'googleapis';
import * as XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const KEY_PATH = path.resolve(__dirname, '../API KEYS/my-project-1539177112819-5db5fe898c97.json');
const SHARED_DRIVE_ID = '0APDmG-2unJLaUk9PVA';
const CRAWLER_REPORT = path.resolve(__dirname, './fuel-log-crawler-report.json');
const OUTPUT = path.resolve(__dirname, './fuel-log-builder-output.json');

const MIME_GSHEET = 'application/vnd.google-apps.spreadsheet';
const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const auth = new google.auth.GoogleAuth({
    keyFile: KEY_PATH,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
});

// ---- helpers ---------------------------------------------------------------

// Excel date serial -> ISO yyyy-mm-dd. The Excel epoch is 1899-12-30
// (Lotus 1-2-3 bug compatibility); supports both 1900- and 1904-base
// workbooks via the wb's wbprops if needed (not common for FBN files).
const excelSerialToISO = (n) => {
    if (typeof n !== 'number' || !isFinite(n) || n < 1) return null;
    const ms = Math.round((n - 25569) * 86400 * 1000);
    const d = new Date(ms);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
};

const parseNumber = (v) => {
    if (typeof v === 'number') return v;
    if (typeof v !== 'string') return null;
    const cleaned = v.replace(/[^\d.\-]/g, '');
    if (!cleaned) return null;
    const n = parseFloat(cleaned);
    return isFinite(n) ? n : null;
};

const normaliseReg = (s) => (s ?? '').toString().toUpperCase().replace(/[^A-Z0-9]/g, '');

// Branch inferred from the filename. Marc names monthly files like
// "FUEL CONS. JHB BOWSER JUNE 2026.xls" or "CONSUMPT DBN JAN. 2026.xls".
const branchFromFilename = (fileName) => {
    const upper = fileName.toUpperCase();
    if (/\bLOADMASTER\b|\bLM\b/.test(upper)) return 'LOADMASTER';
    if (/\bJHB\b|\bJOHANNESBURG\b/.test(upper)) return 'FBN JHB';
    if (/\bDBN\b|\bDURBAN\b/.test(upper)) return 'FBN DBN';
    if (/\bCPT\b|\bCAPE TOWN\b/.test(upper)) return 'FBN CPT';
    return null;
};

// ---- file fetchers ---------------------------------------------------------

async function fetchExcelBuffer(drive, fileId) {
    const res = await drive.files.get(
        { fileId, alt: 'media', supportsAllDrives: true },
        { responseType: 'arraybuffer' },
    );
    return Buffer.from(res.data);
}

async function fetchGoogleSheetAsXlsx(drive, fileId) {
    const res = await drive.files.export(
        { fileId, mimeType: MIME_XLSX },
        { responseType: 'arraybuffer' },
    );
    return Buffer.from(res.data);
}

// ---- parsers ---------------------------------------------------------------

// MASTER FILE: Fleet Managment Data.xlsx. R1 has canonical column names
// repeated twice side-by-side (cols 0-7 + cols 14-21) - probably JHB on
// the left and a second branch on the right, with the data already
// normalised. We extract from both halves.
function parseMasterFile(wb, fileName, modifiedTime) {
    const out = [];
    for (const tabName of wb.SheetNames) {
        const sheet = wb.Sheets[tabName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: '' });
        if (rows.length < 3) continue;

        // R1 (zero-indexed) holds: Fleet Number, Vehicle Registration,
        // Date, Odometer, Liters, Depot, Liters, Depot, Liters...
        // R0 has vehicle metadata above each block. Real data starts R2.
        const header = rows[1].map(c => (c ?? '').toString().trim().toLowerCase());

        // Find every "fleet number" column - each marks the start of a
        // block. Adjacent columns are reg / date / odo / liters / depot.
        const blockStarts = [];
        header.forEach((h, i) => {
            if (h === 'fleet number') blockStarts.push(i);
        });

        for (const bs of blockStarts) {
            // Inside the block, locate each canonical column by name so
            // we're robust to layout drift between halves of the sheet.
            const cols = {
                fleet: bs,
                reg: bs + 1,
                date: bs + 2,
                odo: bs + 3,
                lts: bs + 4,
                depot: bs + 5,
            };
            // Sanity check headers within the block (allow blanks).
            const h = (i) => (header[i] ?? '').trim().toLowerCase();
            if (h(cols.reg) !== 'vehicle registration') continue;
            if (h(cols.date) !== 'date') continue;

            for (let r = 2; r < rows.length; r++) {
                const row = rows[r];
                if (!row) continue;
                const reg = (row[cols.reg] ?? '').toString().trim();
                const date = row[cols.date];
                const litres = parseNumber(row[cols.lts]);
                const odo = parseNumber(row[cols.odo]);
                const fleet = (row[cols.fleet] ?? '').toString().trim();
                const depot = (row[cols.depot] ?? '').toString().trim().toUpperCase();
                if (!reg && !fleet && !date && !litres) continue;
                out.push({
                    date: typeof date === 'number' ? excelSerialToISO(date) : (date ? String(date) : null),
                    branch: depot === 'JHB' ? 'FBN JHB' : depot === 'DBN' ? 'FBN DBN' : depot === 'CPT' ? 'FBN CPT' : depot === 'LM' || depot === 'LOADMASTER' ? 'LOADMASTER' : null,
                    fleetNumber: fleet || null,
                    vehicleReg: reg || null,
                    vehicleRegNormalised: normaliseReg(reg),
                    driver: null,
                    odometer: odo,
                    litres,
                    source: 'PUMP', // master file doesn't distinguish; default to pump
                    randValue: null,
                    sourceFile: fileName,
                    sourceTab: tabName,
                    sourceRow: r + 1, // 1-indexed for human cross-reference
                    fileModified: modifiedTime,
                });
            }
        }
    }
    return out;
}

// MONTHLY BOWSER FILE: tabs include BOWSER, SUMMARY, LOADMASTER (LM
// branch only), and one tab per vehicle named with the reg.
//
// BOWSER tab structure (rows 2+ after R0/R1 are titles, R2 is column
// labels, R3 is sub-labels, R4+ is data):
//   DATE | VEHICLE | READING A | READING B | LITRES | PRICE | VALUE | DROP | BALANCE | ...
//
// Per-vehicle tab structure varies, but typically:
//   R0: vehicle description (driver, make/model)
//   R1: per-source column headers (FUEL DBN, FUEL JHB, KMS, LTRS, AFT, ...)
//   R2: sub-headers
//   R3+: data, column A is DATE (excel serial)

function parseBowserTab(sheet, fileName, tabName, branch, modifiedTime) {
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: '' });
    if (rows.length < 5) return [];
    // Look for the column-label row by finding "DATE" in column A.
    let hdrIdx = -1;
    for (let i = 0; i < Math.min(10, rows.length); i++) {
        if ((rows[i][0] ?? '').toString().toUpperCase().trim() === 'DATE') {
            hdrIdx = i;
            break;
        }
    }
    if (hdrIdx < 0) return [];
    const out = [];
    for (let r = hdrIdx + 2; r < rows.length; r++) {
        const row = rows[r];
        if (!row) continue;
        const date = row[0];
        if (typeof date !== 'number' || date < 30000) continue;
        out.push({
            date: excelSerialToISO(date),
            branch,
            vehicle: (row[1] ?? '').toString().trim() || null,
            readingA: parseNumber(row[2]),
            readingB: parseNumber(row[3]),
            litres: parseNumber(row[4]),
            pricePerLitre: parseNumber(row[5]),
            value: parseNumber(row[6]),
            drop: parseNumber(row[7]),
            balance: parseNumber(row[8]),
            sourceFile: fileName,
            sourceTab: tabName,
            sourceRow: r + 1,
            fileModified: modifiedTime,
        });
    }
    return out;
}

function parsePerVehicleTab(sheet, fileName, tabName, branch, modifiedTime) {
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: '' });
    if (rows.length < 5) return [];
    // tabName is usually the vehicle registration. Driver name lives at
    // row 0 column 0. Find the DATE header row to anchor the data.
    let hdrIdx = -1;
    for (let i = 0; i < Math.min(10, rows.length); i++) {
        if ((rows[i][0] ?? '').toString().toUpperCase().trim() === 'DATE') {
            hdrIdx = i;
            break;
        }
    }
    if (hdrIdx < 0) return [];
    const header = rows[hdrIdx].map(c => (c ?? '').toString().trim().toUpperCase());

    // Column locations - look for the headers we care about. Layout
    // varies between files so we search by name. Common labels seen:
    //   FUEL DBN | FUEL JHB | TOT KMS | LTRS | AFT | KMS | DBN INV | JHB INV
    const findCol = (...needles) => header.findIndex(h => needles.some(n => h.includes(n)));
    const cols = {
        kms: findCol('TOT KMS', 'KMS'),
        ltrsTotal: findCol('LTRS', 'LITRES'),
        ltrsDbn: findCol('FUEL DBN', 'LTRS DBN', 'DBN'),
        ltrsJhb: findCol('FUEL JHB', 'LTRS JHB', 'JHB'),
        rebate: findCol('AFT', 'REB'),
    };
    const driver = (rows[0]?.[0] ?? '').toString().trim() || null;
    const vehicleReg = tabName.trim();
    const out = [];
    for (let r = hdrIdx + 2; r < rows.length; r++) {
        const row = rows[r];
        if (!row) continue;
        const date = row[0];
        if (typeof date !== 'number' || date < 30000) continue;
        const totalLitres = cols.ltrsTotal >= 0 ? parseNumber(row[cols.ltrsTotal]) : null;
        const litresDbn = cols.ltrsDbn >= 0 ? parseNumber(row[cols.ltrsDbn]) : null;
        const litresJhb = cols.ltrsJhb >= 0 ? parseNumber(row[cols.ltrsJhb]) : null;
        const odometer = cols.kms >= 0 ? parseNumber(row[cols.kms]) : null;
        // Emit one row per non-zero litre source so the canonical log
        // distinguishes which depot's pump filled the vehicle.
        const candidates = [
            { litres: litresDbn, source: 'PUMP', branchOverride: 'FBN DBN' },
            { litres: litresJhb, source: 'PUMP', branchOverride: 'FBN JHB' },
        ];
        let anyEmitted = false;
        for (const c of candidates) {
            if (c.litres && c.litres > 0) {
                out.push({
                    date: excelSerialToISO(date),
                    branch: c.branchOverride,
                    fleetNumber: null,
                    vehicleReg,
                    vehicleRegNormalised: normaliseReg(vehicleReg),
                    driver,
                    odometer,
                    litres: c.litres,
                    source: c.source,
                    randValue: null,
                    sourceFile: fileName,
                    sourceTab: tabName,
                    sourceRow: r + 1,
                    fileModified: modifiedTime,
                });
                anyEmitted = true;
            }
        }
        if (!anyEmitted && totalLitres && totalLitres > 0) {
            out.push({
                date: excelSerialToISO(date),
                branch,
                fleetNumber: null,
                vehicleReg,
                vehicleRegNormalised: normaliseReg(vehicleReg),
                driver,
                odometer,
                litres: totalLitres,
                source: 'PUMP',
                randValue: null,
                sourceFile: fileName,
                sourceTab: tabName,
                sourceRow: r + 1,
                fileModified: modifiedTime,
            });
        }
    }
    return out;
}

function parseMonthlyFuelFile(wb, fileName, modifiedTime) {
    const branchFromName = branchFromFilename(fileName);
    const fuelRows = [];
    const bowserRows = [];
    for (const tabName of wb.SheetNames) {
        const sheet = wb.Sheets[tabName];
        const upperTab = tabName.toUpperCase().trim();
        if (upperTab === 'BOWSER') {
            bowserRows.push(...parseBowserTab(sheet, fileName, tabName, branchFromName, modifiedTime));
        } else if (upperTab === 'SUMMARY' || upperTab === 'LOADMASTER' || upperTab.includes('TRIP')) {
            // Skip - summary/aggregate tabs, we get per-vehicle detail from the dedicated tabs
            continue;
        } else if (/^[A-Z0-9 \-/.]+$/i.test(tabName) && tabName.length <= 16) {
            // Likely a per-vehicle tab (registration as name).
            fuelRows.push(...parsePerVehicleTab(sheet, fileName, tabName, branchFromName, modifiedTime));
        }
    }
    return { fuelRows, bowserRows };
}

// ---- runner ----------------------------------------------------------------

async function main() {
    if (!fs.existsSync(CRAWLER_REPORT)) {
        throw new Error(`Crawler report not found at ${CRAWLER_REPORT}. Run scripts/fuel-log-crawler.mjs first.`);
    }
    const report = JSON.parse(fs.readFileSync(CRAWLER_REPORT, 'utf8'));
    console.log(`Loaded crawler report: ${report.length} files in scope.`);

    const client = await auth.getClient();
    const drive = google.drive({ version: 'v3', auth: client });

    // For each in-scope file, re-download (faster than re-doing the full
    // crawler crawl since we already know the file ids) and run the
    // appropriate parser. The crawler report has parentPath + file +
    // kind; we need the fileId. The report does NOT currently include
    // ids, so we re-list to map name+path -> id.
    //
    // Cheaper: store ids in the crawler report next time. For this first
    // pass, re-list quickly.
    const idLookup = await loadDriveIds(drive);
    console.log(`Loaded ${idLookup.size} fileId entries from Drive listing.`);

    const fuelLog = [];
    const bowserLedger = [];
    let processed = 0;
    let errors = 0;

    for (const entry of report) {
        if (entry.error) continue;
        const key = `${entry.parentPath}${entry.file}`;
        const meta = idLookup.get(key);
        if (!meta) {
            console.warn(`  no fileId for ${key} - skipping`);
            continue;
        }
        try {
            const buf = entry.kind === 'excel'
                ? await fetchExcelBuffer(drive, meta.id)
                : await fetchGoogleSheetAsXlsx(drive, meta.id);
            const wb = XLSX.read(buf, { type: 'buffer' });

            // Master file detected by name
            if (entry.file.toLowerCase().includes('fleet managment data')) {
                const rows = parseMasterFile(wb, entry.file, entry.modifiedTime);
                fuelLog.push(...rows);
            } else if (/fuel cons|consumpt|bowser/i.test(entry.file)) {
                const { fuelRows, bowserRows } = parseMonthlyFuelFile(wb, entry.file, entry.modifiedTime);
                fuelLog.push(...fuelRows);
                bowserLedger.push(...bowserRows);
            } else {
                // Trip sheets and others - skip for now; will be a separate
                // pass since the schema is different.
            }
            processed++;
            if (processed % 10 === 0) {
                console.log(`  [${processed}] fuelLog=${fuelLog.length} bowserLedger=${bowserLedger.length}`);
            }
        } catch (err) {
            errors++;
            console.error(`  ERR ${entry.file}: ${err?.message || err}`);
        }
    }

    console.log(`\nParsed ${processed} files (${errors} errors).`);
    console.log(`  fuelLog rows:       ${fuelLog.length}`);
    console.log(`  bowserLedger rows:  ${bowserLedger.length}`);

    // De-dupe identical entries (same date + vehicle reg + litres + source file).
    const fuelKey = r => `${r.date}|${r.vehicleRegNormalised}|${r.litres}|${r.source}|${r.sourceFile}|${r.sourceTab}|${r.sourceRow}`;
    const dedup = new Map();
    for (const r of fuelLog) dedup.set(fuelKey(r), r);
    const fuelLogDedup = [...dedup.values()];

    fs.writeFileSync(OUTPUT, JSON.stringify({
        builtAt: new Date().toISOString(),
        sourceFilesProcessed: processed,
        errors,
        fuelLog: fuelLogDedup,
        bowserLedger,
    }, null, 2), 'utf8');
    console.log(`\nWrote ${fuelLogDedup.length} fuel-log rows + ${bowserLedger.length} bowser rows to ${OUTPUT}`);
}

async function loadDriveIds(drive) {
    const allFiles = [];
    let pageToken = undefined;
    do {
        const res = await drive.files.list({
            corpora: 'drive',
            driveId: SHARED_DRIVE_ID,
            includeItemsFromAllDrives: true,
            supportsAllDrives: true,
            q: 'trashed = false',
            fields: 'nextPageToken, files(id, name, mimeType, parents)',
            pageSize: 1000,
            pageToken,
        });
        allFiles.push(...(res.data.files || []));
        pageToken = res.data.nextPageToken;
    } while (pageToken);
    const folderById = new Map();
    folderById.set(SHARED_DRIVE_ID, '');
    for (const f of allFiles) {
        if (f.mimeType === 'application/vnd.google-apps.folder') folderById.set(f.id, f.name);
    }
    const folderParentById = new Map();
    for (const f of allFiles) {
        if (f.mimeType === 'application/vnd.google-apps.folder') {
            folderParentById.set(f.id, (f.parents && f.parents[0]) || SHARED_DRIVE_ID);
        }
    }
    const pathFor = (file) => {
        const segments = [];
        let cursor = (file.parents && file.parents[0]) || SHARED_DRIVE_ID;
        while (cursor && cursor !== SHARED_DRIVE_ID && folderById.has(cursor)) {
            segments.unshift(folderById.get(cursor));
            cursor = folderParentById.get(cursor);
        }
        return '/' + segments.join('/') + (segments.length ? '/' : '');
    };
    const out = new Map();
    for (const f of allFiles) {
        if (f.mimeType === 'application/vnd.google-apps.folder') continue;
        out.set(`${pathFor(f)}${f.name}`, { id: f.id });
    }
    return out;
}

main().catch(err => {
    console.error('Builder failed:', err);
    process.exit(1);
});
