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
await drive.files.delete({
    fileId: '14cWVrD_IFPqZSJkfxefED2U-vkRqaSGklrFY07m6B0w',
    supportsAllDrives: true,
});
console.log('Deleted half-written sheet 14cWVrD_IFPqZSJkfxefED2U-vkRqaSGklrFY07m6B0w');
