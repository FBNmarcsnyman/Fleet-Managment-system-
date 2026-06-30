// scan-bounces — read the tracking@ mailbox over IMAP, find delivery-failure
// (NDR / bounce) messages from the mail daemon, extract the failed recipient(s),
// and flag matching marketing_contacts as bounced (kept on file, never deleted).
// Reuses the existing GMAIL_USER + GMAIL_APP_PASSWORD secrets (an app password
// authenticates IMAP as well as SMTP). Designed to be run on a daily cron.
//
// Non-destructive: uses BODY.PEEK (doesn't mark mail as read) and tracks the last
// processed UID in email_settings.last_bounce_uid so it never reprocesses.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

const HOST = 'imap.gmail.com';
const PORT = 993;
const enc = new TextEncoder();
const dec = new TextDecoder();

// Minimal IMAP-over-TLS client: send tagged commands, read until the tagged
// completion line (aN OK/NO/BAD) appears. Good enough for LOGIN/SELECT/SEARCH/FETCH.
class Imap {
  conn!: Deno.TlsConn;
  tag = 0;
  buf = '';
  async connect() {
    this.conn = await Deno.connectTls({ hostname: HOST, port: PORT });
    await this.readUntil(/\r\n/); // server greeting
  }
  async readUntil(re: RegExp): Promise<string> {
    const tmp = new Uint8Array(65536);
    while (!re.test(this.buf)) {
      const n = await this.conn.read(tmp);
      if (n === null) break;
      this.buf += dec.decode(tmp.subarray(0, n));
    }
    const out = this.buf;
    this.buf = '';
    return out;
  }
  async cmd(command: string): Promise<string> {
    const t = `a${++this.tag}`;
    await this.conn.write(enc.encode(`${t} ${command}\r\n`));
    // Read until the tagged completion line for this command.
    const re = new RegExp(`^${t} (OK|NO|BAD)`, 'm');
    return await this.readUntil(re);
  }
  async login(user: string, pass: string) {
    const r = await this.cmd(`LOGIN "${user}" "${pass}"`);
    if (!/^a\d+ OK/m.test(r)) throw new Error('IMAP login failed');
  }
  async close() { try { await this.cmd('LOGOUT'); } catch { /* ignore */ } try { this.conn.close(); } catch { /* ignore */ } }
}

const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const imapDate = (d: Date) => `${d.getUTCDate()}-${mon[d.getUTCMonth()]}-${d.getUTCFullYear()}`;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const sUrl = Deno.env.get('SUPABASE_URL');
  const sKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const user = Deno.env.get('GMAIL_USER') || 'tracking@fbn-transport.co.za';
  const pass = (Deno.env.get('GMAIL_APP_PASSWORD') || Deno.env.get('GMAIL_PASSWORD') || '').replace(/\s+/g, '');
  if (!pass) return json({ ok: false, error: 'GMAIL_APP_PASSWORD not configured.' }, 500);
  if (!sUrl || !sKey) return json({ ok: false, error: 'Supabase env missing.' }, 500);

  const dryRun = (() => { try { return new URL(req.url).searchParams.get('dry') === '1'; } catch { return false; } })();
  const sb = (path: string, init?: RequestInit) => fetch(`${sUrl}/rest/v1/${path}`, { ...init, headers: { apikey: sKey, Authorization: `Bearer ${sKey}`, 'Content-Type': 'application/json', ...(init?.headers || {}) } });

  const imap = new Imap();
  try {
    // How far back to look, and the last UID we already handled.
    let lastUid = 0;
    try {
      const r = await sb('email_settings?id=eq.1&select=last_bounce_uid');
      const rows = await r.json().catch(() => []);
      lastUid = Number(rows?.[0]?.last_bounce_uid || 0);
    } catch { /* default 0 */ }

    await imap.connect();
    await imap.login(user, pass);
    await imap.cmd('SELECT INBOX');

    // Find bounce messages: from the mail daemon, in the last 30 days, UID above
    // the last one we processed.
    const since = imapDate(new Date(Date.now() - 30 * 864e5));
    const searchRange = lastUid > 0 ? `${lastUid + 1}:*` : '1:*';
    const searchRes = await imap.cmd(`UID SEARCH UID ${searchRange} SINCE ${since} OR FROM "mailer-daemon" FROM "postmaster"`);
    const uids = (searchRes.match(/\* SEARCH ([\d ]+)/)?.[1] || '').trim().split(/\s+/).map(Number).filter(n => n > lastUid);

    const failed: { email: string; reason: string }[] = [];
    let maxUid = lastUid;
    for (const uid of uids.slice(0, 200)) {
      maxUid = Math.max(maxUid, uid);
      const fetchRes = await imap.cmd(`UID FETCH ${uid} (BODY.PEEK[])`);
      // Pull failed recipients from the standard delivery-status part.
      if (!/Action:\s*failed/i.test(fetchRes)) continue;
      const re = /Final-Recipient:\s*rfc822;\s*([^\s\r\n<>]+@[^\s\r\n<>]+)/gi;
      let m: RegExpExecArray | null;
      const statusReason = (fetchRes.match(/Status:\s*([\d.]+)/i)?.[1]) || '';
      const diag = (fetchRes.match(/Diagnostic-Code:\s*([^\r\n]+)/i)?.[1] || '').slice(0, 200);
      while ((m = re.exec(fetchRes)) !== null) {
        const email = m[1].trim().toLowerCase();
        if (email.endsWith('@fbn-transport.co.za')) continue; // ignore self
        failed.push({ email, reason: `${statusReason} ${diag}`.trim() || 'Delivery failed' });
      }
    }

    // Dedupe failed recipients (latest reason wins).
    const byEmail = new Map<string, string>();
    failed.forEach(f => byEmail.set(f.email, f.reason));

    let flagged = 0;
    const flaggedEmails: string[] = [];
    if (!dryRun) {
      for (const [email, reason] of byEmail) {
        const r = await sb(`marketing_contacts?email=ilike.${encodeURIComponent(email)}&bounced=eq.false`, {
          method: 'PATCH', headers: { Prefer: 'return=representation' },
          body: JSON.stringify({ bounced: true, bounced_at: new Date().toISOString(), bounce_reason: reason || 'Mailbox bounced (auto-detected)' }),
        });
        const rows = await r.json().catch(() => []);
        if (Array.isArray(rows) && rows.length) { flagged += rows.length; flaggedEmails.push(email); }
      }
      // Advance the watermark so we don't reprocess these next run.
      if (maxUid > lastUid) {
        await sb('email_settings?id=eq.1', { method: 'PATCH', body: JSON.stringify({ last_bounce_uid: maxUid }) });
      }
    }

    await imap.close();
    return json({ ok: true, scanned: uids.length, bouncesFound: byEmail.size, flagged, flaggedEmails, failedRecipients: [...byEmail.keys()], lastUid, maxUid, dryRun });
  } catch (e) {
    try { await imap.close(); } catch { /* ignore */ }
    return json({ ok: false, error: String((e as Error)?.message || e) }, 200);
  }
});
