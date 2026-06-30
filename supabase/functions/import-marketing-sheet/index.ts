// import-marketing-sheet — pull contacts from a shared Google Sheet (or any public
// CSV link) server-side, so the browser never hits a CORS wall. Input: { url }.
// Returns { ok, rows: [{ email, name, company }], count }. The caller (Marketing
// Contacts view) then assigns kind/tag and upserts via addMarketingContacts.
// The sheet must be shared "anyone with the link can view".
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Turn a normal Sheets URL into its CSV export URL. Falls back to the raw URL
// (already a CSV link, or a published-to-web CSV).
function toCsvUrl(url: string): string {
  const m = url.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (m) {
    const id = m[1];
    const gidMatch = url.match(/[#&?]gid=(\d+)/);
    const gid = gidMatch ? gidMatch[1] : '0';
    return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
  }
  return url;
}

// Minimal CSV parser that respects quoted fields and embedded commas/newlines.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (ch === '\r') { /* skip */ }
    else cell += ch;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim()));
}

const emailRe = /\S+@\S+\.\S+/;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { url } = await req.json();
    if (!url || typeof url !== 'string') {
      return new Response(JSON.stringify({ ok: false, error: 'No sheet URL provided.' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
    }
    const csvUrl = toCsvUrl(url.trim());
    const res = await fetch(csvUrl, { redirect: 'follow' });
    if (!res.ok) {
      return new Response(JSON.stringify({ ok: false, error: `Could not open the sheet (HTTP ${res.status}). Make sure it is shared "anyone with the link can view".` }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });
    }
    const text = await res.text();
    // A login/HTML page came back instead of CSV → sheet isn't public.
    if (/^\s*<(!doctype|html)/i.test(text)) {
      return new Response(JSON.stringify({ ok: false, error: 'The sheet is not publicly viewable. Share it as "anyone with the link can view" and try again.' }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });
    }
    const table = parseCsv(text);
    if (!table.length) {
      return new Response(JSON.stringify({ ok: false, error: 'The sheet appears to be empty.' }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    // Detect a header row and map columns by name; otherwise infer by content.
    const header = table[0].map(h => h.trim().toLowerCase());
    const hasHeader = header.some(h => emailRe.test(h) === false && /email|e-mail|mail/.test(h));
    const dataRows = hasHeader ? table.slice(1) : table;
    let emailCol = -1, nameCol = -1, companyCol = -1;
    if (hasHeader) {
      header.forEach((h, i) => {
        if (emailCol < 0 && /email|e-mail|mail/.test(h)) emailCol = i;
        else if (nameCol < 0 && /(contact|name|person|first)/.test(h)) nameCol = i;
        else if (companyCol < 0 && /(company|business|client|account|organisation|organization)/.test(h)) companyCol = i;
      });
    }

    const seen = new Set<string>();
    const rows: { email: string; name?: string; company?: string }[] = [];
    for (const r of dataRows) {
      let email = emailCol >= 0 ? (r[emailCol] || '').trim() : '';
      if (!email) email = (r.find(c => emailRe.test(c)) || '').trim();
      if (!email || !emailRe.test(email)) continue;
      const key = email.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const rest = r.filter(c => c.trim() && !emailRe.test(c)).map(c => c.trim());
      rows.push({
        email,
        name: nameCol >= 0 ? (r[nameCol] || '').trim() || undefined : (rest[0] || undefined),
        company: companyCol >= 0 ? (r[companyCol] || '').trim() || undefined : (rest[1] || undefined),
      });
    }
    return new Response(JSON.stringify({ ok: true, rows, count: rows.length }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
