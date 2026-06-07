// Quick probe to see exactly what the Drive API returns. If the call
// hangs or errors, we want the raw response to diagnose.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { google } from 'googleapis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const KEY_PATH = path.resolve(__dirname, '../API KEYS/my-project-1539177112819-5db5fe898c97.json');
const SHARED_DRIVE_ID = '0APDmG-2unJLaUk9PVA';

const auth = new google.auth.GoogleAuth({
    keyFile: KEY_PATH,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
});

async function probe() {
    console.log('Getting auth client...');
    const client = await auth.getClient();
    console.log('OK, calling drive.files.list with 10s timeout...');
    const drive = google.drive({ version: 'v3', auth: client });

    const timeoutMs = 15000;
    try {
        const res = await Promise.race([
            drive.files.list({
                corpora: 'drive',
                driveId: SHARED_DRIVE_ID,
                includeItemsFromAllDrives: true,
                supportsAllDrives: true,
                fields: 'files(id, name, mimeType, parents)',
                pageSize: 20,
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error(`Drive list timed out after ${timeoutMs}ms`)), timeoutMs)),
        ]);
        console.log('Status:', res.status);
        console.log('Files returned:', res.data.files?.length ?? 0);
        for (const f of res.data.files || []) {
            console.log(`  - ${f.name} (${f.mimeType}) id=${f.id}`);
        }
    } catch (err) {
        console.error('ERROR:', err?.code, err?.message);
        if (err?.response?.data) console.error('Response body:', JSON.stringify(err.response.data, null, 2));
        if (err?.errors) console.error('Errors:', JSON.stringify(err.errors, null, 2));
    }

    // Also try listing the Shared Drive itself to confirm access
    console.log('\nProbing drives.get for the Shared Drive...');
    try {
        const res = await drive.drives.get({ driveId: SHARED_DRIVE_ID });
        console.log('Drive name:', res.data.name);
    } catch (err) {
        console.error('drives.get ERROR:', err?.code, err?.message);
        if (err?.response?.data) console.error('Response body:', JSON.stringify(err.response.data, null, 2));
    }

    // And the visible drives list - should include any Shared Drive the
    // service account is a member of.
    console.log('\nListing all Shared Drives visible to this service account...');
    try {
        const res = await drive.drives.list({ pageSize: 20 });
        console.log('Visible Shared Drives:', res.data.drives?.length ?? 0);
        for (const d of res.data.drives || []) {
            console.log(`  - "${d.name}" id=${d.id}`);
        }
    } catch (err) {
        console.error('drives.list ERROR:', err?.code, err?.message);
    }
}

probe().catch(err => {
    console.error('Probe crashed:', err);
    process.exit(1);
});
