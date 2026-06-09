// One-off cleanup: removes the half-written Sheet from the prior failed
// publisher run so we can rerun cleanly. The publisher now expands the
// grid in advance, so this should not be needed in future runs.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { google } from 'googleapis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const KEY_PATH = path.resolve(__dirname, '../API KEYS/my-project-1539177112819-5db5fe898c97.json');

const auth = new google.auth.GoogleAuth({
    keyFile: KEY_PATH,
    scopes: ['https://www.googleapis.com/auth/drive'],
});
const client = await auth.getClient();
const drive = google.drive({ version: 'v3', auth: client });
// Generic cleanup: pass the Sheet ID to remove as the first CLI arg.
const fileId = process.argv[2];
if (!fileId) {
    console.error('Usage: node scripts/delete-failed-sheet.mjs <fileId>');
    process.exit(1);
}
await drive.files.delete({ fileId, supportsAllDrives: true });
console.log(`Deleted sheet ${fileId}`);
