// Fuel-log publisher.
//
// Takes the parsed fuel-log + bowser-ledger rows produced by
// scripts/fuel-log-builder.mjs and writes them to a NEW Google Sheet in
// the FUEL Shared Drive. Never touches the source files.
//
// The new Sheet is named "FBN Fuel Log Clean - <yyyy-mm-dd>" so each run
// is a distinct file (we don't overwrite a prior consolidation - Marc can
// pick which one to keep).
//
// Two tabs:
//   Fuel Log:       one row per vehicle fill (date, branch, fleet#, reg,
//                   driver, odometer, litres, source, R value, src file/tab/row)
//   Bowser Ledger:  one row per bowser tank movement (date, branch,
//                   reading A, reading B, litres, R/L, value, drop, balance)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { google } from 'googleapis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const KEY_PATH = path.resolve(__dirname, '../API KEYS/my-project-1539177112819-5db5fe898c97.json');
const SHARED_DRIVE_ID = '0APDmG-2unJLaUk9PVA';
const INPUT = path.resolve(__dirname, './fuel-log-builder-output.json');

const auth = new google.auth.GoogleAuth({
    keyFile: KEY_PATH,
    scopes: [
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/spreadsheets',
    ],
});

// Column layout (1-indexed):
//   A  Date
//   B  Branch
//   C  Fleet Number
//   D  Vehicle Registration   <- rows sorted by this then Date asc
//   E  Driver
//   F  Opening Odo            <- formula: previous row's Closing if same vehicle
//   G  Closing Odo            <- the recorded reading
//   H  Trip KM                <- formula: G - F
//   I  Litres
//   J  L/100km                <- formula: I / H * 100
//   K  Source                 (BOWSER / PUMP / REB)
//   L  Rand Value
//   M  R/L                    <- formula: L / I
//   N  Source File
//   O  Source Tab
//   P  Source Row
const FUEL_LOG_HEADERS = [
    'Date',
    'Branch',
    'Fleet Number',
    'Vehicle Registration',
    'Driver',
    'Opening Odo',
    'Closing Odo',
    'Trip KM',
    'Litres',
    'L/100km',
    'Source',
    'Rand Value',
    'R/L',
    'Source File',
    'Source Tab',
    'Source Row',
];

const BOWSER_LEDGER_HEADERS = [
    'Date',
    'Branch',
    'Vehicle',
    'Reading A',
    'Reading B',
    'Litres',
    'Price per Litre',
    'Value',
    'Drop',
    'Balance',
    'Source File',
    'Source Tab',
    'Source Row',
];

function fuelRowToCells(r, sheetRowNum) {
    // Opening = previous row's Closing if same vehicle reg, else blank.
    // Sheet is sorted by vehicle reg + date so the "previous row" check
    // is just the row above. First row of data (sheetRowNum === 2) has
    // no previous so opening is blank.
    const openingFormula = sheetRowNum >= 3
        ? `=IF(D${sheetRowNum}=D${sheetRowNum - 1}, G${sheetRowNum - 1}, "")`
        : '';
    // Trip KM = Closing - Opening when both present.
    const tripFormula = `=IF(AND(F${sheetRowNum}<>"", G${sheetRowNum}<>""), G${sheetRowNum}-F${sheetRowNum}, "")`;
    // L/100km = Litres / Trip KM * 100 when trip > 0.
    const consumptionFormula = `=IFERROR(IF(AND(H${sheetRowNum}>0, I${sheetRowNum}>0), I${sheetRowNum}/H${sheetRowNum}*100, ""), "")`;
    // R/L = Rand Value / Litres when both present.
    const rPerLFormula = `=IFERROR(IF(AND(I${sheetRowNum}>0, L${sheetRowNum}>0), L${sheetRowNum}/I${sheetRowNum}, ""), "")`;
    return [
        r.date ?? '',
        r.branch ?? '',
        r.fleetNumber ?? '',
        r.vehicleReg ?? '',
        r.driver ?? '',
        openingFormula,
        r.odometer ?? '',
        tripFormula,
        r.litres ?? '',
        consumptionFormula,
        r.source ?? '',
        r.randValue ?? '',
        rPerLFormula,
        r.sourceFile ?? '',
        r.sourceTab ?? '',
        r.sourceRow ?? '',
    ];
}

function bowserRowToCells(r) {
    return [
        r.date ?? '',
        r.branch ?? '',
        r.vehicle ?? '',
        r.readingA ?? '',
        r.readingB ?? '',
        r.litres ?? '',
        r.pricePerLitre ?? '',
        r.value ?? '',
        r.drop ?? '',
        r.balance ?? '',
        r.sourceFile ?? '',
        r.sourceTab ?? '',
        r.sourceRow ?? '',
    ];
}

async function main() {
    if (!fs.existsSync(INPUT)) {
        throw new Error(`Builder output not found at ${INPUT}. Run scripts/fuel-log-builder.mjs first.`);
    }
    const data = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
    console.log(`Loaded ${data.fuelLog.length} fuel-log rows + ${data.bowserLedger.length} bowser rows from builder output.`);

    const client = await auth.getClient();
    const drive = google.drive({ version: 'v3', auth: client });
    const sheets = google.sheets({ version: 'v4', auth: client });

    const today = new Date().toISOString().slice(0, 10);
    const sheetName = `FBN Fuel Log Clean - ${today}`;
    console.log(`Creating new Sheet "${sheetName}" in FUEL Shared Drive...`);

    const created = await drive.files.create({
        supportsAllDrives: true,
        requestBody: {
            name: sheetName,
            mimeType: 'application/vnd.google-apps.spreadsheet',
            parents: [SHARED_DRIVE_ID],
        },
        fields: 'id, webViewLink',
    });
    const spreadsheetId = created.data.id;
    console.log(`Created: ${created.data.webViewLink}`);

    // Rename the default tab to "Fuel Log" and add a "Bowser Ledger" tab.
    // Pre-expand both tabs to fit the full dataset BEFORE writing, since
    // values.update will not auto-expand the grid (new sheets cap at
    // 1000 rows by default and the publisher's first attempt died at
    // row 2001 on a "Range exceeds grid limits" error).
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const defaultTabId = meta.data.sheets[0].properties.sheetId;
    const fuelRowsNeeded = data.fuelLog.length + 10; // +headers + buffer
    const bowserRowsNeeded = data.bowserLedger.length + 10;
    await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
            requests: [
                {
                    updateSheetProperties: {
                        properties: {
                            sheetId: defaultTabId,
                            title: 'Fuel Log',
                            gridProperties: { rowCount: fuelRowsNeeded, columnCount: FUEL_LOG_HEADERS.length },
                        },
                        fields: 'title,gridProperties.rowCount,gridProperties.columnCount',
                    },
                },
                {
                    addSheet: {
                        properties: {
                            title: 'Bowser Ledger',
                            gridProperties: { rowCount: bowserRowsNeeded, columnCount: BOWSER_LEDGER_HEADERS.length },
                        },
                    },
                },
            ],
        },
    });

    const CHUNK = 2000;

    // Sort by vehicle registration (normalised: strip spaces + uppercase
    // for stable grouping when source data has inconsistent spacing)
    // then by date ascending. Each vehicle's fills end up contiguous and
    // chronological, which is what makes the Opening Odo / Trip KM /
    // L/100km formulas work row-to-row.
    const normReg = s => (s ?? '').toString().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const sortedFuelLog = [...data.fuelLog].sort((a, b) => {
        const ra = normReg(a.vehicleReg);
        const rb = normReg(b.vehicleReg);
        if (ra !== rb) return ra.localeCompare(rb);
        return (a.date ?? '').localeCompare(b.date ?? '');
    });
    console.log(`Writing Fuel Log: ${sortedFuelLog.length} rows (sorted by vehicle + date)...`);
    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'Fuel Log!A1',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [FUEL_LOG_HEADERS] },
    });
    for (let i = 0; i < sortedFuelLog.length; i += CHUNK) {
        const slice = sortedFuelLog.slice(i, i + CHUNK).map((r, idx) => fuelRowToCells(r, 2 + i + idx));
        const startRow = 2 + i;
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `Fuel Log!A${startRow}`,
            // USER_ENTERED so formulas (=IF(...) etc.) get parsed, not
            // stored as literal strings. RAW would keep "=IF..." as text.
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: slice },
        });
        console.log(`  Fuel Log rows ${i + 1}-${i + slice.length} written.`);
    }

    console.log(`Writing Bowser Ledger: ${data.bowserLedger.length} rows...`);
    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'Bowser Ledger!A1',
        valueInputOption: 'RAW',
        requestBody: { values: [BOWSER_LEDGER_HEADERS] },
    });
    for (let i = 0; i < data.bowserLedger.length; i += CHUNK) {
        const slice = data.bowserLedger.slice(i, i + CHUNK).map(bowserRowToCells);
        const startRow = 2 + i;
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `Bowser Ledger!A${startRow}`,
            valueInputOption: 'RAW',
            requestBody: { values: slice },
        });
        console.log(`  Bowser Ledger rows ${i + 1}-${i + slice.length} written.`);
    }

    // Freeze header row + auto-resize first columns.
    const updatedMeta = await sheets.spreadsheets.get({ spreadsheetId });
    const fuelLogTab = updatedMeta.data.sheets.find(s => s.properties.title === 'Fuel Log');
    const bowserTab = updatedMeta.data.sheets.find(s => s.properties.title === 'Bowser Ledger');
    await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
            requests: [
                {
                    updateSheetProperties: {
                        properties: {
                            sheetId: fuelLogTab.properties.sheetId,
                            gridProperties: { frozenRowCount: 1 },
                        },
                        fields: 'gridProperties.frozenRowCount',
                    },
                },
                {
                    updateSheetProperties: {
                        properties: {
                            sheetId: bowserTab.properties.sheetId,
                            gridProperties: { frozenRowCount: 1 },
                        },
                        fields: 'gridProperties.frozenRowCount',
                    },
                },
                {
                    repeatCell: {
                        range: { sheetId: fuelLogTab.properties.sheetId, startRowIndex: 0, endRowIndex: 1 },
                        cell: { userEnteredFormat: { textFormat: { bold: true } } },
                        fields: 'userEnteredFormat.textFormat.bold',
                    },
                },
                {
                    repeatCell: {
                        range: { sheetId: bowserTab.properties.sheetId, startRowIndex: 0, endRowIndex: 1 },
                        cell: { userEnteredFormat: { textFormat: { bold: true } } },
                        fields: 'userEnteredFormat.textFormat.bold',
                    },
                },
            ],
        },
    });

    console.log(`\nDone. New Google Sheet:`);
    console.log(`  ${created.data.webViewLink}`);
    console.log(`\nThe Sheet lives in the FUEL Shared Drive. Source files were not modified.`);
}

main().catch(err => {
    console.error('Publisher failed:', err);
    process.exit(1);
});
