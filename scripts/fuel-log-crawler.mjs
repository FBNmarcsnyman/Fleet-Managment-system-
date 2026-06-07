// Fuel-log discovery crawler v2.
//
// Walks the "FUEL" Shared Drive (id 0APDmG-2unJLaUk9PVA), downloads every
// spreadsheet, and prints a column-mapping report so we can design the
// canonical clean schema based on what's actually there.
//
// Handles BOTH:
//   - Native Google Sheets (mimeType application/vnd.google-apps.spreadsheet)
//   - Excel files (.xlsx, .xls) - majority of Marc's source files
//
// READ-ONLY by design: only drive.files.list + drive.files.get(alt=media).
// The source sheets cannot be modified by this tool no matter what.
//
// Run with: node scripts/fuel-log-crawler.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { google } from 'googleapis';
import * as XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const KEY_PATH = path.resolve(__dirname, '../API KEYS/my-project-1539177112819-5db5fe898c97.json');
const SHARED_DRIVE_ID = '0APDmG-2unJLaUk9PVA';
const HEADER_SNIFF_ROWS = 8;

// Scope: only consolidate files under these folder-path prefixes. Marc
// confirmed JHB DIESEL + DBN DIESEL + the master file + recent trip sheets.
// Excludes the explicitly-marked-do-not-use OLD FLINERS tree, the
// duplicated /MARTI DOCS/My Documents/ copies, and the ORDERS DBN purchase-
// order folder (not fuel data).
const ALLOWED_PATH_PREFIXES = [
    '/JHB DIESEL',
    '/DBN DIESEL',
    '/FREIGHTLINER KMS TRAVELLED',
    '/MARTI DOCS/TRIPSHEETS/TRIP SHEETS 2023',
    '/MARTI DOCS/TRIPSHEETS/TRIP SHEETS 2024',
    '/MARTI DOCS/TRIPSHEETS/TRIPSHEETS 2025',
];
const EXCLUDED_PATH_SUBSTRINGS = [
    'DO NOT USE',
    '/MARTI DOCS/My Documents',
    '/OLD FLINERS',
];
// Last-3-years cutoff: files modified before this are skipped.
const MODIFIED_AFTER = '2023-06-06';

// Concurrent downloads. 5 in flight keeps the Drive API happy and gets
// through ~150 files in a few minutes instead of an hour.
const DOWNLOAD_CONCURRENCY = 5;

const MIME_GSHEET = 'application/vnd.google-apps.spreadsheet';
const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const MIME_XLS = 'application/vnd.ms-excel';
const MIME_FOLDER = 'application/vnd.google-apps.folder';

const SCOPES = [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/spreadsheets.readonly',
];

async function getAuth() {
    if (!fs.existsSync(KEY_PATH)) {
        throw new Error(`Service account key not found at ${KEY_PATH}`);
    }
    const auth = new google.auth.GoogleAuth({ keyFile: KEY_PATH, scopes: SCOPES });
    return auth.getClient();
}

async function listAllSpreadsheets(drive) {
    const allFiles = [];
    let pageToken = undefined;
    do {
        const res = await drive.files.list({
            corpora: 'drive',
            driveId: SHARED_DRIVE_ID,
            includeItemsFromAllDrives: true,
            supportsAllDrives: true,
            q: 'trashed = false',
            fields: 'nextPageToken, files(id, name, mimeType, parents, size, modifiedTime)',
            pageSize: 1000,
            pageToken,
        });
        allFiles.push(...(res.data.files || []));
        pageToken = res.data.nextPageToken;
    } while (pageToken);

    const folderById = new Map();
    folderById.set(SHARED_DRIVE_ID, '');
    for (const f of allFiles) {
        if (f.mimeType === MIME_FOLDER) folderById.set(f.id, f.name);
    }
    const folderParentById = new Map();
    for (const f of allFiles) {
        if (f.mimeType === MIME_FOLDER) {
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

    const matchesScope = (p) => {
        if (EXCLUDED_PATH_SUBSTRINGS.some(sub => p.includes(sub))) return false;
        return ALLOWED_PATH_PREFIXES.some(pref => p.startsWith(pref) || p.startsWith(pref + '/'));
    };

    let totalSpreadsheets = 0;
    let outOfScope = 0;
    let tooOld = 0;
    const out = [];
    for (const f of allFiles) {
        const isSheet = f.mimeType === MIME_GSHEET || f.mimeType === MIME_XLSX || f.mimeType === MIME_XLS;
        if (!isSheet) continue;
        totalSpreadsheets++;
        const p = pathFor(f);
        if (!matchesScope(p)) { outOfScope++; continue; }
        if (f.modifiedTime && f.modifiedTime < MODIFIED_AFTER) { tooOld++; continue; }
        out.push({
            id: f.id,
            name: f.name,
            parentPath: p,
            kind: f.mimeType === MIME_GSHEET ? 'gsheet' : 'excel',
            size: f.size,
            modifiedTime: f.modifiedTime,
        });
    }
    console.log(`Listed ${allFiles.length} drive items, ${totalSpreadsheets} spreadsheets total.`);
    console.log(`  ${outOfScope} skipped (out of scope), ${tooOld} skipped (before ${MODIFIED_AFTER}).`);
    console.log(`  ${out.length} in scope to process.\n`);
    return out;
}

async function runWithConcurrency(items, worker, concurrency) {
    // Tiny concurrency limiter so we can fan out downloads without
    // pulling in a dep. Workers pull from a shared cursor.
    let i = 0;
    const results = new Array(items.length);
    async function pump() {
        for (;;) {
            const idx = i++;
            if (idx >= items.length) return;
            try {
                results[idx] = await worker(items[idx], idx);
            } catch (err) {
                results[idx] = { error: err };
            }
        }
    }
    const runners = Array.from({ length: Math.min(concurrency, items.length) }, pump);
    await Promise.all(runners);
    return results;
}

async function fetchExcelBuffer(drive, fileId) {
    const res = await drive.files.get(
        { fileId, alt: 'media', supportsAllDrives: true },
        { responseType: 'arraybuffer' },
    );
    return Buffer.from(res.data);
}

async function fetchGoogleSheetAsXlsx(drive, fileId) {
    // Export a native Google Sheet as xlsx so we can parse it with the
    // same xlsx code path as Excel files - one parser, fewer branches.
    const res = await drive.files.export(
        { fileId, mimeType: MIME_XLSX },
        { responseType: 'arraybuffer' },
    );
    return Buffer.from(res.data);
}

function sniffWorkbook(buf) {
    const wb = XLSX.read(buf, { type: 'buffer' });
    const tabs = [];
    for (const name of wb.SheetNames) {
        const sheet = wb.Sheets[name];
        const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
        const totalRows = range.e.r - range.s.r + 1;
        const totalCols = range.e.c - range.s.c + 1;
        const rows = XLSX.utils.sheet_to_json(sheet, {
            header: 1,
            blankrows: false,
            range: { s: { r: 0, c: 0 }, e: { r: Math.min(HEADER_SNIFF_ROWS - 1, range.e.r), c: range.e.c } },
            defval: '',
        });
        tabs.push({ name, totalRows, totalCols, sniffed: rows });
    }
    return tabs;
}

function formatRow(row, maxCols = 12) {
    const trimmed = row.slice(0, maxCols).map(c => {
        const s = c == null ? '' : String(c);
        return s.length > 22 ? s.slice(0, 19) + '...' : s;
    });
    return trimmed.map(c => c.padEnd(22)).join(' | ');
}

async function main() {
    console.log('Authenticating service account...');
    const authClient = await getAuth();
    const drive = google.drive({ version: 'v3', auth: authClient });

    console.log(`Walking Shared Drive ${SHARED_DRIVE_ID}...`);
    const spreadsheets = await listAllSpreadsheets(drive);
    console.log(`Found ${spreadsheets.length} spreadsheet(s) total.\n`);

    if (spreadsheets.length === 0) {
        console.log('No spreadsheets found. Confirm the service account has Viewer access');
        console.log('on the FUEL Shared Drive.');
        return;
    }

    let done = 0;
    const report = await runWithConcurrency(spreadsheets, async (sp) => {
        try {
            const buf = sp.kind === 'excel'
                ? await fetchExcelBuffer(drive, sp.id)
                : await fetchGoogleSheetAsXlsx(drive, sp.id);
            const tabs = sniffWorkbook(buf);
            done++;
            if (done % 5 === 0 || done === spreadsheets.length) {
                console.log(`  [${done}/${spreadsheets.length}] ${sp.parentPath}${sp.name}`);
            }
            return { file: sp.name, parentPath: sp.parentPath, kind: sp.kind, modifiedTime: sp.modifiedTime, tabs };
        } catch (err) {
            done++;
            console.error(`  ERR [${done}/${spreadsheets.length}] ${sp.name}: ${err?.message || err}`);
            return { file: sp.name, parentPath: sp.parentPath, kind: sp.kind, error: String(err?.message || err) };
        }
    }, DOWNLOAD_CONCURRENCY);

    const reportPath = path.resolve(__dirname, './fuel-log-crawler-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`\nWrote full report to ${reportPath}`);

    // Header-name frequency across every sheet tab. Lets us see the
    // vocabulary and pick canonical column names for the clean template.
    const headerCounts = new Map();
    for (const r of report) {
        for (const t of r.tabs || []) {
            const hdr = (t.sniffed && t.sniffed[0]) || [];
            for (const h of hdr) {
                const key = (h ?? '').toString().trim();
                if (!key) continue;
                headerCounts.set(key, (headerCounts.get(key) ?? 0) + 1);
            }
        }
    }
    console.log('\nColumn-name vocabulary across all sheet tabs (sorted by frequency):');
    const sorted = [...headerCounts.entries()].sort((a, b) => b[1] - a[1]);
    for (const [name, count] of sorted) {
        console.log(`  ${String(count).padStart(4)} x "${name}"`);
    }
}

main().catch(err => {
    console.error('Crawler failed:', err);
    process.exit(1);
});
