
import React, { createContext, useContext, useMemo, useRef, ReactNode } from 'react';
import { RawDataContext } from './RawDataContext';
import { CommonDataContext } from './CommonDataContext';
import { User, Quote, LoadConfirmation, Client, Supplier, Branch, ComplianceDoc, SupplierApplication, SubcontractorInvite, RfqRequest, RfqRecipient, CarrierQuote } from '../types';
import { supabase, runWrite, uploadFile, directInsert, directUpdate, directDelete, directSelect, directInvoke, invokeFn } from '../lib/supabase';
import {
    toClientInsert, toClientUpdate, toSupplierInsert, toSupplierUpdate, toQuoteInsert, toQuoteUpdate,
    toLoadConfirmationInsert, toLoadConfirmationUpdate,
    mapClient, mapSupplier, mapQuote, mapLoadConfirmation,
    toChecklistSubmissionInsert, mapChecklistSubmission,
    toJobCardInsert, mapJobCard, mapSupplierComplianceDoc,
    mapManifest, mapTripSheet, mapSubcontractorInvite, FBN_ORGANIZATION_ID,
    mapRfqRequest, mapRfqRecipient, mapCarrierQuote, toRfqRequestInsert, toCarrierQuoteInsert,
} from '../lib/mappers';

import { brandedEmail, emailButton } from '../lib/emailTemplate';
import { sendLoadConToSupplier, sendOrderToClient, clientSubject, sendClientGroupUpdate } from '../lib/loadEmails';
import { phoneZA } from '../lib/format';

const FBN_ORG_ID = '00000000-0000-0000-0000-000000000001';

// Default body for the carrier-recruitment invite (editable per campaign in the
// UI). {name} / {company} are substituted per recipient. HTML — sits inside the
// branded email wrapper, between the greeting and the call-to-action button.
export const DEFAULT_INVITE_INTRO = `
<p>FBN Transport is expanding its national subcontractor network, and we'd like to invite <strong>{company}</strong> to join.</p>
<p>As an approved FBN carrier you'll get access to a steady stream of vetted loads across breakbulk, full loads, tankers, tipper bulk, abnormals and hazchem — matched to the routes and equipment you run, with prompt POD-based payment.</p>
<p>Getting started takes a few minutes: confirm your details, the routes you specialise in, upload your fleet list, rate card and Goods-in-Transit cover, and our compliance team will vet and onboard you.</p>`;

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
    'In Transit': 'has been dispatched and is on its way',
    'At Destination Depot': 'has been received at our destination depot',
    'Unloaded': 'has been assigned to a local delivery vehicle',
    'Out for Delivery': 'has been loaded and dispatched for delivery',
    'Delivered': 'has been delivered',
};

// Neaten data entry: store free-text fields in UPPERCASE (transport-doc style)
// and cell/phone numbers in +27 international form — but NEVER touch emails.
// Applied at the save layer so the board, LoadCons and emails all read consistently.
const upStr = (v: any) => (typeof v === 'string' && v.trim() ? v.toUpperCase() : v);
const upContacts = (cs: any) => Array.isArray(cs) ? cs.map((c: any) => ({ ...c, name: upStr(c.name), role: upStr(c.role), title: upStr(c.title), phone: c.phone ? phoneZA(c.phone) : c.phone })) : cs;
const LOAD_UP = ['clientName', 'clientContact', 'collectionPoint', 'deliveryPoint', 'commodity', 'packaging', 'loadType', 'route', 'customerOrderNumber', 'loadRefNo', 'subcontractorName', 'forAttention', 'subcontractorDriverName', 'subcontractorVehicleReg', 'specialInstructions', 'dimensions'];
export const upcaseLoad = (o: any) => { if (!o || typeof o !== 'object') return o; const x = { ...o }; for (const k of LOAD_UP) if (k in x) x[k] = upStr(x[k]); return x; };
const PARTY_UP = ['name', 'contactPerson', 'address'];
export const upcaseParty = (o: any) => {
    if (!o || typeof o !== 'object') return o; const x = { ...o };
    for (const k of PARTY_UP) if (k in x) x[k] = upStr(x[k]);
    if ('contactPhone' in x && x.contactPhone) x.contactPhone = phoneZA(x.contactPhone);
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
// Statuses that belong to FBN's ONWARD leg (after the cross-dock). On a transit
// load the subcontractor's job ends when they deliver to the FBN depot, so they
// must NOT get these updates — FBN drives the load from the depot to the door.
const POST_DEPOT_STATUSES = ['At Destination Depot', 'Unloaded', 'Out for Delivery', 'Delivered'];
export const sendSupplierPhaseEmail = async (lc: any, status: string): Promise<void> => {
    const to = lc?.subcontractorEmail;
    const msg = CLIENT_PHASE_MSG[status];
    if (!to || !msg) return;
    // Transit load: the subbie delivered to the depot — stop their updates here.
    if (lc?.transitDepot && POST_DEPOT_STATUSES.includes(status)) return;
    const route = `${lc.collectionPoint || ''}${lc.deliveryPoint ? ' to ' + lc.deliveryPoint : ''}`;
    const base = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '';
    // Once delivered, the next action is the POD — ask for that, not a status update.
    const delivered = status === 'Delivered';
    const html = brandedEmail(`<p>Good day ${lc.forAttention || lc.subcontractorName || ''},</p>
      <p>Status update on load <strong>${lc.loadConNumber}</strong>${route ? ` (${route})` : ''}: it <strong>${msg}</strong>.</p>
      ${delivered
        ? `<p>Please <strong>upload the signed POD</strong> to close this load:</p>
      ${emailButton(`${base}?pod=${lc.id}`, 'Upload POD &rarr;', '#16a34a')}`
        : `<p>Please push the next update from your portal as the load progresses:</p>
      ${emailButton(`${base}?update=${lc.id}`, 'Update this load &rarr;')}
      <p style="font-size:13px;color:#5b6573">POD to be returned on delivery (you can upload it from the same portal).</p>`}
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
    const fmtDT = (s?: string) => { if (!s) return ''; const d = new Date(s); if (isNaN(d.getTime())) return s; return String(s).includes('T') ? d.toLocaleString('en-ZA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }); };
    // For a dispatch (In Transit) we tell the client the PLANNED DELIVERY date.
    const eta = (status === 'Driver Assigned' || status === 'At Collection Point') ? lc.loadingEta : status === 'Out for Delivery' ? lc.deliveryEta : status === 'In Transit' ? (lc.deliveryEta || lc.deliveryDate) : '';
    const etaLabel = status === 'In Transit' ? 'Planned delivery' : 'ETA';
    const etaLine = eta ? `<p style="font-size:15px;color:#13294b">${etaLabel}: <strong>${fmtDT(eta)}</strong></p>` : '';
    const html = brandedEmail(`<p>Good day ${greet},</p>
      <p>An update on your shipment <strong>${lc.loadConNumber}</strong>${route ? ` (${route})` : ''}: it <strong>${msg}</strong>.</p>
      ${etaLine}
      ${emailButton(trackLink, 'Track your shipment &rarr;')}
      <p>Regards,<br>FBN Transport</p>`);
    try {
        // Client team + ops + (for rep-logged collections) the sales rep.
        const cc = [...String(lc.clientCc || '').split(/[,;]/).map((t: string) => t.trim()).filter(Boolean), ...opsCcForPhase(lc, status), ...(lc.repEmail ? [lc.repEmail] : [])];
        await invokeFn('send-email', { body: { to, cc, subject: clientSubject(lc), html, fromName: 'FBN Transport' } });
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
        await invokeFn('send-email', { body: { to, cc, subject: clientSubject(lc), html, fromName: 'FBN Transport' } });
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
    // Transit load: FBN delivers the onward leg and holds/uploads the final POD —
    // never ask the leg-1 subbie for the POD on this load.
    if (lc?.transitDepot) return;
    // The carrier's main email is the To; the upload-POD contacts (accounts etc.)
    // are CC'd here — this is the ONLY email they're added to.
    const podUploadCc = String(lc?.podUploadEmail || '').split(/[,;]/).map((t: string) => t.trim()).filter(Boolean);
    const to = lc?.subcontractorEmail || podUploadCc[0];
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
            body: { to, cc: [...String(lc.ccEmail || '').split(/[,;]/).map((t: string) => t.trim()).filter(Boolean), ...podUploadCc.filter((e: string) => e.toLowerCase() !== String(to).toLowerCase()), ...opsCcForPhase(lc, 'Delivered')], subject: `POD required - Load ${lc.loadConNumber}`, html, fromName: 'FBN Transport' },
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
    try { await invokeFn('send-email', { body: { to, cc, subject: clientSubject(lc), html, fromName: 'FBN Transport' } }); }
    catch (e) { console.error('[ops] collection ack failed:', e); }
};

// Collection time was reallocated (e.g. the 30-min check found it wasn't on
// track) — tell the client the revised collection time.
export const sendClientRevisedEtaEmail = async (lc: any): Promise<void> => {
    const to = lc?.clientEmail; if (!to) return;
    const d = lc.loadingEta ? new Date(lc.loadingEta) : null;
    const when = d && !isNaN(d.getTime()) ? d.toLocaleString('en-ZA', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
    const html = brandedEmail(`<div style="text-align:right;font-weight:800;color:#13294b;font-size:16px;margin-bottom:10px">${lc.loadConNumber}</div>
      <p>Good day ${lc.clientContact || lc.clientName || ''},</p>
      <p><strong>Please note an updated collection time.</strong> We now expect to collect from <strong>${lc.collectionPoint || ''}</strong>${when ? ` around <strong>${when}</strong>` : ' shortly'}.</p>
      ${emailButton(`${baseUrl()}?track=${lc.id}`, 'Track this collection &rarr;')}
      <p>Apologies for any inconvenience — we'll keep you posted.</p>
      <p>Kind regards,<br>FBN Transport &middot; Commercial Freight Specialists</p>`);
    const cc = [...String(lc.clientCc || '').split(/[,;]/).map((t: string) => t.trim()).filter(Boolean), opsEmail(lc.collectionBranch || lc.arrangingBranch), OPS_GENERAL];
    try { await invokeFn('send-email', { body: { to, cc, subject: `FBN Transport ${lc.loadConNumber} — revised collection time`, html, fromName: 'FBN Transport' } }); }
    catch (e) { console.error('[ops] revised-eta email failed:', e); }
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
                // directInsert (freeze-proof REST) — supabase.from().insert() can wedge
                // on a stale auth session, so "Generate Quote" appears to do nothing.
                const { data, error } = await directInsert('quotes', row as any);
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
                // directUpdate (freeze-proof REST) — see createQuote note above.
                const { error } = await directUpdate('quotes', { id: quote.id }, row as any);
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
                // Upload-POD contacts (e.g. accounts) — only reminded to UPLOAD the
                // POD once delivered; never on the LoadCon / status emails.
                const _podUpCc = _pick(c => c.getsPodUpload);
                if (_docsCc.length) (row as any).cc_email = _docsCc.join(', ');
                (row as any).cc_updates = _updCc.length ? _updCc.join(', ') : null;
                (row as any).pod_upload_email = _podUpCc.length ? _podUpCc.join(', ') : null;
                // Client team CC. Where a client has many CRM contacts (controllers,
                // accounts, sales leads scraped in), only the ones flagged getsUpdates
                // are copied on orders/updates — so we don't spam the whole office.
                // Backward-compatible: if NO contact is flagged, fall back to all
                // (old clients keep copying everyone, as before).
                const _client = (stateRef.current.clients || []).find((c: any) => (data.clientId && c.id === data.clientId) || (c.name || '').toLowerCase() === (data.clientName || '').toLowerCase());
                const _clientMain = (data.clientEmail || '').toLowerCase();
                const _clientContacts = (_client?.contacts || []);
                const _anyFlagged = _clientContacts.some((c: any) => c.getsUpdates);
                const _clientCc = _clientContacts
                    .filter((c: any) => (_anyFlagged ? c.getsUpdates : true))
                    .map((c: any) => c.email).filter((e: string) => e && e.toLowerCase() !== _clientMain);
                (row as any).client_cc = _clientCc.length ? _clientCc.join(', ') : null;
                // Back-dated load (loading AND delivery dates both already past) = the
                // cargo has already been delivered. Land it straight in Delivered/POD
                // and flag it so the board badges it; the POD-first flow takes over below.
                const _today0 = new Date(); _today0.setHours(0, 0, 0, 0);
                const _isPast = (d?: string) => { if (!d) return false; const dt = new Date(d); return !isNaN(dt.getTime()) && dt < _today0; };
                const backDated = _isPast(data.collectionDate) && _isPast(data.deliveryDate);
                if (backDated) { row.status = 'Delivered'; (row as any).back_dated = true; }
                if ((data as any).transitDepot) { (row as any).transit_depot = (data as any).transitDepot; (row as any).onward_planned_date = (data as any).onwardPlannedDate || null; (row as any).onward_planned_time = (data as any).onwardPlannedTime || null; }
                if (data.isCollection) (row as any).is_collection = true;
                if (data.loadGroupId) (row as any).load_group_id = data.loadGroupId;
                if (data.isPrimary === false) (row as any).is_primary = false;
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
                    void directInvoke('send-push', { title: `New load ${mapped.loadConNumber}`, body: `${forEmail.clientName || 'Client'}: ${forEmail.collectionPoint || ''} → ${forEmail.deliveryPoint || ''}`, url: `?track=${newId}` });
                } else {
                    // Split-group child trucks suppress their own loadcon + client order:
                    // the client already has ONE order for the waybill, and loadcons are
                    // sent grouped per subbie by handleSplitLoad.
                    if (!data.suppressLoadCon) sendLoadConThenStamp();
                    if (forEmail.clientEmail && !data.suppressClientOrder) void sendOrderToClient(forEmail);
                    // Pop a web-push for every new load so ops see it even off-app.
                    void directInvoke('send-push', { title: `New load ${mapped.loadConNumber}`, body: `${forEmail.clientName || 'Client'}: ${forEmail.collectionPoint || ''} → ${forEmail.deliveryPoint || ''}`, url: `?track=${newId}` });
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
        // Split one client waybill across several trucks/subbies. allocations[0]
        // applies to the existing (primary) load — truck 1, which keeps the client
        // charge + single invoice. Each further allocation becomes a child truck
        // loadcon (cost only, totalAmount 0) sharing the loadGroupId. Returns every
        // load in the group so the caller can send each subbie their loadcon.
        handleSplitLoad: async (parentId: string, allocations: any[]): Promise<Result<any>> => {
            try {
                const parent = (stateRef.current.loadConfirmations || []).find((l: any) => l.id === parentId);
                if (!parent) return { ok: false, error: 'Load not found.' };
                const groupId = parent.loadGroupId || parentId;
                const findSupplierId = (name?: string) => {
                    const n = (name || '').trim().toLowerCase();
                    if (!n) return '';
                    return (stateRef.current.suppliers || []).find((s: any) => (s.name || '').toLowerCase() === n)?.id || '';
                };
                // 1) Update the primary (truck 1) with its allocation + group flags.
                const a0 = allocations[0] || {};
                const pUpd: any = { loadGroupId: groupId, isPrimary: true };
                if (a0.subcontractorName !== undefined) pUpd.subcontractorName = a0.subcontractorName;
                if (a0.subcontractorEmail !== undefined) pUpd.subcontractorEmail = a0.subcontractorEmail;
                if (a0.forAttention !== undefined) pUpd.forAttention = a0.forAttention;
                if (a0.supplierRate !== undefined && a0.supplierRate !== '') pUpd.supplierRate = Number(a0.supplierRate);
                if (a0.packages !== undefined && a0.packages !== '') pUpd.loadedPackages = Number(a0.packages);
                if (a0.weightKg !== undefined && a0.weightKg !== '') pUpd.weightKg = String(a0.weightKg);
                const sid0 = a0.supplierId || findSupplierId(a0.subcontractorName);
                if (sid0) pUpd.supplierId = sid0;
                await directUpdate('load_confirmations', { id: parentId }, toLoadConfirmationUpdate(pUpd, branchIdByName) as any);
                dispatch({ type: 'UPDATE_LOAD_CONFIRMATION', payload: { id: parentId, updates: pUpd } });

                // 2) Create a child truck loadcon per further allocation.
                const now = new Date();
                const numPrefix = `FBN-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-`;
                let maxSeq = 0;
                (stateRef.current.loadConfirmations || []).forEach((l: any) => {
                    const m = (l.loadConNumber || '').match(/^FBN-\d{4}-\d{2}-(\d+)$/);
                    if (m && (l.loadConNumber || '').startsWith(numPrefix)) maxSeq = Math.max(maxSeq, parseInt(m[1], 10));
                });
                const groupLoads: any[] = [{ ...parent, ...pUpd }];
                for (const a of allocations.slice(1)) {
                    const num = `${numPrefix}${String(++maxSeq).padStart(4, '0')}`;
                    const childData: any = {
                        clientId: parent.clientId, clientName: parent.clientName, clientEmail: parent.clientEmail, clientContact: parent.clientContact, clientCc: parent.clientCc,
                        collectionBranch: parent.collectionBranch, destinationBranch: parent.destinationBranch,
                        collectionPoint: parent.collectionPoint, deliveryPoint: parent.deliveryPoint, route: parent.route,
                        collectionDate: parent.collectionDate, deliveryDate: parent.deliveryDate, loadingTime: parent.loadingTime,
                        commodity: parent.commodity, packaging: parent.packaging, loadType: parent.loadType,
                        loadRefNo: parent.loadRefNo || parent.loadConNumber, customerOrderNumber: parent.customerOrderNumber,
                        collectionContact: parent.collectionContact, collectionTelephone: parent.collectionTelephone,
                        deliveryContact: parent.deliveryContact, deliveryTelephone: parent.deliveryTelephone,
                        priority: parent.priority, isCollection: parent.isCollection,
                        totalAmount: 0, // children carry cost only — client billed once on the primary
                        supplierRate: a.supplierRate !== undefined && a.supplierRate !== '' ? Number(a.supplierRate) : undefined,
                        subcontractorName: a.subcontractorName || '', subcontractorEmail: a.subcontractorEmail || '', forAttention: a.forAttention || '',
                        weightKg: a.weightKg !== undefined && a.weightKg !== '' ? String(a.weightKg) : undefined,
                    };
                    if (a.packages !== undefined && a.packages !== '') childData.loadedPackages = Number(a.packages);
                    const row = toLoadConfirmationInsert(childData, num, branchIdByName);
                    (row as any).load_group_id = groupId;
                    (row as any).is_primary = false;
                    const csid = a.supplierId || findSupplierId(a.subcontractorName);
                    if (csid) { (row as any).supplier_id = csid; (row as any).status = 'Driver Assigned'; }
                    else if (a.subcontractorName) (row as any).status = 'Driver Assigned';
                    const { data: inserted, error } = await directInsert('load_confirmations', row as any);
                    if (error || !inserted) { console.error('[ops] split child create failed:', error); continue; }
                    const mapped = mapLoadConfirmation(inserted, { branchById });
                    dispatch({ type: 'CREATE_LOAD_CONFIRMATION', payload: mapped });
                    groupLoads.push(mapped);
                }
                return { ok: true, value: { groupId, loads: groupLoads } };
            } catch (e) {
                console.error('[ops] handleSplitLoad threw:', e);
                return { ok: false, error: e instanceof Error ? e.message : 'Split failed' };
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
                // Transit depot: when leg 1 is received at the cross-dock, notify the
                // TRANSIT depot ops to plan the onward leg (cc the final-region ops).
                if ((updates as any).transitReceivedAt && !(prev as any)?.transitReceivedAt) {
                    const m = { ...(prev || {}), ...updates, id } as any;
                    if (m.transitDepot) {
                        const base = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '';
                        const finalReg = (m.destinationBranch || '').replace('FBN ', '') || (m.deliveryPoint || '');
                        const html = brandedEmail(`<p><strong>Received at transit depot — onward delivery to plan.</strong></p>
                          <p>Load <strong>${m.loadConNumber}</strong> for <strong>${m.clientName || ''}</strong> has been received at the <strong>${m.transitDepot}</strong> depot and needs the onward leg to <strong>${finalReg}</strong> planned (assign FBN fleet or a subbie + delivery date/time).</p>
                          ${emailButton(`${base}?track=${id}`, 'Open the load &rarr;', '#16a34a')}
                          <p>Regards,<br>FBN Transport</p>`);
                        void invokeFn('send-email', { body: { to: opsEmail(m.transitDepot), cc: [opsEmail(m.destinationBranch), OPS_GENERAL], subject: `TRANSIT ${m.loadConNumber} received at ${m.transitDepot} - plan onward to ${finalReg}`, html, fromName: 'FBN Transport' } });
                    }
                }
                // Auto-fire the POD request the moment a load becomes Delivered
                // (only on the transition, and only if no POD is in yet).
                if (updates.status === 'Delivered' && prev?.status !== 'Delivered' && !prev?.podPhoto && !updates.podPhoto) {
                    sendPodRequestEmail({ ...(prev || {}), ...updates, id });
                }
                // Auto-update the client as the load changes phase. A SPLIT waybill
                // (several trucks on one order) gets ONE consolidated update listing
                // every vehicle — re-sent on a phase change OR when a vehicle's reg/
                // driver/ETA is added — instead of a separate email per truck.
                {
                    const merged = { ...(prev || {}), ...updates, id };
                    const groupSibs = merged.loadGroupId
                        ? (stateRef.current.loadConfirmations || []).filter((l: any) => l.loadGroupId === merged.loadGroupId).map((l: any) => l.id === id ? merged : l)
                        : [];
                    const isGroup = groupSibs.length > 1;
                    const statusPhase = !!(updates.status && updates.status !== prev?.status && CLIENT_PHASE_MSG[updates.status]);
                    const vehicleOrEta = ['subcontractorVehicleReg', 'subcontractorDriverName', 'subcontractorDriverCell', 'loadingEta', 'deliveryEta']
                        .some(k => k in updates && `${(updates as any)[k] ?? ''}` !== `${(prev as any)?.[k] ?? ''}`);
                    // The subbie always gets their own per-truck phase update.
                    if (statusPhase) sendSupplierPhaseEmail(merged, updates.status as string);
                    if (isGroup) {
                        if (statusPhase || vehicleOrEta) sendClientGroupUpdate(groupSibs, merged);
                    } else if (statusPhase) {
                        sendClientPhaseEmail(merged, updates.status as string);
                    }
                    // Collection time reallocated → tell the client the new time (single
                    // load only; grouped loads already covered above), and re-arm the
                    // 30-min check against the new ETA.
                    if (updates.loadingEta && updates.loadingEta !== prev?.loadingEta && (prev?.isCollection ?? (updates as any).isCollection)) {
                        if (!isGroup && !statusPhase) sendClientRevisedEtaEmail(merged);
                        void directUpdate('load_confirmations', { id }, { eta_check_sent_at: null } as any);
                    }
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

        // -- Line-haul manifests + delivery trip sheets (persisted) -----------
        handleCreateManifest: async (payload: any) => {
            try {
                const ids: string[] = payload.loadConIds || [];
                const loads = (stateRef.current.loadConfirmations || []).filter((l: any) => ids.includes(l.id));
                const dest = payload.destinationBranch || loads.map((l: any) => l.destinationBranch).find((b: string) => b && b !== payload.originBranch) || payload.originBranch;
                const today = new Date().toISOString().slice(0, 10);
                const number = `MAN-${today.replace(/-/g, '')}-${String(Date.now()).slice(-4)}`;
                const manDriver = payload.driverId && String(payload.driverId).includes('@') ? ((users || []).find((u: any) => u.email === payload.driverId)?.id || null) : (payload.driverId || null);
                const row: any = { organization_id: FBN_ORGANIZATION_ID, manifest_number: number, origin_branch_id: branchIdByName.get(payload.originBranch) || null, destination_branch_id: branchIdByName.get(dest) || null, dispatch_date: today, vehicle_id: payload.vehicleId || null, driver_id: manDriver, load_confirmation_ids: ids, status: 'In Transit', trailer_size: payload.trailerSize || null };
                const { data, error } = await directInsert('manifests', row);
                if (error || !data) return { ok: false, error: error?.message || 'Could not save manifest.' };
                dispatch({ type: 'CREATE_MANIFEST', payload: mapManifest(data, { branchById }) });
                return { ok: true, value: mapManifest(data, { branchById }) };
            } catch (e) { return { ok: false, error: e instanceof Error ? e.message : 'error' }; }
        },
        handleCreateTripSheet: async (payload: any) => {
            try {
                const today = new Date().toISOString().slice(0, 10);
                const number = `TRP-${today.replace(/-/g, '')}-${String(Date.now()).slice(-4)}`;
                const trpDriver = payload.driverId && String(payload.driverId).includes('@') ? ((users || []).find((u: any) => u.email === payload.driverId)?.id || null) : (payload.driverId || null);
                const row: any = { organization_id: FBN_ORGANIZATION_ID, trip_sheet_number: number, branch_id: branchIdByName.get(payload.branch) || null, dispatch_date: today, vehicle_id: payload.vehicleId || null, driver_id: trpDriver, load_confirmation_ids: payload.loadConIds || [], status: 'Out for Delivery', odometer_start: payload.odometerStart ?? null };
                const { data, error } = await directInsert('trip_sheets', row);
                if (error || !data) return { ok: false, error: error?.message || 'Could not save trip sheet.' };
                dispatch({ type: 'CREATE_TRIP_SHEET', payload: mapTripSheet(data, { branchById }) });
                return { ok: true, value: mapTripSheet(data, { branchById }) };
            } catch (e) { return { ok: false, error: e instanceof Error ? e.message : 'error' }; }
        },
        // Receive a line-haul manifest at the destination depot: mark it Arrived
        // and advance every load on it to "At Destination Depot" (notifies client
        // + subbie), ready for the delivery run.
        handleReceiveManifest: async (manifestId: string) => {
            try {
                const man = (stateRef.current.manifests || []).find((m: any) => m.id === manifestId);
                const today = new Date().toISOString().slice(0, 10);
                await directUpdate('manifests', { id: manifestId }, { status: 'Arrived', arrival_date: today } as any);
                const done = ['At Destination Depot', 'Unloaded', 'Out for Delivery', 'Delivered', 'POD Submitted', 'Invoiced'];
                for (const id of (man?.loadConfirmationIds || [])) {
                    const lc = (stateRef.current.loadConfirmations || []).find((l: any) => l.id === id);
                    if (!lc || done.includes(lc.status)) continue;
                    await directUpdate('load_confirmations', { id }, { status: 'At Destination Depot' } as any);
                    dispatch({ type: 'UPDATE_LOAD_CONFIRMATION', payload: { id, updates: { status: 'At Destination Depot' } } });
                    const merged = { ...lc, status: 'At Destination Depot' };
                    sendClientPhaseEmail(merged, 'At Destination Depot');
                    sendSupplierPhaseEmail(merged, 'At Destination Depot');
                }
                const { data } = await directSelect('manifests?select=*');
                if (Array.isArray(data)) dispatch({ type: 'SET_MANIFESTS', payload: data.map((r: any) => mapManifest(r, { branchById })) });
                return { ok: true };
            } catch (e) { return { ok: false, error: e instanceof Error ? e.message : 'error' }; }
        },
        // Public "Join Carrier Network" submission. Persists to supplier_applications
        // via the anon client (a tightly-scoped anon INSERT policy permits Pending
        // FBN applications); document uploads are stored inline as data URLs. Lands
        // in the ops Onboarding Queue for vetting.
        handleAddSupplierApplication: async (data: any): Promise<Result<void>> => {
            try {
                const row = {
                    organization_id: FBN_ORG_ID,
                    status: 'Pending',
                    submitted_date: new Date().toISOString().slice(0, 10),
                    company_name: data.companyName,
                    contact_person: data.contactPerson || null,
                    contact_email: data.contactEmail || null,
                    contact_phone: data.contactPhone || null,
                    address: data.address || null,
                    specializations: data.specializations || [],
                    routes: data.routes || null,
                    fleet_size: data.fleetSize || null,
                    bee_status: data.beeStatus || null,
                    haz_compliant: !!data.hazCompliant,
                    vehicle_types: data.vehicleTypes || [],
                    trailer_types: data.trailerTypes || [],
                    invite_token: data.inviteToken || null,
                    fleet_list_url: data.fleetList?.data || null,
                    rate_card_url: data.rateCard?.data || null,
                    insurance_url: data.insurance?.data || null,
                };
                const { data: inserted, error } = await supabase.from('supplier_applications').insert(row as any).select().single();
                if (error || !inserted) { console.error('[ops] addSupplierApplication failed:', error); return { ok: false, error: error?.message || 'Could not submit application.' }; }
                dispatch({ type: 'ADD_SUPPLIER_APPLICATION', payload: data });
                return { ok: true };
            } catch (err) {
                console.error('[ops] addSupplierApplication threw:', err);
                return { ok: false, error: err instanceof Error ? err.message : 'Could not submit application.' };
            }
        },

        // --- Carrier (subcontractor) invitation campaign --------------------
        // Add a batch of transporter emails to the invite list. De-dupes against
        // the existing list and within the batch; each gets a unique accept token.
        handleAddSubcontractorInvites: async (
            entries: { email: string; companyName?: string; contactPerson?: string }[],
        ): Promise<Result<{ added: number; skipped: number }>> => {
            try {
                const existing = new Set((stateRef.current.subcontractorInvites || []).map((i: SubcontractorInvite) => i.email.toLowerCase()));
                const seen = new Set<string>();
                const clean: { email: string; companyName?: string; contactPerson?: string }[] = [];
                for (const e of entries) {
                    const email = String(e.email || '').trim().toLowerCase();
                    if (!email || !email.includes('@')) continue;
                    if (existing.has(email) || seen.has(email)) continue;
                    seen.add(email);
                    clean.push({ email, companyName: e.companyName?.trim() || undefined, contactPerson: e.contactPerson?.trim() || undefined });
                }
                if (!clean.length) return { ok: true, value: { added: 0, skipped: entries.length } };
                const added: SubcontractorInvite[] = [];
                for (const c of clean) {
                    const token = (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/-/g, '');
                    const row = { organization_id: FBN_ORG_ID, email: c.email, company_name: c.companyName || null, contact_person: c.contactPerson || null, token, status: 'Pending' };
                    const { data, error } = await directInsert('subcontractor_invites', row);
                    if (error || !data) { console.error('[ops] addSubcontractorInvite failed:', error); continue; }
                    added.push(mapSubcontractorInvite(data));
                }
                if (added.length) dispatch({ type: 'ADD_SUBCONTRACTOR_INVITES', payload: added });
                return { ok: true, value: { added: added.length, skipped: entries.length - added.length } };
            } catch (err) { return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }; }
        },
        // Send (or re-send) the branded marketing invite to the given invites via
        // the same send-email edge function used by LoadCons/PODs (so it routes
        // through Gmail and respects TEST MODE). Marks each Invited on success.
        handleSendSubcontractorInvites: async (
            inviteIds: string[],
            opts?: { subject?: string; intro?: string; buttonLabel?: string },
        ): Promise<Result<{ sent: number; failed: number }>> => {
            try {
                const base = (typeof window !== 'undefined') ? `${window.location.origin}${window.location.pathname}` : '';
                const invites = (stateRef.current.subcontractorInvites || []).filter((i: SubcontractorInvite) => inviteIds.includes(i.id));
                const subject = opts?.subject?.trim() || 'Partner with FBN Transport — join our carrier network';
                let sent = 0; const failed: string[] = [];
                for (const inv of invites) {
                    const greeting = inv.contactPerson || inv.companyName || 'there';
                    const intro = (opts?.intro || DEFAULT_INVITE_INTRO)
                        .replace(/\{name\}/g, greeting)
                        .replace(/\{company\}/g, inv.companyName || 'your company');
                    const link = `${base}?portal=become-supplier&invite=${inv.token}`;
                    const html = brandedEmail(`<p>Good day ${greeting},</p>${intro}
                      ${emailButton(link, opts?.buttonLabel?.trim() || 'Join the FBN carrier network &rarr;', '#16a34a')}
                      <p>We look forward to working with you.</p>
                      <p>Kind regards,<br>FBN Transport &middot; Commercial Freight Specialists</p>`);
                    const { data, error } = await invokeFn('send-email', { body: { to: inv.email, subject, html, fromName: 'FBN Transport' } });
                    if (error || (data as any)?.error) { failed.push(inv.email); continue; }
                    const now = new Date().toISOString();
                    const nextStatus = (inv.status === 'Pending' || inv.status === 'Invited') ? 'Invited' : inv.status;
                    const { data: ud } = await directUpdate('subcontractor_invites', { id: inv.id }, { sent_count: (inv.sentCount || 0) + 1, last_sent_at: now, status: nextStatus, updated_at: now });
                    dispatch({ type: 'UPDATE_SUBCONTRACTOR_INVITE', payload: ud ? mapSubcontractorInvite(ud) : { ...inv, sentCount: (inv.sentCount || 0) + 1, lastSentAt: now, status: nextStatus as SubcontractorInvite['status'] } });
                    sent++;
                }
                return { ok: failed.length === 0, value: { sent, failed: failed.length }, error: failed.length ? `Could not send to: ${failed.join(', ')}` : undefined };
            } catch (err) { return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }; }
        },
        // Update an invite (e.g. mark Declined / edit notes).
        handleUpdateSubcontractorInvite: async (id: string, updates: Partial<SubcontractorInvite>): Promise<Result<void>> => {
            try {
                const row: any = { updated_at: new Date().toISOString() };
                if (updates.status) row.status = updates.status;
                if (updates.notes !== undefined) row.notes = updates.notes;
                if (updates.companyName !== undefined) row.company_name = updates.companyName;
                if (updates.contactPerson !== undefined) row.contact_person = updates.contactPerson;
                const { data, error } = await directUpdate('subcontractor_invites', { id }, row);
                if (error) return { ok: false, error: error.message };
                const cur = (stateRef.current.subcontractorInvites || []).find((i: SubcontractorInvite) => i.id === id);
                dispatch({ type: 'UPDATE_SUBCONTRACTOR_INVITE', payload: data ? mapSubcontractorInvite(data) : { ...(cur as SubcontractorInvite), ...updates } });
                return { ok: true };
            } catch (err) { return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }; }
        },
        // Email an existing carrier the link to complete their online profile
        // (rates, routes, vehicle/trailer types, documents) via the public form.
        handleSendCarrierRegistrationLink: async (supplier: Supplier): Promise<Result<void>> => {
            try {
                const to = (supplier.contactEmail || '').trim();
                if (!to) return { ok: false, error: 'No email address on file for this carrier.' };
                const base = (typeof window !== 'undefined') ? `${window.location.origin}${window.location.pathname}` : '';
                const link = `${base}?portal=become-supplier`;
                const html = brandedEmail(`<p>Good day ${supplier.contactPerson || supplier.name},</p>
                  <p>As an approved FBN carrier, please complete your profile on our platform so we can match you to the right loads. Confirm the routes you specialise in, your vehicle &amp; trailer types, and upload your latest fleet list, rate card and Goods-in-Transit cover using the link below.</p>
                  ${emailButton(link, 'Complete your carrier profile &rarr;', '#16a34a')}
                  <p>Kind regards,<br>FBN Transport &middot; Commercial Freight Specialists</p>`);
                const { data, error } = await invokeFn('send-email', { body: { to, subject: 'Complete your FBN carrier profile', html, fromName: 'FBN Transport' } });
                if (error || (data as any)?.error) return { ok: false, error: (data as any)?.error || error?.message || 'Send failed.' };
                return { ok: true };
            } catch (err) { return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }; }
        },
        // Create a Subcontractor Portal login for an accepted carrier (via the
        // admin-create-user edge function) and email them their username +
        // temporary password and the portal link.
        handleCreateCarrierLogin: async (supplier: Supplier): Promise<Result<{ tempPassword?: string }>> => {
            try {
                const email = (supplier.contactEmail || '').trim();
                if (!email) return { ok: false, error: 'No email address on file for this carrier.' };
                const name = supplier.contactPerson || supplier.name;
                const { data, error } = await directInvoke('admin-create-user', { name, email, role: 'Supplier', supplierId: supplier.id, assignedBranches: [] });
                if (error) return { ok: false, error: error.message };
                if ((data as any)?.error) return { ok: false, error: (data as any).error };
                const tempPassword = (data as any)?.tempPassword;
                dispatch({ type: 'ADD_USER', payload: { name, email, role: 'Supplier', assignedBranches: [], assignedVehicleIds: [], isActive: true } });
                if (tempPassword) {
                    const base = (typeof window !== 'undefined') ? `${window.location.origin}${window.location.pathname}` : '';
                    const link = `${base}?portal=supplier`;
                    const cred = (label: string, val: string) => `<tr><td style="padding:4px 14px 4px 0;color:#13294b;font-size:13px;font-weight:700">${label}</td><td style="padding:4px 0;color:#13294b;font-size:13px;font-weight:700">${val}</td></tr>`;
                    const html = brandedEmail(`<p>Good day ${name},</p>
                      <p><strong>Welcome to the FBN carrier network — your account has been approved.</strong> You can now log in to the FBN Subcontractor Portal to view loads, manage your rates and documents, and receive quote requests.</p>
                      <table style="border-collapse:collapse;margin:10px 0 4px;background:#f8fafc;border:1px solid #e6ebf1;border-radius:8px;padding:6px">${cred('Username', email)}${cred('Temporary password', tempPassword)}</table>
                      ${emailButton(link, 'Log in to the carrier portal &rarr;', '#16a34a')}
                      <p>For your security, please change your password after your first login.</p>
                      <p>Kind regards,<br>FBN Transport &middot; Commercial Freight Specialists</p>`);
                    await invokeFn('send-email', { body: { to: email, subject: 'Your FBN Carrier Portal login', html, fromName: 'FBN Transport' } });
                }
                return { ok: true, value: { tempPassword } };
            } catch (err) { return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }; }
        },
        // Approve/reject a carrier application. On approval, persist the status and
        // create the live Supplier record (so it appears in the Active Network and
        // can be invited to log in), and advance any matching invite to Vetted.
        handleUpdateSupplierApplicationStatus: async (appId: string, status: 'Approved' | 'Rejected'): Promise<Result<Supplier | undefined>> => {
            try {
                const app = (stateRef.current.supplierApplications || []).find((a: SupplierApplication) => a.id === appId);
                // No-op if the application only exists in local state (no DB row yet).
                await directUpdate('supplier_applications', { id: appId }, { status, updated_at: new Date().toISOString() });
                let createdSupplier: Supplier | undefined;
                if (status === 'Approved' && app) {
                    // Don't duplicate a carrier we already have — if a Transport
                    // supplier with this email exists, update it in place instead.
                    const existing = (stateRef.current.suppliers || []).find((s: Supplier) => s.type === 'Transport' && s.contactEmail && app.contactEmail && s.contactEmail.toLowerCase() === app.contactEmail.toLowerCase());
                    const profileUpdates = {
                        contactPerson: app.contactPerson,
                        contactPhone: app.contactPhone,
                        address: app.address,
                        specializations: app.specializations,
                        regions: app.routes,
                        fleetSize: app.fleetSize,
                        beeStatus: app.beeStatus,
                        hazCompliant: app.hazCompliant,
                        vehicleTypes: app.vehicleTypes,
                        trailerTypes: app.trailerTypes,
                        isVetted: true,
                        vettedAt: new Date().toISOString(),
                    };
                    if (existing) {
                        await directUpdate('suppliers', { id: existing.id }, toSupplierUpdate(profileUpdates) as any);
                        dispatch({ type: 'UPDATE_SUPPLIER', payload: { id: existing.id, updates: profileUpdates } });
                        createdSupplier = { ...existing, ...profileUpdates } as Supplier;
                        await directUpdate('supplier_applications', { id: appId }, { approved_supplier_id: existing.id });
                    } else {
                    const supplierInput = {
                        name: app.companyName,
                        type: 'Transport' as const,
                        contactEmail: app.contactEmail,
                        complianceStatus: 'Pending' as const,
                        complianceDocs: [],
                        rateCards: [],
                        isActive: true,
                        ...profileUpdates,
                    };
                    const { data, error } = await directInsert('suppliers', toSupplierInsert(supplierInput));
                    if (error || !data) { console.error('[ops] approve -> createSupplier failed:', error); }
                    else {
                        createdSupplier = mapSupplier(data, new Map(), new Map());
                        dispatch({ type: 'ADD_SUPPLIER', payload: createdSupplier });
                        await directUpdate('supplier_applications', { id: appId }, { approved_supplier_id: createdSupplier.id });
                    }
                    }
                    if (createdSupplier) {
                        const inv = (stateRef.current.subcontractorInvites || []).find((i: SubcontractorInvite) => i.email.toLowerCase() === String(app.contactEmail || '').toLowerCase());
                        if (inv) {
                            const { data: ud } = await directUpdate('subcontractor_invites', { id: inv.id }, { status: 'Vetted', supplier_id: createdSupplier.id, updated_at: new Date().toISOString() });
                            dispatch({ type: 'UPDATE_SUBCONTRACTOR_INVITE', payload: ud ? mapSubcontractorInvite(ud) : { ...inv, status: 'Vetted', supplierId: createdSupplier.id } });
                        }
                    }
                }
                dispatch({ type: 'SET_SUPPLIER_APPLICATIONS', payload: (stateRef.current.supplierApplications || []).map((a: SupplierApplication) => a.id === appId ? { ...a, status } : a) });
                return { ok: true, value: createdSupplier };
            } catch (err) { return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }; }
        },

        // --- Carrier RFQ board ----------------------------------------------
        // Raise a load request and broadcast it to the chosen carriers. The
        // request "comes from" the arranging branch: replies route to that ops
        // mailbox (opsdbn@ / opsjhb@), which is also CC'd. Carriers without a
        // portal login can quote via the public ?rfq=<token> link in the email.
        handleCreateRfq: async (
            rfq: Partial<RfqRequest>,
            recipients: { supplierId?: string; email?: string; companyName?: string; channel?: RfqRecipient['channel'] }[],
        ): Promise<Result<RfqRequest>> => {
            try {
                const year = new Date().getFullYear();
                const seq = (stateRef.current.rfqRequests || []).length + 1;
                const requestNumber = `RFQ-${year}-${String(seq).padStart(4, '0')}`;
                const { data, error } = await directInsert('rfq_requests', toRfqRequestInsert(rfq, requestNumber) as any);
                if (error || !data) { console.error('[ops] createRfq failed:', error); return { ok: false, error: error?.message || 'Could not create the request.' }; }
                const rfqId = (data as any).id;

                const savedRecipients: RfqRecipient[] = [];
                for (const r of recipients) {
                    const { data: rd, error: re } = await directInsert('rfq_recipients', {
                        rfq_request_id: rfqId,
                        supplier_id: r.supplierId || null,
                        email: r.email || null,
                        company_name: r.companyName || null,
                        channel: r.channel || 'email',
                        sent_at: new Date().toISOString(),
                    } as any);
                    if (re || !rd) { console.error('[ops] createRfq recipient failed:', re); continue; }
                    savedRecipients.push(mapRfqRecipient(rd));
                }

                const domain = mapRfqRequest(data, { [rfqId]: savedRecipients }, {});
                dispatch({ type: 'ADD_RFQ_REQUEST', payload: domain });

                // Broadcast to recipients on the email channel.
                const base = baseUrl();
                const branchLabel = rfq.arrangingBranch === 'FBN DBN' ? 'FBN DBN Ops' : rfq.arrangingBranch === 'FBN JHB' ? 'FBN JHB Ops' : 'FBN Transport';
                const replyTo = opsEmail(rfq.arrangingBranch);
                const fmt = (v?: string | number | null) => (v === undefined || v === null || v === '') ? '&mdash;' : String(v);
                const specRows = [
                    ['Route', `${fmt(rfq.origin)} &rarr; ${fmt(rfq.destination)}`],
                    ['Vehicle required', fmt(rfq.vehicleType)],
                    ['Load', [rfq.loadType, rfq.commodity].filter(Boolean).join(' &middot; ') || '&mdash;'],
                    ['Weight', rfq.weightKg ? `${Number(rfq.weightKg).toLocaleString('en-ZA')} kg` : '&mdash;'],
                    ['Hazardous (DG)', rfq.hazardous ? 'YES — DG load' : 'No'],
                    ['GIT cover', rfq.gitRequired ? 'Required' : 'Not required'],
                    ['Collection', [rfq.collectionDate, rfq.collectionTime].filter(Boolean).join(' &middot; ') || '&mdash;'],
                    ['Delivery', [rfq.deliveryDate, rfq.deliveryTime].filter(Boolean).join(' &middot; ') || '&mdash;'],
                ].map(([k, v]) => `<tr><td style="padding:6px 16px 6px 0;color:#64748b;font-size:13px;white-space:nowrap">${k}</td><td style="padding:6px 0;color:#13294b;font-size:13px;font-weight:700">${v}</td></tr>`).join('');

                for (const rec of savedRecipients) {
                    if (rec.channel !== 'email' || !rec.email) continue;
                    const link = `${base}?rfq=${rec.token}`;
                    const html = brandedEmail(`<p>Good day ${rec.companyName || 'there'},</p>
                      <p>We have a load available and would like your best rate if you can assist. Please review the details and submit your quote &mdash; or let us know you can't help on this one.</p>
                      <table style="border-collapse:collapse;margin:8px 0 4px;background:#f8fafc;border:1px solid #e6ebf1;border-radius:10px;padding:8px">${specRows}</table>
                      ${rfq.notes ? `<p style="color:#475569;font-size:13px"><strong>Notes:</strong> ${rfq.notes}</p>` : ''}
                      ${emailButton(link, 'Submit your quote &rarr;', '#16a34a')}
                      <p style="color:#94a3b8;font-size:12px">Reference ${requestNumber}. Reply to this email to reach ${branchLabel} directly.</p>`);
                    void invokeFn('send-email', { body: { to: rec.email, cc: [replyTo], replyTo, subject: `Load available: ${rfq.origin} → ${rfq.destination} (${requestNumber})`, html, fromName: branchLabel } });
                }
                return { ok: true, value: domain };
            } catch (err) { return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }; }
        },
        // Update an RFQ (status changes: close / cancel / re-open).
        handleUpdateRfq: async (id: string, updates: Partial<RfqRequest>): Promise<Result<void>> => {
            try {
                const row: any = { updated_at: new Date().toISOString() };
                if (updates.status) row.status = updates.status;
                if (updates.awardedQuoteId !== undefined) row.awarded_quote_id = updates.awardedQuoteId ?? null;
                if (updates.quoteId !== undefined) row.quote_id = updates.quoteId ?? null;
                if (updates.clientId !== undefined) row.client_id = updates.clientId ?? null;
                if (updates.notes !== undefined) row.notes = updates.notes ?? null;
                const { error } = await directUpdate('rfq_requests', { id }, row);
                if (error) return { ok: false, error: error.message };
                const cur = (stateRef.current.rfqRequests || []).find((r: RfqRequest) => r.id === id);
                if (cur) dispatch({ type: 'UPDATE_RFQ_REQUEST', payload: { ...cur, ...updates } });
                return { ok: true };
            } catch (err) { return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }; }
        },
        // Manually capture a quote that came back by phone / WhatsApp / email, or
        // record one on a carrier's behalf.
        handleAddCarrierQuote: async (rfqId: string, q: Partial<CarrierQuote>): Promise<Result<void>> => {
            try {
                const { data, error } = await directInsert('rfq_carrier_quotes', toCarrierQuoteInsert(rfqId, q) as any);
                if (error || !data) return { ok: false, error: error?.message || 'Could not save the quote.' };
                const cq = mapCarrierQuote(data);
                const cur = (stateRef.current.rfqRequests || []).find((r: RfqRequest) => r.id === rfqId);
                if (cur) dispatch({ type: 'UPDATE_RFQ_REQUEST', payload: { ...cur, quotes: [...cur.quotes, cq] } });
                return { ok: true };
            } catch (err) { return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }; }
        },
        // A logged-in carrier submits their quote from the Subcontractor Portal.
        // Inserts under their own RLS, updates the board, and notifies the
        // arranging-branch ops inbox (the carrier is authenticated, so send-email
        // is allowed).
        handleSubmitCarrierQuote: async (rfqId: string, payload: Partial<CarrierQuote>): Promise<Result<void>> => {
            try {
                const { data, error } = await directInsert('rfq_carrier_quotes', toCarrierQuoteInsert(rfqId, payload) as any);
                if (error || !data) return { ok: false, error: error?.message || 'Could not submit your quote.' };
                const cq = mapCarrierQuote(data);
                const cur = (stateRef.current.rfqRequests || []).find((r: RfqRequest) => r.id === rfqId);
                if (cur) dispatch({ type: 'UPDATE_RFQ_REQUEST', payload: { ...cur, quotes: [...cur.quotes.filter(q => q.id !== cq.id), cq] } });
                if (cur) {
                    const to = opsEmail(cur.arrangingBranch);
                    const priceLine = payload.canAssist === false ? "Cannot assist on this load." : `Rate: R ${Number(payload.price || 0).toLocaleString('en-ZA')}`;
                    const html = brandedEmail(`<p>A carrier responded to <strong>${cur.requestNumber}</strong> (${cur.origin} &rarr; ${cur.destination}).</p>
                      <p><strong>${payload.companyName || 'Carrier'}</strong><br>${priceLine}${payload.vehicleOffered ? `<br>Vehicle: ${payload.vehicleOffered}` : ''}${payload.notes ? `<br>Notes: ${payload.notes}` : ''}</p>
                      <p>Open the Carrier RFQs board to compare and award.</p>`);
                    void invokeFn('send-email', { body: { to, cc: [OPS_GENERAL], subject: `RFQ reply: ${payload.companyName || 'Carrier'} — ${cur.requestNumber}`, html, fromName: 'FBN RFQ Board' } });
                }
                return { ok: true };
            } catch (err) { return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }; }
        },
        // Award the RFQ to a carrier's quote: mark that quote Awarded, the others
        // Rejected, and close the request.
        handleAwardRfqQuote: async (rfqId: string, quoteId: string): Promise<Result<void>> => {
            try {
                const cur = (stateRef.current.rfqRequests || []).find((r: RfqRequest) => r.id === rfqId);
                if (!cur) return { ok: false, error: 'Request not found.' };
                for (const q of cur.quotes) {
                    const status = q.id === quoteId ? 'Awarded' : (q.status === 'Awarded' ? 'Submitted' : q.status);
                    if (status !== q.status) await directUpdate('rfq_carrier_quotes', { id: q.id }, { status });
                }
                await directUpdate('rfq_requests', { id: rfqId }, { status: 'Awarded', awarded_quote_id: quoteId, updated_at: new Date().toISOString() });
                dispatch({ type: 'UPDATE_RFQ_REQUEST', payload: {
                    ...cur,
                    status: 'Awarded',
                    awardedQuoteId: quoteId,
                    quotes: cur.quotes.map(q => ({ ...q, status: q.id === quoteId ? 'Awarded' : (q.status === 'Awarded' ? 'Submitted' : q.status) })),
                } });
                return { ok: true };
            } catch (err) { return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }; }
        },
    }), [dispatch, branchIdByName, branchById]);

    const value = useMemo(() => ({ ...state, ...derived, ...handlers, users }), [state, derived, handlers, users]);
    return <OperationsContext.Provider value={value}>{children}</OperationsContext.Provider>;
};

export const useOperations = () => useContext(OperationsContext);
