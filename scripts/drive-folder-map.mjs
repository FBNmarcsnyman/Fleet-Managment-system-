// Quick folder-tree dump for the FUEL Shared Drive. Lists every folder
// with the count of spreadsheets directly inside it, so we can pick which
// folders are actually worth consolidating instead of crawling all 3000+
// files blindly.
//
// Read-only.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { google } from 'googleapis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const KEY_PATH = path.resolve(__dirname, '../API KEYS/my-project-1539177112819-5db5fe898c97.json');
const SHARED_DRIVE_ID = '0APDmG-2unJLaUk9PVA';

const MIME_GSHEET = 'application/vnd.google-apps.spreadsheet';
const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const MIME_XLS = 'application/vnd.ms-excel';
const MIME_FOLDER = 'application/vnd.google-apps.folder';

const auth = new google.auth.GoogleAuth({
    keyFile: KEY_PATH,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
});

async function main() {
    const client = await auth.getClient();
    const drive = google.drive({ version: 'v3', auth: client });

    console.log('Listing all items in the FUEL Shared Drive...');
    const all = [];
    let pageToken = undefined;
    do {
        const res = await drive.files.list({
            corpora: 'drive',
            driveId: SHARED_DRIVE_ID,
            includeItemsFromAllDrives: true,
            supportsAllDrives: true,
            q: 'trashed = false',
            fields: 'nextPageToken, files(id, name, mimeType, parents, modifiedTime)',
            pageSize: 1000,
            pageToken,
        });
        all.push(...(res.data.files || []));
        pageToken = res.data.nextPageToken;
    } while (pageToken);
    console.log(`  total items: ${all.length}`);

    const folders = new Map();
    folders.set(SHARED_DRIVE_ID, { id: SHARED_DRIVE_ID, name: 'FUEL (root)', parent: null });
    for (const f of all) {
        if (f.mimeType === MIME_FOLDER) {
            folders.set(f.id, { id: f.id, name: f.name, parent: (f.parents && f.parents[0]) || SHARED_DRIVE_ID });
        }
    }
    const pathFor = (folderId) => {
        const segments = [];
        let cur = folderId;
        while (cur && folders.get(cur) && folders.get(cur).parent) {
            segments.unshift(folders.get(cur).name);
            cur = folders.get(cur).parent;
        }
        return '/' + segments.join('/');
    };

    // Count spreadsheets per parent folder and find a sample modifiedTime
    const stats = new Map();
    for (const f of all) {
        const isSheet = f.mimeType === MIME_GSHEET || f.mimeType === MIME_XLSX || f.mimeType === MIME_XLS;
        if (!isSheet) continue;
        const parent = (f.parents && f.parents[0]) || SHARED_DRIVE_ID;
        if (!stats.has(parent)) stats.set(parent, { count: 0, latest: null, sample: null });
        const s = stats.get(parent);
        s.count++;
        if (!s.latest || f.modifiedTime > s.latest) s.latest = f.modifiedTime;
        if (!s.sample) s.sample = f.name;
    }

    const rows = [...stats.entries()].map(([folderId, s]) => ({
        path: pathFor(folderId),
        spreadsheets: s.count,
        latestModified: s.latest ? s.latest.slice(0, 10) : '',
        sample: s.sample,
    })).sort((a, b) => b.spreadsheets - a.spreadsheets);

    console.log('\nFolders by spreadsheet count (top 40):');
    console.log('  COUNT  LATEST       PATH (sample file)');
    for (const r of rows.slice(0, 40)) {
        console.log(`  ${String(r.spreadsheets).padStart(5)}  ${r.latestModified.padEnd(10)}   ${r.path}`);
        console.log(`         (sample: ${r.sample})`);
    }

    const outPath = path.resolve(__dirname, './drive-folder-map.json');
    fs.writeFileSync(outPath, JSON.stringify({
        totalItems: all.length,
        totalSpreadsheets: rows.reduce((a, b) => a + b.spreadsheets, 0),
        totalFolders: folders.size - 1,
        folders: rows,
    }, null, 2), 'utf8');
    console.log(`\nFull folder map saved to ${outPath}`);
}

main().catch(err => {
    console.error('Failed:', err);
    process.exit(1);
});
