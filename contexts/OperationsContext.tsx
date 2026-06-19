
import React, { createContext, useContext, useMemo, useRef, ReactNode } from 'react';
import { RawDataContext } from './RawDataContext';
import { CommonDataContext } from './CommonDataContext';
import { User, Quote, LoadConfirmation, Client, Supplier, Branch, ComplianceDoc } from '../types';
import { supabase, runWrite, uploadFile, directInsert, directUpdate, directDelete, directSelect, directInvoke, invokeFn } from '../lib/supabase';
import {
    toClientInsert, toClientUpdate, toSupplierInsert, toSupplierUpdate, toQuoteInsert, toQuoteUpdate,
    toLoadConfirmationInsert, toLoadConfirmationUpdate,
    mapClient, mapSupplier, mapQuote, mapLoadConfirmation,
    toChecklistSubmissionInsert, mapChecklistSubmission,
    toJobCardInsert, mapJobCard, mapSupplierComplianceDoc,
} from '../lib/mappers';

import { brandedEmail, emailButton } from '../lib/emailTemplate';
import { sendLoadConToSupplier, sendOrderToClient } from '../lib/loadEmails';

const FBN_ORG_ID = '00000000-0000-0000-0000-000000000001';

// Race any promise against a hard timeout. Unlike abortSignal (which only cancels
// an in-flight fetch), this also escapes a hang that happens BEFORE the request is
// sent — e.g. the supabase-js auth client getting wedged while it tries to read or
// refresh the session. Rejects with a tagged error so callers can detect a stall.
const TIMED_OUT = '__timed_out__';
const withTimeout = <T,>(p: PromiseLike<T>, ms: number): Promise<T> =>
    Promise.race([
        Promise.resolve(p),
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error(TIMED_OUT)), ms)),
    ]);

// The bulletproof write: try the write; if it STALLS (no response in `ms`) — the
// classic wedged-session symptom where the request never even leaves the browser —
// force a fresh session and try exactly once more. This is what actually unsticks a
// stuck client-side session without the user reloading and losing their work.
const writeWithRecovery = async <T,>(
    makeOp: () => PromiseLike<{ data: T; error: any }>,
    ms = 12000,
): Promise<{ data: T | null; error: any }> => {
    try {
        return await withTimeout(makeOp(), ms);
    } catch (e) {
        if (!(e instanceof Error && e.message === TIMED_OUT)) throw e;
        // Stalled. Refresh the session (bounded so it can't hang either) and retry.
        try { await withTimeout(supabase.auth.refreshSession(), 8000); } catch { /* keep going */ }
        try {
            return await withTimeout(makeOp(), ms);
        } catch (e2) {
            return { data: null, error: { message: 'The save stalled — your session timed out. Please reload the page (Ctrl+Shift+R) and sign in again if prompted.' } };
        }
    }
};

// Emails the transporter asking for the POD, with a no-login upload link
// (?pod=<id>) and the option to reply with the POD attached. Fire-and-forget:
// used both by the manual "Request" button and automatically on delivery.
// Client-facing milestone copy for automatic phase updates.
const CLIENT_PHASE_MSG: Record<string, string> = {
    'Driver Assigned': 'has been assigned a vehicle and driver',
    'At Collection Point': 'has a vehicle that has arrived at the collection point',
    'Collected': 'has been collected',
    'At Collection Depot': 'has been logged in at our depot',
    'In Transit': 'has been loaded for inter-branch transfer and is on its way',
    'At Destination Depot': 'has been received at our destination depot',
    'Unloaded': 'has been assigned to a local delivery vehicle',
    'Out for Delivery': 'has been loaded and dispatched for delivery',
    'Delivered': 'has been delivered',
};

// Neaten data entry: store free-text fields in UPPERCASE (transport-doc style),
// but NEVER emails or phone numbers. Applied at the save layer so the board,
// LoadCons and emails all read consistently.
const upStr = (v: any) => (typeof v === 'string' && v.trim() ? v.toUpperCase() : v);
const upContacts = (cs: any) => Array.isArray(cs) ? cs.map((c: any) => ({ ...c, name: upStr(c.name), role: upStr(c.role) })) : cs;
const LOAD_UP = ['clientName', 'clientContact', 'collectionPoint', 'deliveryPoint', 'commodity', 'packaging', 'loadType', 'route', 'customerOrderNumber', 'loadRefNo', 'subcontractorName', 'forAttention', 'subcontractorDriverName', 'subcontractorVehicleReg', 'specialInstructions', 'dimensions'];
export const upcaseLoad = (o: any) => { if (!o || typeof o !== 'object') return o; const x = { ...o }; for (const k of LOAD_UP) if (k in x) x[k] = upStr(x[k]); return x; };
const PARTY_UP = ['name', 'contactPerson', 'address'];
export const upcaseParty = (o: any) => {
    if (!o || typeof o !== 'object') return o; const x = { ...o };
    for (const k of PARTY_UP) if (k in x) x[k] = upStr(x[k]);
    if ('contacts' in x) x.contacts = upContacts(x.contacts);
    if ('branches' in x) x.branches = Array.isArray(x.branches) ? x.branches.map((b: any) => ({ ...b, name: upStr(b.name), address: upStr(b.address), contactPerson: upStr(b.contactPerson), contacts: upContacts(b.contacts) })) : x.branches;
    return x;
};

// Normalise a SA cell ("0832496150" / "27 83…" / "+2783…") to E.164 (+2783…).
const waNumber = (raw?: string): string | null => {
    if (!raw) return null;
    let d = String(raw).replace(/[^\d+]/g, '');
    if (d.startsWith('+')) return d;
    if (d.startsWith('27')) return `+${d}`;
    if (d.startsWith('0')) return `+27${d.slice(1)}`;
    if (d.length === 9) return `+27${d}`;     // missing leading 0
    return `+${d}`;
};

// Emails the SUBCONTRACTOR a short status update as the load moves phases
// (the client gets their own via sendClientPhaseEmail). Fire-and-forget.
export const sendSupplierPhaseEmail = async (lc: any, status: string): Promise<void> => {
    const to = lc?.subcontractorEmail;
    const msg = CLIENT_PHASE_MSG[status];
    if (!to || !msg) return;
    const route = `${lc.collectionPoint || ''}${lc.deliveryPoint ? ' to ' + lc.deliveryPoint : ''}`;
    const base = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '';
    const html = brandedEmail(`<p>Good day ${lc.forAttention || lc.subcontractorName || ''},</p>
      <p>Status update on load <strong>${lc.loadConNumber}</strong>${route ? ` (${route})` : ''}: it <strong>${msg}</strong>.</p>
      <p>Please push the next update from your portal as the load progresses:</p>
      ${emailButton(`${base}?update=${lc.id}`, 'Update this load &rarr;')}
      <p style="font-size:13px;color:#5b6573">POD to be returned on delivery (you can upload it from the same portal).</p>
      <p>Regards,<br>FBN Transport</p>`);
    try {
        // Status updates go to the controller (To) + the "updates" contacts + ops.
        // (Accounts are excluded unless ticked for updates.)
        const cc = [...String(lc.updateCc || '').split(/[,;]/).map((t: string) => t.trim()).filter(Boolean), ...opsCcForPhase(lc, status)];
        await invokeFn('send-email', { body: { to, cc, subject: `FBN load ${lc.loadConNumber} - ${status}`, html, fromName: 'FBN Transport' } });
    } catch (e) { console.error('[ops] supplier phase update failed:', e); }
};

// Send a WhatsApp to the load's driver (freeze-proof invoke; honours TEST MODE
// server-side). Fire-and-forget — never block a status update on messaging.
export const sendDriverWhatsApp = async (lc: any, body: string): Promise<void> => {
    const to = waNumber(lc?.subcontractorDriverCell);
    if (!to) return;
    try {
        // Pass loadId so send-whatsapp logs this outbound to the conversation transcript.
        const { error } = await directInvoke('send-whatsapp', { to: `whatsapp:${to}`, body, loadId: lc?.id, loadConNumber: lc?.loadConNumber, party: 'FBN' });
        if (error) console.error('[ops] driver WhatsApp failed:', error);
    } catch (e) { console.error('[ops] driver WhatsApp threw:', e); }
};

// What we ask the driver at each phase. The reply keywords (ARRIVED, LOADED,
// ONROUTE, DELIVERED, OFFLOADED) are what the inbound webhook will act on.
const DRIVER_PHASE_MSG: Record<string, (lc: any, podLink: string) => string> = {
    'Driver Assigned': (lc) => `Hi ${lc.subcontractorDriverName || 'driver'}, FBN Transport has assigned you load ${lc.loadConNumber}.\nCollect: ${lc.collectionPoint || '-'}\nDeliver: ${lc.deliveryPoint || '-'}\nCargo: ${lc.loadType || ''} ${lc.commodity || ''}${lc.weightKg ? ' · ' + lc.weightKg + 'kg' : ''}\nContact: ${lc.collectionContact || '-'} ${lc.collectionTelephone || ''}\n\nWhat is your ETA at the loading point? Reply:\n1 = within 1 hour\n2 = within 2 hours\n3 = other (then type the time)`,
    'At Collection Point': (lc) => `Thanks. When you start loading ${lc.loadConNumber}, reply 1 (Loaded).`,
    'Collected': (lc) => `Great — load ${lc.loadConNumber} marked collected. When you depart for ${lc.deliveryPoint || 'delivery'}, reply 1 (On route).`,
    'In Transit': (lc) => `Safe travels. Reply 1 (Arrived) when you reach ${lc.deliveryPoint || 'the delivery point'} for ${lc.loadConNumber}.`,
    'Out for Delivery': (lc) => `Load ${lc.loadConNumber} is out for delivery. Reply 1 (Delivered) once offloaded.`,
    'Delivered': (lc, podLink) => `Thank you for delivering ${lc.loadConNumber}. Please upload the signed POD here: ${podLink}`,
};

// Emails the client a short branded status update with a live tracking link as
// the load moves through its phases. Fire-and-forget.
export const sendClientPhaseEmail = async (lc: any, status: string): Promise<void> => {
    const to = lc?.clientEmail;
    const msg = CLIENT_PHASE_MSG[status];
    if (!to || !msg) return;
    const base = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '';
    const trackLink = `${base}?track=${lc.id}`;
    const route = `${lc.collectionPoint || ''}${lc.deliveryPoint ? ' to ' + lc.deliveryPoint : ''}`;
    // Title-case the greeting name so the (uppercase-stored) name isn't shouty.
    const greet = String(lc.clientContact || lc.clientName || '').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase());
    const fmtDT = (s?: string) => { if (!s) return ''; const d = new Date(s); return isNaN(d.getTime()) ? s : d.toLocaleString('en-ZA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); };
    const eta = (status === 'Driver Assigned' || status === 'At Collection Point') ? lc.loadingEta : status === 'Out for Delivery' ? lc.deliveryEta : '';
    const etaLine = eta ? `<p style="font-size:15px;color:#13294b">ETA: <strong>${fmtDT(eta)}</strong></p>` : '';
    const html = brandedEmail(`<p>Good day ${greet},</p>
      <p>An update on your shipment <strong>${lc.loadConNumber}</strong>${route ? ` (${route})` : ''}: it <strong>${msg}</strong>.</p>
      ${etaLine}
      ${emailButton(trackLink, 'Track your shipment &rarr;')}
      <p>Regards,<br>FBN Transport</p>`);
    try {
        // Client team + ops + (for rep-logged collections) the sales rep.
        const cc = [...String(lc.clientCc || '').split(/[,;]/).map((t: string) => t.trim()).filter(Boolean), ...opsCcForPhase(lc, status), ...(lc.repEmail ? [lc.repEmail] : [])];
        await invokeFn('send-email', { body: { to, cc, subject: `FBN Transport Order ${lc.loadConNumber}`, html, fromName: 'FBN Transport' } });
    } catch (e) {
        console.error('[ops] client phase update failed:', e);
    }
};

// Tells the client their POD is available to view & download once it's in.
export const sendClientPodEmail = async (lc: any): Promise<void> => {
    const to = lc?.clientEmail;
    if (!to) return;
    const base = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '';
    const podUrl = lc.podPhoto?.data || '';
    const html = brandedEmail(`<p>Good day ${lc.clientContact || lc.clientName || ''},</p>
      <p>The <strong>POD</strong> for your delivered shipment <strong>${lc.loadConNumber}</strong> is now available to view and download.</p>
      ${podUrl ? emailButton(podUrl, 'View / download POD &rarr;', '#16a34a') : ''}
      ${emailButton(`${base}?track=${lc.id}`, 'Track shipment')}
      <p>Regards,<br>FBN Transport</p>`);
    try {
        const cc = [...String(lc.clientCc || '').split(/[,;]/).map((t: string) => t.trim()).filter(Boolean), ...opsCcForPhase(lc, 'Delivered')];
        await invokeFn('send-email', { body: { to, cc, subject: `FBN Transport Order ${lc.loadConNumber}`, html, fromName: 'FBN Transport' } });
    } catch (e) {
        console.error('[ops] client POD notify failed:', e);
    }
};

// Sends the subcontractor a copy of the POD they submitted (their record).
export const sendSupplierPodEmail = async (lc: any): Promise<void> => {
    const to = lc?.subcontractorEmail;
    if (!to) return;
    const podUrl = lc.podPhoto?.data || '';
    const html = brandedEmail(`<p>Good day ${lc.forAttention || lc.subcontractorName || ''},</p>
      <p>Thank you — here is your copy of the <strong>POD</strong> received for load <strong>${lc.loadConNumber}</strong>${lc.deliveryPoint ? ` (delivered to ${lc.deliveryPoint})` : ''}.</p>
      ${podUrl ? emailButton(podUrl, 'View / download POD &rarr;', '#16a34a') : ''}
      <p style="font-size:13px;color:#5b6573">Please keep this for your records and quote the load number on your invoice.</p>
      <p>Regards,<br>FBN Transport</p>`);
    try {
        await invokeFn('send-email', { body: { to, cc: [...String(lc.ccEmail || '').split(/[,;]/).map((t: string) => t.trim()).filter(Boolean), ...opsCcForPhase(lc, 'Delivered')], subject: `POD copy - load ${lc.loadConNumber}`, html, fromName: 'FBN Transport' } });
    } catch (e) {
        console.error('[ops] supplier POD copy failed:', e);
    }
};

// When an ALREADY-SENT LoadCon's details change, re-send it to the transporter
// clearly flagged as AMENDED, with the accept link so they re-confirm the new
// terms. `changed` is a short human list of what changed.
export const sendAmendedLoadConEmail = async (lc: any, changed: string[]): Promise<void> => {
    const to = lc?.subcontractorEmail;
    if (!to) return;
    const base = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '';
    const acceptLink = `${base}?accept=${lc.id}`;
    const route = `${lc.collectionPoint || ''}${lc.deliveryPoint ? ' to ' + lc.deliveryPoint : ''}`;
    const list = changed.length ? `<ul style="font-size:14px;color:#1f2937">${changed.map(c => `<li>${c}</li>`).join('')}</ul>` : '';
    const html = brandedEmail(`<p>Good day ${lc.forAttention || lc.subcontractorName || ''},</p>
      <p><strong style="color:#b45309">AMENDED DETAILS — please review &amp; re-confirm.</strong></p>
      <p>The load confirmation <strong>${lc.loadConNumber}</strong>${route ? ` (${route})` : ''} has been <strong>amended</strong>. Please see the updated details${list ? ' below' : ''} and confirm acceptance of the amended terms.</p>
      ${list}
      ${emailButton(acceptLink, 'Review &amp; confirm amended load &rarr;', '#b45309')}
      <p style="font-size:13px;color:#5b6573">If you cannot accept the amended terms, please reply to this email.</p>
      <p>Regards,<br>FBN Transport</p>`);
    try {
        await invokeFn('send-email', {
            body: {
                to,
                cc: ['loadcons@fbn-transport.co.za', ...(lc.ccEmail ? [lc.ccEmail] : [])],
                subject: `AMENDED Load Confirmation ${lc.loadConNumber} - please re-confirm`,
                html,
                fromName: 'FBN Transport',
            },
        });
    } catch (e) {
        console.error('[ops] amended loadcon resend failed:', e);
    }
};

export const sendPodRequestEmail = async (lc: any): Promise<void> => {
    const to = lc?.subcontractorEmail;
    if (!to) return;
    const route = `${lc.collectionPoint || ''}${lc.deliveryPoint ? ' to ' + lc.deliveryPoint : ''}`;
    const base = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '';
    const uploadLink = `${base}?pod=${lc.id}`;
    const html = brandedEmail(`<p>Good day ${lc.forAttention || lc.subcontractorName || ''},</p>
      <p>Please send through the <strong>POD</strong> for load <strong>${lc.loadConNumber}</strong>${route ? ` (${route})` : ''} now that it has delivered.</p>
      ${emailButton(uploadLink, 'Upload POD &rarr;', '#16a34a')}
      <p style="font-size:13px;color:#5b6573">Tap the button on your phone to snap a photo of the signed POD — no login needed. Or simply reply to this email with the POD attached.</p>
      <p>Thank you,<br>FBN Transport</p>`);
    try {
        await invokeFn('send-email', {
            body: { to, cc: [...String(lc.ccEmail || '').split(/[,;]/).map((t: string) => t.trim()).filter(Boolean), ...opsCcForPhase(lc, 'Delivered')], subject: `POD required - Load ${lc.loadConNumber}`, html, fromName: 'FBN Transport' },
        });
    } catch (e) {
        console.error('[ops] auto POD request failed:', e);
    }
};

const OPS_EMAIL = 'loadcons@fbn-transport.co.za';
const baseUrl = () => (typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '');

// Branch ops mailboxes. Every ops notification also copies the general ops inbox.
const OPS_GENERAL = 'ops@fbn-transport.co.za';
const opsEmail = (branch?: string) => branch === 'FBN DBN' ? 'opsdbn@fbn-transport.co.za' : branch === 'FBN JHB' ? 'opsjhb@fbn-transport.co.za' : OPS_GENERAL;
// Statuses before the inter-branch transfer (handled by the COLLECTING branch).
const COLLECTION_PHASE = new Set(['Booked', 'Driver Assigned', 'At Collection Point', 'Loading', 'Collected', 'At Collection Depot']);
// Which ops mailboxes to copy for a load at a given status: collecting branch up
// to the transfer, then the destination branch (cc the origin) once it's moving.
const opsCcForPhase = (lc: any, status: string): string[] => {
    const origin = opsEmail(lc.collectionBranch || lc.arrangingBranch);
    const dest = opsEmail(lc.destinationBranch);
    const set = COLLECTION_PHASE.has(status) ? [origin] : (origin === dest ? [origin] : [dest, origin]);
    return [...new Set([...set, OPS_GENERAL])];
};

// Mobile "Quick Collection" → email ops to action it (assign driver + ETA).
export const notifyOpsNewCollection = async (lc: any): Promise<void> => {
    const acceptLink = `${baseUrl()}?accept=${lc.id}`;
    const html = brandedEmail(`<p><strong>New collection request${lc.arrangingBranch ? ` — ${lc.arrangingBranch}` : ''}.</strong></p>
      <p><strong>${lc.clientName || ''}</strong> — collect from <strong>${lc.collectionPoint || ''}</strong> &rarr; <strong>${lc.deliveryPoint || ''}</strong>.</p>
      <p>${[lc.packaging, lc.commodity].filter(Boolean).join(' · ') || ''}</p>
      <p>Please assign a driver and collection ETA:</p>
      ${emailButton(acceptLink, 'Assign driver &amp; collection ETA &rarr;', '#16a34a')}
      <p>Regards,<br>FBN Transport</p>`);
    const to = opsEmail(lc.collectionBranch || lc.arrangingBranch);
    try { await invokeFn('send-email', { body: { to, cc: [OPS_GENERAL], subject: `NEW COLLECTION ${lc.loadConNumber}${lc.arrangingBranch ? ` (${lc.arrangingBranch})` : ''} - ${lc.clientName || ''}`, html, fromName: 'FBN Transport' } }); }
    catch (e) { console.error('[ops] collection ops-notify failed:', e); }
};

// Acknowledge the client that we've received their collection request.
export const sendCollectionAckToClient = async (lc: any): Promise<void> => {
    const to = lc?.clientEmail; if (!to) return;
    const html = brandedEmail(`<div style="text-align:right;font-weight:800;color:#13294b;font-size:16px;margin-bottom:10px">${lc.loadConNumber}</div>
      <p>Good day ${lc.clientContact || lc.clientName || ''},</p>
      <p><strong>Thank you — we've received your collection request and are arranging it.</strong> We'll confirm the vehicle and collection time shortly.</p>
      <p>Collection: <strong>${lc.collectionPoint || ''}</strong><br>Delivery: <strong>${lc.deliveryPoint || ''}</strong></p>
      ${emailButton(`${baseUrl()}?track=${lc.id}`, 'Track this collection &rarr;')}
      <p>Kind regards,<br>FBN Transport &middot; Commercial Freight Specialists</p>`);
    const cc = [...String(lc.clientCc || '').split(/[,;]/).map((t: string) => t.trim()).filter(Boolean), opsEmail(lc.collectionBranch || lc.arrangingBranch), OPS_GENERAL];
    try { await invokeFn('send-email', { body: { to, cc, subject: `FBN Transport Order ${lc.loadConNumber}`, html, fromName: 'FBN Transport' } }); }
    catch (e) { console.error('[ops] collection ack failed:', e); }
};

export const OperationsContext = createContext<any>(undefined);

type Result<T = void> = { ok: true; value?: T } | { ok: false; error: string };

// Merge a chosen contact into a saved client/subbie contacts list. Matches by
// name (case-insensitive); fills in a newly-supplied email/phone, never blanks
// an existing one. Returns null when nothing changed, so callers can skip the
// write. A brand-new person is appended.
const mergeContact = (
    existing: { name: string; email?: string; phone?: string }[] | undefined,
    incoming: { name?: string; email?: string; phone?: string },
): { name: string; email?: string; phone?: string }[] | null => {
    const name = (incoming.name || '').trim();
    const email = (incoming.email || '').trim();
    const phone = (incoming.phone || '').trim();
    if (!name && !email) return null;
    const list = (existing || []).map(c => ({ ...c }));
    const idx = list.findIndex(c =>
        (name && (c.name || '').toLowerCase() === name.toLowerCase()) ||
        (!name && email && (c.email || '').toLowerCase() === email.toLowerCase()));
    if (idx >= 0) {
        const cur = list[idx];
        const next = { ...cur, name: cur.name || name, email: cur.email || email || undefined, phone: cur.phone || phone || undefined };
        if (next.name === cur.name && next.email === cur.email && next.phone === cur.phone) return null;
        list[idx] = next;
        return list;
    }
    list.push({ name: name || email, email: email || undefined, phone: phone || undefined });
    return list;
};

export const OperationsDataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const raw = useContext(RawDataContext);
    const common = useContext(CommonDataContext);
    if (!raw || !common) return <>{children}</>;
    const { state, dispatch } = raw;
    const { users } = common;

    const stateRef = useRef(state);
    stateRef.current = state;

    const branchIdByName = useMemo<Map<Branch, string>>(
        () => new Map((state.branches || []).map(b => [b.name, b.id])),
        [state.branches],
    );
    const branchById = useMemo<Map<string, Branch>>(
        () => new Map((state.branches || []).map(b => [b.id, b.name])),
        [state.branches],
    );

    const derived = useMemo(() => ({
        unassignedJobCount: (state.loadConfirmations || []).filter(lc => lc.status === 'Booked').length,
    }), [state.loadConfirmations]);

    const handlers = useMemo(() => ({
        // -- Clients ----------------------------------------------------------
        handleAddClient: async (client: Omit<Client, 'id'>): Promise<Result<Client>> => {
            try {
                client = upcaseParty(client);
                const row = toClientInsert(client);
                const { data, error } = await supabase
                    .from('clients').insert(row).select().single();
                if (error) { console.error('[ops] addClient failed:', error); return { ok: false, error: error.message }; }
                const mapped = mapClient(data);
                dispatch({ type: 'ADD_CLIENT', payload: mapped });
                return { ok: true, value: mapped };
            } catch (err) {
                console.error('[ops] addClient threw:', err);
                return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
            }
        },
        handleUpdateClient: async (id: string, updates: Partial<Client>): Promise<Result<void>> => {
            try {
                updates = upcaseParty(updates);
                // directUpdate (freeze-proof REST) - supabase.from() here wedged on the
                // auth lock so client edits silently never saved.
                const { error } = await directUpdate('clients', { id }, toClientUpdate(updates) as any);
                if (error) { console.error('[ops] updateClient failed:', error); return { ok: false, error: error.message }; }
                dispatch({ type: 'UPDATE_CLIENT', payload: { id, updates } });
                return { ok: true };
            } catch (err) {
                console.error('[ops] updateClient threw:', err);
                return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
            }
        },
        // Soft-delete: deactivate (keeps history/loads intact, hides from lists).
        handleDeleteClient: async (id: string): Promise<Result<void>> => {
            try {
                // Real delete when the client has no history; otherwise deactivate (hide) to keep loads/quotes.
                const del = await directDelete('clients', { id });
                if (del.error) {
                    const soft = await directUpdate('clients', { id }, { is_active: false });
                    if (soft.error) { console.error('[ops] deleteClient failed:', soft.error); return { ok: false, error: soft.error.message }; }
                }
                dispatch({ type: 'REMOVE_CLIENT', payload: id });
                return { ok: true };
            } catch (err) { return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }; }
        },
        handleDeleteSupplier: async (id: string): Promise<Result<void>> => {
            try {
                // Try a real delete first so empty / junk subbies are actually removed.
                // If the subbie has load history (FK), fall back to deactivating (hide) so we keep that history.
                const del = await directDelete('suppliers', { id });
                if (del.error) {
                    const soft = await directUpdate('suppliers', { id }, { is_active: false });
                    if (soft.error) { console.error('[ops] deleteSupplier failed:', soft.error); return { ok: false, error: soft.error.message }; }
                }
                dispatch({ type: 'REMOVE_SUPPLIER', payload: id });
                return { ok: true };
            } catch (err) { return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }; }
        },
        handleBulkAddClients: async (clients: Omit<Client, 'id'>[]): Promise<Result<{ count: number }>> => {
            try {
                const rows = clients.map(toClientInsert);
                const { data, error } = await supabase.from('clients').insert(rows).select();
                if (error) { console.error('[ops] bulkAddClients failed:', error); return { ok: false, error: error.message }; }
                const mapped = (data || []).map(mapClient);
                dispatch({ type: 'BULK_ADD_CLIENTS', payload: mapped });
                return { ok: true, value: { count: mapped.length } };
            } catch (err) {
                console.error('[ops] bulkAddClients threw:', err);
                return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
            }
        },

        // -- Suppliers --------------------------------------------------------
        handleAddSupplier: async (supplier: Omit<Supplier, 'id'>): Promise<Result<Supplier>> => {
            try {
                // Default complianceStatus matches the pre-migration reducer behavior.
                const withDefaults: Omit<Supplier, 'id'> = upcaseParty({ complianceStatus: 'Pending', complianceDocs: [], rateCards: [], ...supplier });
                const row = toSupplierInsert(withDefaults);
                const { data, error } = await supabase
                    .from('suppliers').insert(row).select().single();
                if (error) { console.error('[ops] addSupplier failed:', error); return { ok: false, error: error.message }; }
                const mapped = mapSupplier(data, new Map(), new Map());
                dispatch({ type: 'ADD_SUPPLIER', payload: mapped });
                return { ok: true, value: mapped };
            } catch (err) {
                console.error('[ops] addSupplier threw:', err);
                return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
            }
        },
        handleUpdateSupplier: async (id: string, updates: Partial<Supplier>): Promise<Result<void>> => {
            try {
                updates = upcaseParty(updates);
                // directUpdate (freeze-proof REST) - supabase.from() wedged so subbie edits never saved.
                const { error } = await directUpdate('suppliers', { id }, toSupplierUpdate(updates) as any);
                if (error) { console.error('[ops] updateSupplier failed:', error); return { ok: false, error: error.message }; }
                dispatch({ type: 'UPDATE_SUPPLIER', payload: { id, updates } });
                return { ok: true };
            } catch (err) {
                console.error('[ops] updateSupplier threw:', err);
                return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
            }
        },
        handleBulkAddSuppliers: async (suppliers: Omit<Supplier, 'id'>[]): Promise<Result<{ count: number }>> => {
            try {
                const rows = suppliers.map(s => toSupplierInsert({
                    complianceStatus: 'Pending', complianceDocs: [], rateCards: [], ...s,
                }));
                const { data, error } = await supabase.from('suppliers').insert(rows).select();
                if (error) { console.error('[ops] bulkAddSuppliers failed:', error); return { ok: false, error: error.message }; }
                const mapped = (data || []).map(r => mapSupplier(r, new Map(), new Map()));
                dispatch({ type: 'BULK_ADD_SUPPLIERS', payload: mapped });
                return { ok: true, value: { count: mapped.length } };
            } catch (err) {
                console.error('[ops] bulkAddSuppliers threw:', err);
                return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
            }
        },
        // Subcontractor onboarding: upload a compliance document (registration, BEE,
        // tax, insurance, etc.) to storage and record it with an optional expiry date.
        handleAddSupplierComplianceDoc: async (
            supplierId: string,
            doc: { type: ComplianceDoc['type']; name: string; file: File; expiryDate?: string },
            markValid?: boolean, // staff uploading an already-vetted doc -> Valid; supplier upload -> Pending Review
        ): Promise<Result<ComplianceDoc>> => {
            try {
                const safe = doc.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
                // Path MUST be {org}/{supplier}/file — the storage RLS policy checks these segments.
                const up = await uploadFile('supplier-docs', `${FBN_ORG_ID}/${supplierId}/${Date.now()}_${safe}`, doc.file);
                if (up.error || !up.url) return { ok: false, error: up.error || 'File upload failed.' };
                const expired = doc.expiryDate ? new Date(doc.expiryDate) < new Date() : false;
                const insertRow = {
                    organization_id: FBN_ORG_ID,
                    supplier_id: supplierId,
                    type: doc.type,
                    name: doc.name,
                    file_url: up.url,
                    file_name: doc.file.name,
                    expiry_date: doc.expiryDate || null,
                    status: (expired ? 'Expired' : markValid ? 'Valid' : 'Pending Review') as 'Valid' | 'Expired' | 'Pending Review',
                };
                const { data, error } = await runWrite(() => supabase.from('supplier_compliance_docs').insert(insertRow).select().single());
                if (error || !data) { console.error('[ops] addSupplierComplianceDoc failed:', error); return { ok: false, error: error?.message || 'Could not save the document.' }; }
                const mapped = mapSupplierComplianceDoc(data);
                const current = (stateRef.current.suppliers || []).find((s: Supplier) => s.id === supplierId);
                const newDocs = [...(current?.complianceDocs || []), mapped];
                dispatch({ type: 'UPDATE_SUPPLIER', payload: { id: supplierId, updates: { complianceDocs: newDocs } } });
                return { ok: true, value: mapped };
            } catch (err) {
                console.error('[ops] addSupplierComplianceDoc threw:', err);
                return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
            }
        },
        // Management vetting: accept (-> Valid) or set a compliance doc's status.
        handleVetComplianceDoc: async (supplierId: string, docId: string, status: 'Valid' | 'Pending Review' | 'Expired'): Promise<Result<void>> => {
            try {
                const { error } = await runWrite(() => supabase.from('supplier_compliance_docs').update({ status }).eq('id', docId));
                if (error) return { ok: false, error: error.message };
                const sup = (stateRef.current.suppliers || []).find((s: Supplier) => s.id === supplierId);
                const newDocs = (sup?.complianceDocs || []).map(d => d.id === docId ? { ...d, status } : d);
                dispatch({ type: 'UPDATE_SUPPLIER', payload: { id: supplierId, updates: { complianceDocs: newDocs } } });
                return { ok: true };
            } catch (err) { return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }; }
        },
        // Reject / remove a compliance doc.
        handleDeleteComplianceDoc: async (supplierId: string, docId: string): Promise<Result<void>> => {
            try {
                const { error } = await runWrite(() => supabase.from('supplier_compliance_docs').delete().eq('id', docId));
                if (error) return { ok: false, error: error.message };
                const sup = (stateRef.current.suppliers || []).find((s: Supplier) => s.id === supplierId);
                const newDocs = (sup?.complianceDocs || []).filter(d => d.id !== docId);
                dispatch({ type: 'UPDATE_SUPPLIER', payload: { id: supplierId, updates: { complianceDocs: newDocs } } });
                return { ok: true };
            } catch (err) { return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }; }
        },

        // -- Quotes -----------------------------------------------------------
        handleCreateQuote: async (quote: any): Promise<Result<Quote>> => {
            try {
                const quoteNumber = `QU-${Date.now()}`;
                const row = toQuoteInsert(quote, quoteNumber);
                const { data, error } = await supabase
                    .from('quotes').insert(row).select().single();
                if (error) { console.error('[ops] createQuote failed:', error); return { ok: false, error: error.message }; }
                const mapped = mapQuote(data);
                dispatch({ type: 'CREATE_QUOTE', payload: mapped });
                return { ok: true, value: mapped };
            } catch (err) {
                console.error('[ops] createQuote threw:', err);
                return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
            }
        },
        handleUpdateQuote: async (quote: Quote): Promise<Result<Quote>> => {
            try {
                const row = toQuoteUpdate(quote);
                const { error } = await supabase
                    .from('quotes').update(row).eq('id', quote.id);
                if (error) { console.error('[ops] updateQuote failed:', error); return { ok: false, error: error.message }; }
                dispatch({ type: 'UPDATE_QUOTE', payload: quote });
                return { ok: true, value: quote };
            } catch (err) {
                console.error('[ops] updateQuote threw:', err);
                return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
            }
        },
        handleAcceptQuote: async (quote: Quote): Promise<Result<Quote>> => {
            try {
                const { error } = await supabase
                    .from('quotes').update({ status: 'Accepted' }).eq('id', quote.id);
                if (error) { console.error('[ops] acceptQuote failed:', error); return { ok: false, error: error.message }; }
                const updated: Quote = { ...quote, status: 'Accepted' };
                dispatch({ type: 'UPDATE_QUOTE', payload: updated });
                return { ok: true, value: updated };
            } catch (err) {
                console.error('[ops] acceptQuote threw:', err);
                return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
            }
        },
        handleRejectQuote: async (quote: Quote): Promise<Result<Quote>> => {
            try {
                const { error } = await supabase
                    .from('quotes').update({ status: 'Rejected' }).eq('id', quote.id);
                if (error) { console.error('[ops] rejectQuote failed:', error); return { ok: false, error: error.message }; }
                const updated: Quote = { ...quote, status: 'Rejected' };
                dispatch({ type: 'UPDATE_QUOTE', payload: updated });
                return { ok: true, value: updated };
            } catch (err) {
                console.error('[ops] rejectQuote threw:', err);
                return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
            }
        },

        // -- Load Confirmations ----------------------------------------------
        handleCreateLoadConfirmation: async (data: any): Promise<Result<LoadConfirmation>> => {
            try {
                data = upcaseLoad(data);
                // Clean running number per month: FBN-2026-06-0001, -0002, …
                const now = new Date();
                const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                const numPrefix = `FBN-${ym}-`;
                let maxSeq = 0;
                (stateRef.current.loadConfirmations || []).forEach((l: any) => {
                    const m = (l.loadConNumber || '').match(/^FBN-\d{4}-\d{2}-(\d+)$/);
                    if (m && (l.loadConNumber || '').startsWith(numPrefix)) maxSeq = Math.max(maxSeq, parseInt(m[1], 10));
                });
                const loadConNumber = `${numPrefix}${String(maxSeq + 1).padStart(4, '0')}`;

                // Resolve the subcontractor FIRST (find or create) so the new load is
                // linked to it and counts as already assigned for dispatch — a
                // Transport Order with a subbie shouldn't ask you to assign again.
                const subName = (data.subcontractorName || '').trim();
                let resolvedSupplierId = (data.supplierId || '').trim();
                let subContactsFinal: any[] = [];
                if (subName) {
                    // Build every contact entered on the loadcon: the main controller
                    // (forAttention + email) PLUS each CC email (accounts / other
                    // controllers). These all get logged on the supplier so the next
                    // loadcon for this subbie pre-populates them.
                    const ccList = String(data.ccEmail || '').split(/[,;]/).map((s: string) => s.trim()).filter(Boolean);
                    const incoming = [
                        { name: data.forAttention || '', email: data.subcontractorEmail || '', phone: data.subcontractorDriverCell || '' },
                        ...ccList.map((email: string) => ({ name: '', email, phone: '' })),
                    ].filter(c => (c.name || '').trim() || (c.email || '').trim());
                    const existingSub = (stateRef.current.suppliers || []).find((s: any) => (s.name || '').toLowerCase() === subName.toLowerCase());
                    if (!existingSub) {
                        let seeded: any[] = [];
                        for (const c of incoming) { seeded = mergeContact(seeded, c) || seeded; }
                        subContactsFinal = seeded;
                        const supplierInput: any = {
                            name: subName,
                            type: 'Transport',
                            contactPerson: data.forAttention || '',
                            contactEmail: data.subcontractorEmail || '',
                            contactPhone: data.subcontractorDriverCell || '',
                            contacts: seeded,
                            address: '',
                            complianceStatus: 'Pending',
                            controllerContact: data.forAttention || '',
                        };
                        // Direct REST insert — the freeze-proof path (see lib/supabase.ts).
                        const { data: supRow, error: supErr } = await directInsert('suppliers', toSupplierInsert(supplierInput) as any);
                        if (supErr) console.error('[ops] auto-create subcontractor failed:', supErr);
                        else if (supRow) { resolvedSupplierId = (supRow as any).id; dispatch({ type: 'ADD_SUPPLIER', payload: mapSupplier(supRow, new Map(), new Map()) }); }
                    } else {
                        resolvedSupplierId = existingSub.id;
                        let merged = existingSub.contacts || []; let changed = false;
                        for (const c of incoming) { const m = mergeContact(merged, c); if (m) { merged = m; changed = true; } }
                        subContactsFinal = merged;
                        if (changed) {
                            const updates = { contacts: merged };
                            // Freeze-proof; non-blocking — never let a contact-merge stall the create.
                            void directUpdate('suppliers', { id: existingSub.id }, toSupplierUpdate(updates as any) as any)
                                .then(({ error: supErr }) => { if (supErr) console.error('[ops] merge subcontractor contacts failed:', supErr); else dispatch({ type: 'UPDATE_SUPPLIER', payload: { id: existingSub.id, updates } }); });
                        }
                    }
                }

                const row = toLoadConfirmationInsert(data, loadConNumber, branchIdByName);
                // A subbie + a buy-rate means it's allocated for dispatch already.
                if (resolvedSupplierId) {
                    row.supplier_id = resolvedSupplierId;
                    row.status = 'Driver Assigned';
                }
                // Route recipients from the subbie's saved contact preferences:
                // docs (LoadCon + POD) vs running status updates. The main controller
                // is the To; these are the CC lists. Falls back to the typed CC.
                const _mainEmail = (data.subcontractorEmail || '').toLowerCase();
                const _pick = (pred: (c: any) => boolean) => subContactsFinal
                    .filter(c => pred(c) && c.email && c.email.toLowerCase() !== _mainEmail)
                    .map(c => c.email);
                const _docsCc = _pick(c => c.getsDocs);
                const _updCc = _pick(c => c.getsUpdates);
                if (_docsCc.length) (row as any).cc_email = _docsCc.join(', ');
                (row as any).cc_updates = _updCc.length ? _updCc.join(', ') : null;
                // Client team CC: all the client's other saved contact emails, so the
                // whole client team is copied on the order + every status update.
                const _client = (stateRef.current.clients || []).find((c: any) => (data.clientId && c.id === data.clientId) || (c.name || '').toLowerCase() === (data.clientName || '').toLowerCase());
                const _clientMain = (data.clientEmail || '').toLowerCase();
                const _clientCc = (_client?.contacts || []).map((c: any) => c.email).filter((e: string) => e && e.toLowerCase() !== _clientMain);
                (row as any).client_cc = _clientCc.length ? _clientCc.join(', ') : null;
                // Back-dated load (loading AND delivery dates both already past) = the
                // cargo has already been delivered. Land it straight in Delivered/POD
                // and flag it so the board badges it; the POD-first flow takes over below.
                const _today0 = new Date(); _today0.setHours(0, 0, 0, 0);
                const _isPast = (d?: string) => { if (!d) return false; const dt = new Date(d); return !isNaN(dt.getTime()) && dt < _today0; };
                const backDated = _isPast(data.collectionDate) && _isPast(data.deliveryDate);
                if (backDated) { row.status = 'Delivered'; (row as any).back_dated = true; }
                if (data.isCollection) (row as any).is_collection = true;
                if (data.repEmail) (row as any).rep_email = data.repEmail;
                if (data.collectionRef) (row as any).collection_ref = data.collectionRef;
                if (data.unpackDepot) (row as any).unpack_depot = data.unpackDepot;
                if (data.importStage) (row as any).import_stage = data.importStage;
                // Direct REST insert — the freeze-proof path (see lib/supabase.ts).
                const { data: inserted, error } = await directInsert('load_confirmations', row as any);
                if (error || !inserted) {
                    console.error('[ops] createLoadConfirmation failed:', error);
                    return { ok: false, error: error?.message || 'Could not save the load.' };
                }
                const mapped = mapLoadConfirmation(inserted, { branchById });
                dispatch({ type: 'CREATE_LOAD_CONFIRMATION', payload: mapped });

                // Auto-send on booking: the LoadCon to the supplier and the Order to
                // the client (fire-and-forget; TEST MODE keeps them coming to you).
                const forEmail = { ...data, ...mapped };
                const newId = mapped.id;
                // Back-dated (already-delivered) load: DON'T send the client their
                // order up front; send the supplier the LoadCon + a POD request, and
                // the client gets the order WITH the signed POD once it's uploaded.
                const sendLoadConThenStamp = () => {
                    if (!forEmail.subcontractorEmail || mapped.sentToSupplierDate) return;
                    void sendLoadConToSupplier(forEmail).then(r => {
                        if (r.ok) {
                            const stamp = new Date().toISOString();
                            void directUpdate('load_confirmations', { id: newId }, { sent_to_supplier_date: stamp } as any);
                            dispatch({ type: 'UPDATE_LOAD_CONFIRMATION', payload: { id: newId, updates: { sentToSupplierDate: stamp } } });
                        }
                    });
                };

                if (data.isCollection) {
                    // Mobile Quick Collection: notify ops to action it + acknowledge the
                    // client. It then rides the normal LoadCon rails once ops assign.
                    // A bulk/depot batch suppresses the per-row ops ping/push (the bulk
                    // form sends ONE summary) but still acknowledges each client.
                    if (!data.suppressOpsNotify) {
                        void notifyOpsNewCollection(forEmail);
                        void directInvoke('send-push', { title: `New collection ${mapped.loadConNumber}`, body: `${forEmail.clientName || 'Client'}: ${forEmail.collectionPoint || ''} → ${forEmail.deliveryPoint || ''}`, url: `?track=${newId}` });
                    }
                    if (forEmail.clientEmail) void sendCollectionAckToClient(forEmail);
                    if (forEmail.subcontractorEmail) sendLoadConThenStamp();
                } else if (backDated) {
                    sendLoadConThenStamp();
                    if (forEmail.subcontractorEmail) void sendPodRequestEmail(forEmail);
                    // Client order intentionally NOT sent now — goes with the POD (submit-pod).
                } else {
                    sendLoadConThenStamp();
                    if (forEmail.clientEmail) void sendOrderToClient(forEmail);
                }

                // The load is saved — return success NOW so the form closes instantly.
                // Remembering the client in the client database is a nice-to-have that
                // runs in the background; it must never delay or block creating the load.
                const cName = (data.clientName || '').trim();
                if (cName) {
                    void (async () => {
                        try {
                            const cContact = { name: data.clientContact || '', email: data.clientEmail || '' };
                            const existingClient = (stateRef.current.clients || []).find((c: any) =>
                                (data.clientId && c.id === data.clientId) || (c.name || '').toLowerCase() === cName.toLowerCase());
                            if (!existingClient) {
                                const seeded = mergeContact([], cContact) || [];
                                const clientInput: any = { name: cName, contactPerson: data.clientContact || '', contactEmail: data.clientEmail || '', contactPhone: '', contacts: seeded, address: '' };
                                const { data: cRow, error: cErr } = await directInsert('clients', toClientInsert(clientInput) as any);
                                if (cErr) console.error('[ops] auto-create client failed:', cErr);
                                else if (cRow) dispatch({ type: 'ADD_CLIENT', payload: mapClient(cRow) });
                            } else {
                                const mergedContacts = mergeContact(existingClient.contacts, cContact);
                                if (mergedContacts) {
                                    const updates = { contacts: mergedContacts };
                                    const { error: cErr } = await writeWithRecovery(() => supabase.from('clients').update(toClientUpdate(updates as any)).eq('id', existingClient.id) as any);
                                    if (cErr) console.error('[ops] merge client contact failed:', cErr);
                                    else dispatch({ type: 'UPDATE_CLIENT', payload: { id: existingClient.id, updates } });
                                }
                            }
                        } catch (e) { console.error('[ops] background client merge failed:', e); }
                    })();
                }
                // Validation: flag anything that would stop the flow running smoothly
                // so ops can fix it now (returned to the caller for a toast).
                const warns: string[] = [];
                if (!data.clientEmail) warns.push("no client email — the client won't get updates");
                if (!data.collectionPoint || !data.deliveryPoint) warns.push('missing collection/delivery address');
                if (!resolvedSupplierId && !data.subcontractorEmail && !data.isCollection) warns.push('no transporter yet — assign on the board');
                return { ok: true, value: mapped, warning: warns.length ? warns.join('; ') : undefined } as any;
            } catch (err) {
                console.error('[ops] createLoadConfirmation threw:', err);
                return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
            }
        },
        handleUpdateLoadConfirmation: async (id: string, updates: Partial<LoadConfirmation>): Promise<Result<void>> => {
            try {
                updates = upcaseLoad(updates);
                const prev = (stateRef.current.loadConfirmations || []).find((l: LoadConfirmation) => l.id === id);
                const row = toLoadConfirmationUpdate(updates, branchIdByName);
                // Direct REST update — the freeze-proof path (editing a load used to
                // stall on the wedged supabase-js session, so changes never saved).
                const { error } = await directUpdate('load_confirmations', { id }, row as any);
                if (error) { console.error('[ops] updateLoadConfirmation failed:', error); return { ok: false, error: error.message }; }
                dispatch({ type: 'UPDATE_LOAD_CONFIRMATION', payload: { id, updates } });
                // Status changes are logged to load_status_history by a DB trigger
                // (captures staff, driver-WhatsApp and POD-upload changes alike).

                // If this load was ALREADY sent to the transporter and its real-world
                // details changed, re-send it flagged as AMENDED so they re-confirm.
                if (prev?.sentToSupplierDate) {
                    const FIELDS: { key: keyof LoadConfirmation; label: string }[] = [
                        { key: 'collectionPoint', label: 'Collection point' },
                        { key: 'deliveryPoint', label: 'Delivery point' },
                        { key: 'collectionDate', label: 'Loading date' },
                        { key: 'deliveryDate', label: 'Offloading date' },
                        { key: 'loadingTime', label: 'Loading time' },
                        { key: 'supplierRate', label: 'Transport rate' },
                        { key: 'loadType', label: 'Load type' },
                        { key: 'weightKg', label: 'Weight' },
                        { key: 'commodity', label: 'Commodity' },
                        { key: 'route', label: 'Route' },
                        { key: 'specialInstructions', label: 'Special instructions' },
                    ];
                    const changed = FIELDS
                        .filter(f => f.key in updates && `${(updates as any)[f.key] ?? ''}` !== `${(prev as any)[f.key] ?? ''}`)
                        .map(f => `${f.label}: ${(updates as any)[f.key] || '—'}`);
                    if (changed.length) sendAmendedLoadConEmail({ ...(prev || {}), ...updates, id }, changed);
                }
                // Inter-branch transfer: when the load is dispatched on the line-haul
                // (In Transit), tell the DESTINATION branch ops it's coming — cc origin.
                if (updates.status === 'In Transit' && prev?.status !== 'In Transit') {
                    const m = { ...(prev || {}), ...updates, id } as any;
                    if (m.collectionBranch && m.destinationBranch && m.collectionBranch !== m.destinationBranch) {
                        const veh = [m.subcontractorVehicleReg, m.subcontractorDriverName].filter(Boolean).join(' · ');
                        const html = brandedEmail(`<p><strong>Loaded for inter-branch transfer — ${m.collectionBranch} &rarr; ${m.destinationBranch}.</strong></p>
                          <p>Load <strong>${m.loadConNumber}</strong> for <strong>${m.clientName || ''}</strong> is on the line-haul${veh ? ` (<strong>${veh}</strong>)` : ''}, delivering to ${m.deliveryPoint || ''}.</p>
                          <p>Please prepare to receive and arrange delivery on arrival.</p>
                          <p>Regards,<br>FBN Transport</p>`);
                        void invokeFn('send-email', { body: { to: opsEmail(m.destinationBranch), cc: [opsEmail(m.collectionBranch), OPS_GENERAL], subject: `LINE-HAUL ${m.collectionBranch}→${m.destinationBranch} - ${m.loadConNumber} loaded`, html, fromName: 'FBN Transport' } });
                    }
                }
                // Inter-branch handover: when the load reaches the destination depot,
                // notify the DESTINATION branch ops to arrange the delivery leg (cc origin).
                if (updates.status === 'At Destination Depot' && prev?.status !== 'At Destination Depot') {
                    const m = { ...(prev || {}), ...updates, id } as any;
                    if (m.collectionBranch && m.destinationBranch && m.collectionBranch !== m.destinationBranch) {
                        const base = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '';
                        const html = brandedEmail(`<p><strong>Inter-branch handover.</strong></p>
                          <p>Load <strong>${m.loadConNumber}</strong> has arrived at the <strong>${m.destinationBranch}</strong> depot (${m.collectionBranch} &rarr; ${m.destinationBranch}).</p>
                          <p>Please arrange the delivery leg — assign a driver and ETA:</p>
                          ${emailButton(`${base}?accept=${id}`, 'Assign delivery driver &amp; ETA &rarr;', '#16a34a')}
                          <p>Regards,<br>FBN Transport</p>`);
                        void invokeFn('send-email', { body: { to: opsEmail(m.destinationBranch), cc: [opsEmail(m.collectionBranch), OPS_GENERAL], subject: `HANDOVER ${m.loadConNumber} at ${m.destinationBranch} - arrange delivery`, html, fromName: 'FBN Transport' } });
                    }
                }
                // Auto-fire the POD request the moment a load becomes Delivered
                // (only on the transition, and only if no POD is in yet).
                if (updates.status === 'Delivered' && prev?.status !== 'Delivered' && !prev?.podPhoto && !updates.podPhoto) {
                    sendPodRequestEmail({ ...(prev || {}), ...updates, id });
                }
                // Auto-update the client with a tracking link as the load changes phase.
                if (updates.status && updates.status !== prev?.status && CLIENT_PHASE_MSG[updates.status]) {
                    const merged = { ...(prev || {}), ...updates, id };
                    sendClientPhaseEmail(merged, updates.status);
                    sendSupplierPhaseEmail(merged, updates.status);
                }
                // Message the DRIVER on WhatsApp at each phase with the next ask.
                if (updates.status && updates.status !== prev?.status && DRIVER_PHASE_MSG[updates.status]) {
                    const merged = { ...(prev || {}), ...updates, id };
                    const base = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '';
                    sendDriverWhatsApp(merged, DRIVER_PHASE_MSG[updates.status](merged, `${base}?pod=${id}`));
                }
                // When a POD comes in: notify the client AND send the subbie their copy.
                if (updates.status === 'POD Submitted' && prev?.status !== 'POD Submitted') {
                    const merged = { ...(prev || {}), ...updates, id };
                    sendClientPodEmail(merged);
                    sendSupplierPodEmail(merged);
                }
                return { ok: true };
            } catch (err) {
                console.error('[ops] updateLoadConfirmation threw:', err);
                return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
            }
        },
        // Pull the latest load_confirmations straight from the DB and replace the
        // local list — so carrier acceptances (driver/vehicle/ETA entered on the
        // public page) and any other out-of-app changes show up without a reload.
        handleRefreshLoads: async (): Promise<void> => {
            const { data } = await directSelect('load_confirmations?select=*&order=created_at.desc');
            if (Array.isArray(data)) {
                dispatch({ type: 'SET_LOAD_CONFIRMATIONS', payload: data.map((r: any) => mapLoadConfirmation(r, { branchById })) });
            }
        },
        // Super-admin housekeeping: permanently remove an incorrect / failed load.
        // Freeze-proof direct DELETE; RLS still enforces who's allowed.
        handleDeleteLoadConfirmation: async (id: string): Promise<Result<void>> => {
            try {
                const { error } = await directDelete('load_confirmations', { id });
                if (error) { console.error('[ops] deleteLoadConfirmation failed:', error); return { ok: false, error: error.message }; }
                dispatch({ type: 'DELETE_LOAD_CONFIRMATION', payload: { id } });
                return { ok: true };
            } catch (err) {
                return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
            }
        },
        handleAssignLoadConfirmation: async (loadConId: string, vehicleId: string, driverId: string): Promise<Result<void>> => {
            try {
                // Tier 2: an off-road (or sold) vehicle can't be dispatched.
                const veh = (stateRef.current.vehicles || []).find((v: any) => v.id === vehicleId);
                if (veh && veh.status !== 'On the road') {
                    return { ok: false, error: `${veh.name} is "${veh.status}" and can't be allocated to a trip.` };
                }
                const { error } = await supabase
                    .from('load_confirmations')
                    .update({ vehicle_id: vehicleId, driver_id: driverId, status: 'Driver Assigned' })
                    .eq('id', loadConId);
                if (error) { console.error('[ops] assignLoadConfirmation failed:', error); return { ok: false, error: error.message }; }
                dispatch({ type: 'UPDATE_LOAD_CONFIRMATION', payload: { id: loadConId, updates: { vehicleId, driverId, status: 'Driver Assigned' } } });
                return { ok: true };
            } catch (err) {
                console.error('[ops] assignLoadConfirmation threw:', err);
                return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
            }
        },
        handleApprovePayment: async (loadConId: string): Promise<Result<void>> => {
            try {
                const { error } = await supabase
                    .from('load_confirmations')
                    .update({ payment_status: 'Ready for Payment' })
                    .eq('id', loadConId);
                if (error) { console.error('[ops] approvePayment failed:', error); return { ok: false, error: error.message }; }
                dispatch({ type: 'UPDATE_LOAD_CONFIRMATION', payload: { id: loadConId, updates: { paymentStatus: 'Ready for Payment' } } });
                return { ok: true };
            } catch (err) {
                console.error('[ops] approvePayment threw:', err);
                return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
            }
        },

        // Persists the inspection to Supabase, then updates local state with the
        // saved row. Never reports success unless the write actually landed.
        handleAddChecklistSubmission: async (submission: any, currentUser: User): Promise<{ ok: boolean; error?: string }> => {
            try {
                if (!currentUser) return { ok: false, error: 'No signed-in user — cannot record who did the inspection.' };
                const odometer = submission.odometer ?? 0;
                const insertRow = toChecklistSubmissionInsert({
                    templateId: submission.templateId,
                    templateName: submission.templateName,
                    vehicleId: submission.vehicleId,
                    userId: currentUser.email,
                    userName: currentUser.name,
                    odometer,
                    hours: submission.hours,
                    results: submission.allResults ?? submission.results ?? [],
                });
                const { data, error } = await runWrite(() =>
                    supabase.from('checklist_submissions').insert(insertRow).select().single());
                if (error || !data) {
                    console.error('[ops] addChecklistSubmission failed:', error);
                    return { ok: false, error: error?.message || 'The checklist could not be saved.' };
                }
                // Best-effort: keep the vehicle's odometer/hours current.
                const cur = stateRef.current;
                const vehicle = (cur.vehicles || []).find((v: any) => v.id === submission.vehicleId);
                const vUpdates: any = {};
                if (vehicle && (!vehicle.currentOdometer || odometer > vehicle.currentOdometer)) vUpdates.current_odometer = odometer;
                if (vehicle && submission.hours && (!vehicle.currentHours || submission.hours > vehicle.currentHours)) vUpdates.current_hours = submission.hours;
                if (Object.keys(vUpdates).length > 0) {
                    const { error: vErr } = await supabase.from('vehicles').update(vUpdates).eq('id', submission.vehicleId);
                    if (vErr) console.error('[ops] checklist vehicle odo/hours bump failed:', vErr);
                }
                dispatch({ type: 'ADD_CHECKLIST_SUBMISSION', payload: { persisted: mapChecklistSubmission(data), vehicleId: submission.vehicleId, currentUser, odometer, hours: submission.hours } });

                // Tier 2 — close the inspection→maintenance loop:
                // every failed item flagged for a job card becomes a workshop job,
                // and a critical fault takes the vehicle off the road immediately.
                const results = submission.allResults ?? submission.results ?? [];
                const flagged = results.filter((r: any) => r.status === 'Fail' && r.createJobCard);
                let anyCritical = false;
                for (const item of flagged) {
                    const severity = item.severity || item.priority || 'Medium';
                    const priority = item.priority || item.severity || 'Medium';
                    if (severity === 'Critical' || priority === 'Critical') anyCritical = true;
                    const jcInput: any = {
                        vehicleId: submission.vehicleId,
                        submissionId: data.id,
                        checklistItemId: item.itemId,
                        itemDescription: item.item,
                        reporterNotes: item.notes || '',
                        type: 'Repair',
                        status: 'Reported',
                        priority,
                        severity,
                        reportedDate: new Date().toISOString(),
                    };
                    const { data: jcData, error: jcErr } = await runWrite(() =>
                        supabase.from('job_cards').insert(toJobCardInsert(jcInput)).select().single());
                    if (jcErr || !jcData) { console.error('[ops] auto job-card create failed:', jcErr); continue; }
                    dispatch({ type: 'CREATE_JOB_CARD', payload: mapJobCard(jcData) });
                }
                if (anyCritical) {
                    const { error: stErr } = await supabase.from('vehicles').update({ status: 'Off the road' }).eq('id', submission.vehicleId);
                    if (stErr) console.error('[ops] critical off-road status update failed:', stErr);
                    else dispatch({ type: 'UPDATE_VEHICLE', payload: { vehicleId: submission.vehicleId, updates: { status: 'Off the road' } } });
                }

                return { ok: true };
            } catch (err) {
                console.error('[ops] addChecklistSubmission threw:', err);
                return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
            }
        },

        // -- Deferred to later push (still local-only) ------------------------
        // Manifests, trip sheets, and supplier applications are not yet wired to
        // Supabase. They mutate local state only via the reducer.
        handleCreateManifest: (payload: any) => dispatch({ type: 'CREATE_MANIFEST', payload }),
        handleCreateTripSheet: (payload: any) => dispatch({ type: 'CREATE_TRIP_SHEET', payload }),
        handleAddSupplierApplication: (data: any) => dispatch({ type: 'ADD_SUPPLIER_APPLICATION', payload: data }),
    }), [dispatch, branchIdByName, branchById]);

    const value = useMemo(() => ({ ...state, ...derived, ...handlers, users }), [state, derived, handlers, users]);
    return <OperationsContext.Provider value={value}>{children}</OperationsContext.Provider>;
};

export const useOperations = () => useContext(OperationsContext);
