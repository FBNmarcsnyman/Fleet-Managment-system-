import React, { useState } from 'react';
import { LoadConfirmation } from '../../types';
import { useUIState, useOperations, useAuth } from '../../contexts/AppContexts';
import { supabase, invokeFn } from '../../lib/supabase';
import { brandedEmail, emailButton } from '../../lib/emailTemplate';
import { sendDriverWhatsApp } from '../../contexts/OperationsContext';
import LoadStatusTimeline from './LoadStatusTimeline';
import { buildLoadConPdf } from '../../lib/loadconPdf';
import { nextStep } from '../../lib/loadStatus';
import { usePickOptions } from '../../hooks/usePickOptions';
import AddressAutocompleteInput from './AddressAutocompleteInput';

const rand = (n?: number) => `R ${(n || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmt = (d?: string) => {
    if (!d) return '—';
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
};
const STATUSES = ['Booked', 'Driver Assigned', 'At Collection Point', 'Collected', 'At Collection Depot', 'In Transit', 'At Destination Depot', 'Out for Delivery', 'Delivered', 'POD Submitted', 'Invoiced', 'Cancelled'];

// Ops-only live position of the assigned truck, pulled from Pulsit via the
// `track` edge function (the browser never sees the tracking key). Shows the
// last-known address, speed and time + a Google Maps link. Silent if the reg
// isn't on the tracker.
const LoadLivePosition: React.FC<{ reg?: string }> = ({ reg }) => {
    const [pos, setPos] = useState<any>(null);
    const [state, setState] = useState<'loading' | 'none' | 'ok'>('loading');
    React.useEffect(() => {
        let active = true;
        if (!reg) { setState('none'); return; }
        (async () => {
            try {
                const { data } = await supabase.functions.invoke('track', { body: { action: 'vehicle', reg } });
                if (!active) return;
                const v = (data as any)?.vehicle;
                if (v && v.lat != null) { setPos(v); setState('ok'); } else setState('none');
            } catch { if (active) setState('none'); }
        })();
        return () => { active = false; };
    }, [reg]);
    if (state !== 'ok' || !pos) return null;
    const moving = (pos.speed || 0) > 5;
    const seen = pos.at ? new Date(pos.at).toLocaleString('en-ZA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
    return (
        <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
            <div className="flex items-center gap-2 mb-1">
                <span className={`w-2 h-2 rounded-full ${moving ? 'bg-emerald-400' : pos.ignition ? 'bg-amber-400' : 'bg-slate-400'}`} />
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300">Live tracking · {pos.reg}</span>
            </div>
            {pos.address && <p className="text-sm text-gray-200">{pos.address}</p>}
            <p className="text-xs text-gray-400 mt-0.5">{moving ? `Moving · ${Math.round(pos.speed)} km/h` : pos.ignition ? 'Stopped (ignition on)' : 'Stationary'}{seen ? ` · last seen ${seen}` : ''}</p>
            <a href={`https://maps.google.com/?q=${pos.lat},${pos.lng}`} target="_blank" rel="noreferrer" className="text-xs font-bold text-blue-400 hover:underline">View on map →</a>
        </div>
    );
};

const Section: React.FC<{ title: string; accent: string; children: React.ReactNode }> = ({ title, accent, children }) => (
    <div className="bg-gray-900/40 rounded-xl border border-gray-700/50 p-4">
        <h3 className="flex items-center text-xs font-black text-gray-300 uppercase tracking-[0.15em] mb-3"><span className={`w-1.5 h-4 rounded-full mr-2 ${accent}`} />{title}</h3>
        {children}
    </div>
);

const inputCls = "w-full bg-gray-700 text-white p-2 rounded-md border border-gray-600 text-sm focus:outline-none focus:ring-1 focus:ring-brand-secondary";

// Edit state shared with the field component via context. F MUST live at module
// scope (not inside the modal) — a component defined inside render is a new type
// every render, so React remounts each input and you lose focus after one letter.
const FieldCtx = React.createContext<{ editing: boolean; d: any; set: (k: string, v: any) => void }>({ editing: false, d: {}, set: () => {} });

// Field: shows text, or an input when editing. `opts` => a fixed select;
// `list` => a free-type input WITH autocomplete suggestions (datalist) so the
// usual client / transporter / commodity / packaging pick-lists stay available
// while editing instead of forcing you to retype everything.
const F: React.FC<{ label: string; k?: string; value?: React.ReactNode; type?: string; opts?: string[]; list?: string[]; address?: boolean; prose?: boolean }> = ({ label, k, value, type = 'text', opts, list, address, prose }) => {
    const { editing, d, set } = React.useContext(FieldCtx);
    const listId = k ? `f-list-${k}` : undefined;
    return (
        <div>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{label}</p>
            {editing && k ? (
                address ? (
                    // Google address autocomplete — picks up the company / place name
                    // and prepends it to the address (e.g. "NWE GREEN, 190 Tsessebe…").
                    <AddressAutocompleteInput value={d[k] ?? ''} onChange={v => set(k, v)} placeholder="Search address / company…" className={inputCls} />
                ) : opts ? (
                    <select value={d[k]} onChange={e => set(k, e.target.value)} className={inputCls}>{opts.map(o => <option key={o} value={o}>{o}</option>)}</select>
                ) : (
                    <>
                        {prose
                            ? <textarea rows={2} spellCheck value={d[k] ?? ''} onChange={e => set(k, e.target.value)} className={`${inputCls} normal-case`} style={{ textTransform: 'none' }} />
                            : <input type={type} list={list && list.length ? listId : undefined} value={d[k] ?? ''} onChange={e => set(k, e.target.value)} className={inputCls} />}
                        {list && list.length ? <datalist id={listId}>{list.map(o => <option key={o} value={o} />)}</datalist> : null}
                    </>
                )
            ) : (
                <p className="text-sm text-gray-100">{value || value === 0 ? value : '—'}</p>
            )}
        </div>
    );
};

const LoadDetailModal: React.FC = () => {
    const { modal, showModal, showToast, hideModal } = useUIState();
    const { handleUpdateLoadConfirmation, handleDeleteLoadConfirmation, quotes = [], clients = [], suppliers = [], loadConfirmations = [] } = useOperations() as any;
    const commodityOpts = usePickOptions('commodity');
    const packagingOpts = usePickOptions('packaging');
    const clientNameOpts = React.useMemo(() => [...new Set((clients as any[]).map(c => c.name).filter(Boolean))].sort(), [clients]);
    const transporterOpts = React.useMemo(() => [...new Set((suppliers as any[]).filter(s => s.type === 'Transport').map(s => s.name).filter(Boolean))].sort(), [suppliers]);
    const { currentUser } = useAuth();
    const isSuperAdmin = (currentUser as any)?.role === 'Super Admin' || (currentUser as any)?.role === 'Admin';
    const lc: LoadConfirmation | undefined = modal.payload?.loadCon;
    // The quote this load was won from — shown so pricing is traceable end-to-end.
    const sourceQuote = (quotes as any[]).find(qq => qq.id === lc?.quoteId);
    const [editing, setEditing] = useState(false);
    const [d, setD] = useState<any>({});
    const [onwardDate, setOnwardDate] = useState<string>((modal.payload?.loadCon?.onwardPlannedDate || '').slice(0, 10));
    const [onwardTime, setOnwardTime] = useState<string>(modal.payload?.loadCon?.onwardPlannedTime || '');

    if (!lc) return <div className="p-4 text-white">No load selected.</div>;

    // Sibling trucks when this load is split across several transporters on one waybill.
    const groupTrucks = (lc.loadGroupId ? (loadConfirmations as any[]).filter(l => l.loadGroupId === lc.loadGroupId) : []).sort((a, b) => (a.isPrimary === b.isPrimary ? 0 : a.isPrimary ? -1 : 1));
    // Unified toolbar button styles — one ghost style for tools, one filled for the
    // primary action. (Brand: navy #13294b / slate neutrals — no rainbow.)
    const tbtn = 'inline-flex items-center gap-1 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold py-1.5 px-2.5 rounded-lg transition';
    const tprimary = 'inline-flex items-center gap-1 bg-[#13294b] hover:bg-[#1d3a66] text-white text-xs font-bold py-1.5 px-3 rounded-lg transition';

    const startEdit = () => {
        setD({
            status: lc.status, priority: lc.priority,
            arrangingBranch: lc.arrangingBranch || '', fbnRepresentative: lc.fbnRepresentative || '', route: lc.route || '',
            loadRefNo: lc.loadRefNo || '', customerOrderNumber: lc.customerOrderNumber || '', collectionRef: lc.collectionRef || '',
            clientName: lc.clientName || '', clientContact: lc.clientContact || '', clientEmail: lc.clientEmail || '', totalAmount: lc.totalAmount ?? '',
            subcontractorName: lc.subcontractorName || '', forAttention: lc.forAttention || '', subcontractorEmail: lc.subcontractorEmail || '',
            subcontractorDriverName: lc.subcontractorDriverName || '', subcontractorVehicleReg: lc.subcontractorVehicleReg || '', subcontractorDriverCell: lc.subcontractorDriverCell || '', supplierRate: lc.supplierRate ?? '',
            collectionPoint: lc.collectionPoint || '', collectionDate: (lc.collectionDate || '').slice(0, 10), loadingTime: lc.loadingTime || '', collectionContact: lc.collectionContact || '', collectionTelephone: lc.collectionTelephone || '',
            deliveryPoint: lc.deliveryPoint || '', deliveryDate: (lc.deliveryDate || '').slice(0, 10), offloadingTime: lc.offloadingTime || '', deliveryContact: lc.deliveryContact || '', deliveryTelephone: lc.deliveryTelephone || '',
            loadType: lc.loadType || '', commodity: lc.commodity || '', packaging: lc.packaging || '', quantity: lc.quantity || '', weightKg: lc.weightKg || '', volume: lc.volume || '', cargoValue: lc.cargoValue || '', containerNo: lc.containerNo || '', specialInstructions: lc.specialInstructions || '',
        });
        setEditing(true);
    };

    const set = (k: string, v: any) => setD((prev: any) => ({ ...prev, [k]: v }));

    const save = () => {
        const updates: any = { ...d, totalAmount: parseFloat(d.totalAmount) || 0, supplierRate: d.supplierRate === '' ? undefined : (parseFloat(d.supplierRate) || 0) };
        // Guard-rail: selling below cost. Warn before committing a negative margin.
        const sell = updates.totalAmount, buy = updates.supplierRate || 0;
        if (sell > 0 && buy > sell && !window.confirm(`⚠ NEGATIVE MARGIN: the transport rate (${rand(buy)}) is higher than the client rate (${rand(sell)}) — this load loses ${rand(buy - sell)}. Save anyway?`)) return;
        hideModal();
        showToast(`Saving ${lc.loadConNumber}…`);
        handleUpdateLoadConfirmation(lc.id, updates)
            .then((r: any) => showToast(r?.ok === false ? `Could not save: ${r.error}` : `${lc.loadConNumber} updated.`))
            .catch((e: any) => showToast(`Could not save: ${e?.message || 'error'}`));
    };

    const whatsappDriver = () => {
        let cell = lc.subcontractorDriverCell;
        if (!cell) {
            const entered = window.prompt(`Driver's cell number for ${lc.loadConNumber} (WhatsApp):`, '');
            if (entered === null) return;
            cell = entered.trim();
            if (!cell) { showToast('No number entered.'); return; }
            handleUpdateLoadConfirmation(lc.id, { subcontractorDriverCell: cell });
        }
        const b = `${window.location.origin}${window.location.pathname}`;
        sendDriverWhatsApp({ ...lc, subcontractorDriverCell: cell }, `Hi ${lc.subcontractorDriverName || 'driver'}, FBN Transport load ${lc.loadConNumber}.\nCollect: ${lc.collectionPoint || '-'}\nDeliver: ${lc.deliveryPoint || '-'}\nCargo: ${lc.loadType || ''} ${lc.commodity || ''}${lc.weightKg ? ' · ' + lc.weightKg + 'kg' : ''}\nContact: ${lc.collectionContact || '-'} ${lc.collectionTelephone || ''}\nTrack/POD: ${b}?pod=${lc.id}\n\nWhat is your ETA at the loading point? Reply:\n1 = within 1 hour\n2 = within 2 hours\n3 = other (then type the time)`);
        showToast('WhatsApp sent to the driver.');
    };

    // Copy a ready-to-paste driver message: the job summary + the driver self-update link
    // (?update=<id>). The driver taps it from WhatsApp and pushes each status (loaded →
    // on route → arrived → delivered) and uploads the POD — no login, auto-notifies FBN +
    // client. Manual paste for now; auto-WhatsApp dispatch comes later.
    const copyDriverLink = async () => {
        const link = `${window.location.origin}${window.location.pathname}?update=${lc.id}`;
        const msg = `Hi ${lc.subcontractorDriverName || 'driver'}, FBN Transport load ${lc.loadConNumber}.\n`
            + `Collect: ${lc.collectionPoint || '-'}\n`
            + `Deliver: ${lc.deliveryPoint || '-'}\n`
            + `Cargo: ${[lc.loadType, lc.commodity].filter(Boolean).join(' ')}${lc.weightKg ? ' · ' + lc.weightKg + 'kg' : ''}\n`
            + `Contact: ${lc.collectionContact || '-'} ${lc.collectionTelephone || ''}\n\n`
            + `Tap to update us as you go + upload the POD:\n${link}`;
        try { await navigator.clipboard.writeText(msg); showToast('Driver job + link copied — paste it into the driver’s WhatsApp.'); }
        catch { window.prompt('Copy this driver link:', link); }
    };

    // Email the received POD to a chosen recipient (defaults to the client).
    // Goes only to you while EMAILS: TEST is on.
    const [sendingPod, setSendingPod] = useState(false);
    // Any POD reference, whatever channel it arrived by (supplier/driver Drive
    // upload, manual photo, or extra doc pages).
    const podLink: string | null = (lc as any).podDriveUrl || lc.podPhoto?.data || (lc as any).podDocUrls?.[0] || null;
    const sendPod = async () => {
        const podUrl = podLink;
        if (!podUrl) { showToast('No POD on this load yet.'); return; }
        const entered = window.prompt(`Send POD for ${lc.loadConNumber} to (email):`, lc.clientEmail || lc.subcontractorEmail || '');
        if (entered === null) return;
        const to = entered.trim();
        if (!to) { showToast('No email entered.'); return; }
        setSendingPod(true);
        try {
            const route = `${lc.collectionPoint || ''}${lc.deliveryPoint ? ' to ' + lc.deliveryPoint : ''}`;
            const html = brandedEmail(`<p>Good day,</p>
              <p>Please find the <strong>POD</strong> for load <strong>${lc.loadConNumber}</strong>${route ? ` (${route})` : ''}.</p>
              ${emailButton(podUrl, 'View / download POD &rarr;', '#16a34a')}
              <p>Regards,<br>FBN Transport</p>`);
            const { data, error } = await invokeFn('send-email', { body: { to, subject: `POD - Load ${lc.loadConNumber}`, html, fromName: 'FBN Transport' } });
            if (error || (data && (data as any).error)) { showToast(`Could not send POD: ${(data as any)?.error || error?.message}`); return; }
            showToast(`POD sent to ${to}.`);
        } catch (e) {
            showToast(`Could not send POD: ${e instanceof Error ? e.message : 'error'}`);
        } finally {
            setSendingPod(false);
        }
    };

    // Authorise a held (subbie-uploaded) POD and release it to the client. Optionally
    // swap in a cleaned version first (re-upload) — the original stays on file.
    const [authorising, setAuthorising] = useState(false);
    const fileToB64 = (file: File) => new Promise<{ b64: string; name: string; type: string }>((res, rej) => {
        const r = new FileReader();
        r.onload = () => { const s = String(r.result); res({ b64: s.split(',')[1] || '', name: file.name, type: file.type || 'application/octet-stream' }); };
        r.onerror = rej; r.readAsDataURL(file);
    });
    const authorisePod = async (file?: File) => {
        if (!window.confirm(file
            ? `Send the UPLOADED cleaned POD to the client for ${lc.loadConNumber}? (The original supplier upload stays on file.)`
            : `Authorise the POD as-is and send it to the client for ${lc.loadConNumber}?`)) return;
        setAuthorising(true);
        try {
            const body: any = { loadId: lc.id };
            if (file) { const f = await fileToB64(file); body.authorisedBase64 = f.b64; body.authorisedName = f.name; body.authorisedContentType = f.type; }
            const { data, error } = await invokeFn('authorise-pod', { body });
            if (error || (data && (data as any).error)) { showToast(`Could not authorise: ${(data as any)?.error || error?.message}`); }
            else { showToast(`POD authorised and sent to the client.`); hideModal(); }
        } catch (e) {
            showToast(`Could not authorise: ${e instanceof Error ? e.message : 'error'}`);
        } finally { setAuthorising(false); }
    };

    // COD: hold the cargo until payment, then release (emails ops/subbie + client).
    const [codBusy, setCodBusy] = useState(false);
    const toggleCodHold = async (on: boolean) => {
        if (on && !window.confirm(`Put ${lc.loadConNumber} on COD HOLD and email the subcontractor + ops "DO NOT DELIVER until released"?`)) return;
        setCodBusy(true);
        try {
            if (on) {
                // cod-hold sets the flag AND emails the subbie + ops the do-not-deliver notice.
                const { data, error } = await invokeFn('cod-hold', { body: { loadId: lc.id } });
                if (error || (data as any)?.error) showToast(`Could not set COD hold: ${(data as any)?.error || error?.message}`);
                else { showToast('COD hold set — subcontractor & ops emailed "do not deliver".'); hideModal(); }
            } else {
                const res = await handleUpdateLoadConfirmation(lc.id, { codHold: false } as any);
                if (res && res.ok === false) showToast(`Could not update: ${res.error}`);
            }
        } catch (e) { showToast(`Could not update: ${e instanceof Error ? e.message : 'error'}`); }
        finally { setCodBusy(false); }
    };
    const codReleasePay = async () => {
        if (!window.confirm(`Confirm COD PAYMENT RECEIVED for ${lc.loadConNumber}? This RELEASES the cargo for delivery and emails ops/the subbie + the client.`)) return;
        setCodBusy(true);
        try {
            const { data, error } = await invokeFn('cod-release', { body: { loadId: lc.id } });
            if (error || (data as any)?.error) showToast(`Could not release: ${(data as any)?.error || error?.message}`);
            else { showToast('Payment recorded — cargo released; ops/subbie & client notified.'); hideModal(); }
        } catch (e) { showToast(`Could not release: ${e instanceof Error ? e.message : 'error'}`); }
        finally { setCodBusy(false); }
    };

    // Inline rate editing — click a rate card, it becomes an input in place (no pop-up).
    const [rateEdit, setRateEdit] = useState<null | 'totalAmount' | 'supplierRate'>(null);
    const [rateDraft, setRateDraft] = useState('');
    const startRate = (field: 'totalAmount' | 'supplierRate') => {
        const cur = field === 'totalAmount' ? lc.totalAmount : lc.supplierRate;
        setRateDraft(cur != null ? String(cur) : '');
        setRateEdit(field);
    };
    const saveRate = async (field: 'totalAmount' | 'supplierRate') => {
        setRateEdit(null);
        const num = parseFloat(String(rateDraft).replace(/[^\d.]/g, '')) || 0;
        const cur = field === 'totalAmount' ? lc.totalAmount : lc.supplierRate;
        if (num === (cur || 0)) return; // unchanged — nothing to save
        const res = await handleUpdateLoadConfirmation(lc.id, { [field]: num } as any);
        if (res && res.ok === false) showToast(`Could not save: ${res.error}`);
    };
    // The little inline number field used inside a rate card.
    const RateInput: React.FC<{ field: 'totalAmount' | 'supplierRate' }> = ({ field }) => (
        <div className="flex items-center gap-1 mt-0.5" onClick={e => e.stopPropagation()}>
            <span className="text-sm text-gray-400">R</span>
            <input autoFocus type="number" inputMode="decimal" value={rateDraft}
                onChange={e => setRateDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveRate(field); if (e.key === 'Escape') setRateEdit(null); }}
                onBlur={() => saveRate(field)}
                className="w-28 bg-gray-800 border border-blue-400 rounded-lg px-2 py-1 text-lg font-black text-white focus:outline-none" />
        </div>
    );

    // One-tap status progression from the detail view (no need to enter Edit mode).
    const [advancing, setAdvancing] = useState(false);
    const quickAdvance = async () => {
        const step = nextStep(lc); if (!step) return;
        setAdvancing(true);
        const res = await handleUpdateLoadConfirmation(lc.id, { status: step.status });
        setAdvancing(false);
        if (res && res.ok === false) showToast(`Could not update: ${res.error}`);
    };

    // Email the computer-generated waybill / POD to the supplier (print & sign).
    const [waybillBusy, setWaybillBusy] = useState(false);
    const emailWaybillToSupplier = async () => {
        if (!lc.subcontractorEmail) { showToast('No supplier email on this load — add one first.'); return; }
        setWaybillBusy(true);
        try {
            const { base64, filename } = await buildLoadConPdf(lc, 'deliveryNote');
            const html = brandedEmail(`<p>Good day ${lc.forAttention || lc.subcontractorName || ''},</p><p>Please find the <strong>waybill / POD</strong> for load <strong>${lc.loadConNumber}</strong> attached. Kindly have it <strong>signed on delivery</strong> and returned to us (reply with a scan/photo, or use the driver upload link).</p><p>Regards,<br>FBN Transport</p>`);
            const { data, error } = await invokeFn('send-email', { body: { to: lc.subcontractorEmail, subject: `Waybill / POD - load ${lc.loadConNumber}`, html, fromName: 'FBN Transport', attachments: [{ filename, content: base64, contentType: 'application/pdf' }] } });
            if (error || (data as any)?.error) { showToast(`Failed: ${(data as any)?.error || error?.message}`); return; }
            showToast('Waybill / POD emailed to the supplier.');
        } catch (e) { showToast(`Could not send: ${e instanceof Error ? e.message : 'error'}`); }
        finally { setWaybillBusy(false); }
    };
    const podToDriverWhatsApp = () => {
        let cell = lc.subcontractorDriverCell;
        if (!cell) { const v = window.prompt(`Driver's cell for ${lc.loadConNumber} (WhatsApp):`, ''); if (v === null) return; cell = v.trim(); if (!cell) { showToast('No number entered.'); return; } handleUpdateLoadConfirmation(lc.id, { subcontractorDriverCell: cell }); }
        const link = `${window.location.origin}${window.location.pathname}?pod=${lc.id}`;
        sendDriverWhatsApp({ ...lc, subcontractorDriverCell: cell }, `Please sign the POD on delivery and upload it here for load ${lc.loadConNumber}: ${link}`);
        showToast('Sign-and-upload link sent to the driver on WhatsApp.');
    };

    // Group-aware costing: a split waybill has ONE client charge (on the primary) and a
    // cost per truck. Margin = the single client charge − the SUM of every truck's cost.
    const isGrouped = groupTrucks.length > 1;
    const groupPrimary = isGrouped ? (groupTrucks.find((t: any) => t.isPrimary) || groupTrucks[0]) : lc;
    const groupClient = Number(groupPrimary.totalAmount) || 0;
    const groupCost = isGrouped ? groupTrucks.reduce((s: number, t: any) => s + (Number(t.supplierRate) || 0), 0) : (lc.supplierRate || 0);
    const margin = groupClient - groupCost;
    const marginPct = groupClient ? (margin / groupClient) * 100 : 0;

    return (
        <FieldCtx.Provider value={{ editing, d, set }}>
        <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
            <div className="flex items-start justify-between">
                <div>
                    <h2 className="text-2xl font-black text-[#13294b]">{lc.loadConNumber}</h2>
                    {sourceQuote && (
                        <p className="text-xs font-bold text-amber-600 font-mono">From quote {sourceQuote.quoteNumber}{lc.totalAmount ? ` · R ${Number(lc.totalAmount).toLocaleString()}` : ''}</p>
                    )}
                    <p className="text-sm text-slate-500">{lc.collectionPoint} → {lc.deliveryPoint}</p>
                    {groupTrucks.length > 1 && (
                        <p className="text-xs font-bold text-[#13294b] mt-0.5">🚚 Split waybill {lc.loadRefNo || ''} · truck {Math.max(1, groupTrucks.findIndex(t => t.id === lc.id) + 1)} of {groupTrucks.length}</p>
                    )}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    {!editing && <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">{lc.status}</span>}
                    {!editing && nextStep(lc) && <button onClick={quickAdvance} disabled={advancing} title="Move this load to the next status" className="inline-flex items-center gap-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-1.5 px-3 rounded-lg transition disabled:opacity-50">{advancing ? '…' : `${nextStep(lc)!.label} →`}</button>}
                    {!editing && podLink && <a href={podLink} target="_blank" rel="noreferrer" title="Open the uploaded POD" className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-1.5 px-3 rounded-lg transition">📄 View POD{lc.podAuthorisation === 'pending' ? ' ⚠' : ''}</a>}
                    {!editing && <button onClick={() => showModal('captureLoad', { loadCon: lc })} className={tbtn}>📷 Capture</button>}
                    {!editing && <button onClick={whatsappDriver} className={tbtn}>💬 WhatsApp</button>}
                    {!editing && <button onClick={copyDriverLink} title="Copy the driver job + self-update link to paste into WhatsApp — the driver taps it to update status (loaded → on route → arrived → delivered) and upload the POD." className={tbtn}>🔗 Driver link</button>}
                    {!editing && <button onClick={() => showModal('loadDocuments', { loadCon: lc })} className={tbtn}>📁 Documents</button>}
                    {!editing && <button onClick={() => showModal('splitLoad', { loadCon: lc })} title="One waybill carried by several trucks/subbies — allocate transporters, split the cost, send each their loadcon." className={tbtn}>🚚 Split{lc.loadGroupId ? ' ✓' : ''}</button>}
                    {!editing && <button onClick={() => showModal('offerLoad', { loadCon: lc })} title="Market this load to carriers who run this lane + truck type; invite their best rate." className={tbtn}>📣 Offer{(lc as any).offeredCarriers?.length ? ` · ${(lc as any).offeredCarriers.length}` : ''}</button>}
                    {!editing && !lc.supplierId && (
                        <button onClick={() => showModal('assignLoadCon', { loadCon: lc })} title="Shipment going onward (e.g. to CPT) after collection — raise a subcontractor LoadCon; it then shows on the Broking board to keep updating." className={tbtn}>↪ Onward</button>
                    )}
                    {!editing
                        ? <button onClick={startEdit} className={tprimary}>Edit</button>
                        : <><button onClick={() => setEditing(false)} className={tbtn}>Cancel</button>
                           <button onClick={save} className={tprimary}>Save</button></>}
                </div>
            </div>

            {!editing && lc.transitDepot && (() => {
                const received = !!lc.transitReceivedAt;
                const dwellH = received ? Math.max(0, Math.round((Date.now() - new Date(lc.transitReceivedAt!).getTime()) / 3600000)) : 0;
                const finalRegion = (lc.destinationBranch || '').replace('FBN ', '') || (lc.deliveryPoint || '').split(',').pop()?.trim();
                return (
                    <div className="rounded-xl p-4 border bg-indigo-50 border-indigo-200">
                        <p className="text-[11px] font-black uppercase tracking-widest mb-1 text-indigo-700">🔄 Transit via {lc.transitDepot}</p>
                        <p className="text-sm text-slate-700 mb-2">Leg 1 (subbie): <strong>{(lc.collectionBranch || '').replace('FBN ', '') || 'origin'} → {lc.transitDepot}</strong> · Leg 2 (FBN): <strong>line-haul {lc.transitDepot} → {finalRegion}</strong>, then local delivery.</p>
                        {!received ? (
                            <button onClick={() => handleUpdateLoadConfirmation(lc.id, { transitReceivedAt: new Date().toISOString(), status: 'At Collection Depot' as any }).then((r: any) => showToast(r?.ok === false ? `Could not update: ${r.error}` : `Received at ${lc.transitDepot} — add it to the ${finalRegion} line-haul manifest.`))}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-4 rounded-lg text-sm">📦 Mark received at {lc.transitDepot} depot</button>
                        ) : (
                            <div className="space-y-2">
                                <p className="text-xs text-slate-600">At {lc.transitDepot} depot for <strong className={dwellH >= 48 ? 'text-rose-600' : 'text-slate-800'}>{dwellH}h</strong>{dwellH >= 48 ? ' — chase the line-haul' : ''}. Add to the <strong>{finalRegion} line-haul manifest</strong> for the inter-depot transfer, then deliver locally on arrival.</p>
                                <div className="flex flex-wrap items-end gap-2">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase">Planned delivery date
                                        <input type="date" value={onwardDate} onChange={e => setOnwardDate(e.target.value)} className="block bg-white border border-slate-300 rounded-md p-1.5 text-sm text-slate-700" /></label>
                                    <input type="time" value={onwardTime} onChange={e => setOnwardTime(e.target.value)} className="bg-white border border-slate-300 rounded-md p-1.5 text-sm text-slate-700" />
                                    <button onClick={() => handleUpdateLoadConfirmation(lc.id, { onwardPlannedDate: onwardDate || undefined, onwardPlannedTime: onwardTime || undefined } as any).then((r: any) => showToast(r?.ok === false ? `Could not save: ${r.error}` : 'Plan saved.'))}
                                        className="bg-[#13294b] text-white font-bold py-1.5 px-3 rounded-md text-sm">Save plan</button>
                                </div>
                                <div className="flex flex-wrap gap-2 pt-1">
                                    <button onClick={() => showModal('assignFbn', { loadCon: lc })} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-1.5 px-3 rounded-md text-sm">🚚 FBN planned delivery</button>
                                    <button onClick={() => showModal('assignLoadCon', { loadCon: lc })} className="bg-amber-600 hover:bg-amber-500 text-white font-bold py-1.5 px-3 rounded-md text-sm">🔁 Reroute with subbie</button>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })()}

            {!editing && <LoadStatusTimeline loadId={lc.id} />}

            {!editing && (lc.loadedPackages != null || lc.loadingIssues) && (
                <div className={`rounded-xl p-4 border ${lc.loadingIssues ? 'bg-rose-50 border-rose-300' : 'bg-emerald-50 border-emerald-200'}`}>
                    <p className={`text-[11px] font-black uppercase tracking-widest mb-1 ${lc.loadingIssues ? 'text-rose-600' : 'text-emerald-700'}`}>Loading confirmation from transporter</p>
                    {lc.loadedPackages != null && <p className="text-sm text-slate-800">Packages loaded: <strong>{lc.loadedPackages}</strong></p>}
                    {lc.loadingIssues
                        ? <p className="text-sm text-rose-900 mt-0.5">⚠ Issues: "{lc.loadingIssues}"</p>
                        : <p className="text-sm text-emerald-800 mt-0.5">No issues reported at loading.</p>}
                </div>
            )}

            {!editing && lc.clientRequestStatus === 'open' && (
                <div className="bg-rose-50 border border-rose-300 rounded-xl p-4">
                    <p className="text-[11px] font-black text-rose-600 uppercase tracking-widest mb-1">✉ Client request — needs a response</p>
                    <p className="text-sm text-rose-900 mb-3">"{lc.clientRequest}"</p>
                    <button
                        onClick={() => {
                            const reply = window.prompt(`Reply to ${lc.clientName || 'the client'} for ${lc.loadConNumber}:`, '');
                            if (reply === null) return;
                            const text = reply.trim();
                            if (!text) { showToast('No reply entered.'); return; }
                            const html = brandedEmail(`<p>Good day ${lc.clientContact || lc.clientName || ''},</p><p>Regarding your request on shipment <strong>${lc.loadConNumber}</strong>:</p><p style="background:#f3f4f6;border-radius:8px;padding:10px;color:#374151">${text}</p>${emailButton(`${window.location.origin}${window.location.pathname}?track=${lc.id}`, 'Track your shipment →')}<p>Regards,<br>FBN Transport</p>`);
                            if (lc.clientEmail) invokeFn('send-email', { body: { to: lc.clientEmail, subject: `FBN shipment ${lc.loadConNumber} - response to your request`, html, fromName: 'FBN Transport' } });
                            handleUpdateLoadConfirmation(lc.id, { clientRequestStatus: 'resolved', clientRequestReply: text } as any)
                                .then((r: any) => showToast(r?.ok === false ? `Saved reply but: ${r.error}` : 'Replied to the client and marked resolved.'));
                        }}
                        className="bg-rose-600 hover:bg-rose-500 text-white font-bold py-2 px-4 rounded-lg text-sm">Reply to client</button>
                </div>
            )}

            {!editing && lc.clientRequestStatus === 'resolved' && lc.clientRequest && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                    <p className="text-[11px] font-black text-emerald-700 uppercase tracking-widest mb-1">✓ Client request — handled</p>
                    <p className="text-sm text-emerald-900 mb-1">Request: "{lc.clientRequest}"</p>
                    {lc.clientRequestReply && <p className="text-sm text-emerald-900">Your reply: "{lc.clientRequestReply}"</p>}
                    <p className="text-[11px] text-emerald-700 mt-1">This stays green until the client sends a new request.</p>
                </div>
            )}

            {!editing && (
                <>
                {(() => {
                    // Transport rate/margin only make sense once a transporter is on the load
                    // (brokered/split) or it's a broking load — not for an own-fleet collection.
                    const isBrokered = isGrouped || !!lc.supplierId || !!(lc.subcontractorName || '').trim() || lc.isCollection === false;
                    return (
                <div className={`grid ${isBrokered ? 'grid-cols-3' : 'grid-cols-1'} gap-3`}>
                    <button type="button" onClick={() => rateEdit !== 'totalAmount' && startRate('totalAmount')} className="text-left bg-gray-900/50 hover:bg-gray-900/80 rounded-xl p-3 transition"><p className="text-[10px] font-bold text-gray-500 uppercase">Client Rate{isGrouped ? ' (waybill)' : ''} {rateEdit !== 'totalAmount' && <span className="text-blue-400 normal-case">· tap to edit</span>}</p>{rateEdit === 'totalAmount' ? <RateInput field="totalAmount" /> : <p className="text-lg font-black text-blue-300">{rand(groupClient)}</p>}</button>
                    {isBrokered && <button type="button" onClick={() => !isGrouped && rateEdit !== 'supplierRate' && startRate('supplierRate')} className="text-left bg-gray-900/50 hover:bg-gray-900/80 rounded-xl p-3 transition"><p className="text-[10px] font-bold text-gray-500 uppercase">{isGrouped ? `Transport cost (all ${groupTrucks.length})` : 'Transport Rate'}{!isGrouped && rateEdit !== 'supplierRate' ? ' · tap to edit' : ''}</p>{rateEdit === 'supplierRate' && !isGrouped ? <RateInput field="supplierRate" /> : <><p className="text-lg font-black text-amber-300">{rand(groupCost)}</p>{isGrouped && <p className="text-[10px] text-gray-500">this truck: {rand(lc.supplierRate)}</p>}</>}</button>}
                    {isBrokered && <div className={`rounded-xl p-3 ${margin < 0 ? 'bg-red-950/40 ring-1 ring-red-500' : 'bg-gray-900/50'}`}><p className="text-[10px] font-bold text-gray-500 uppercase">Margin{isGrouped ? ' (waybill)' : ''}{margin < 0 ? ' ⚠ LOSS' : ''}</p><p className={`text-lg font-black ${margin < 0 ? 'text-red-400' : marginPct < 10 ? 'text-amber-400' : 'text-emerald-400'}`}>{rand(margin)} <span className="text-xs">({marginPct.toFixed(0)}%)</span></p></div>}
                </div>
                    );
                })()}
                {isGrouped && (
                    <div className="mt-2 bg-gray-900/40 rounded-xl p-3">
                        <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Trucks on waybill {lc.loadRefNo || groupPrimary.loadConNumber} — ONE client charge of {rand(groupClient)}</p>
                        {groupTrucks.map((t: any, i: number) => (
                            <div key={t.id} className={`flex justify-between text-xs py-0.5 ${t.id === lc.id ? 'text-white font-bold' : 'text-gray-300'}`}>
                                <span>{i + 1}. {t.legRole || 'Truck'} · {t.subcontractorName || 'TBA'}{t.isPrimary ? ' (primary · invoiced)' : ''}{t.podRequired === false ? ' · no POD' : ''}</span>
                                <span className="text-amber-300">{rand(t.supplierRate)}</span>
                            </div>
                        ))}
                    </div>
                )}
                </>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Section title="Order" accent="bg-brand-secondary">
                    <div className="grid grid-cols-2 gap-3">
                        <F label="Status" k="status" value={lc.status} opts={STATUSES} />
                        <F label="Priority" k="priority" value={lc.priority} opts={['Low', 'Medium', 'High']} />
                        <F label="FBN Branch" k="arrangingBranch" value={lc.arrangingBranch} />
                        <F label="FBN Rep" k="fbnRepresentative" value={lc.fbnRepresentative} />
                        <F label="Route" k="route" value={lc.route} />
                        <F label="FBN DI / Waybill" k="loadRefNo" value={lc.loadRefNo} />
                        <F label="Collection Ref" k="collectionRef" value={lc.collectionRef} />
                        <F label="Customer Order" k="customerOrderNumber" value={lc.customerOrderNumber} />
                    </div>
                </Section>
                <Section title="Client" accent="bg-blue-500">
                    <div className="grid grid-cols-2 gap-3">
                        <F label="Company" k="clientName" value={lc.clientName} list={clientNameOpts} />
                        <F label="Contact" k="clientContact" value={lc.clientContact} />
                        <F label="Email" k="clientEmail" value={lc.clientEmail} />
                        <F label="Client Rate" k="totalAmount" type="number" value={rand(lc.totalAmount)} />
                    </div>
                </Section>
                <Section title="Collection" accent="bg-emerald-500">
                    <div className="grid grid-cols-2 gap-3">
                        <F label="Address" k="collectionPoint" value={lc.collectionPoint} address />
                        <F label="Date" k="collectionDate" type="date" value={fmt(lc.collectionDate)} />
                        <F label="Time" k="loadingTime" type="time" value={lc.loadingTime} />
                        <F label="Contact" k="collectionContact" value={lc.collectionContact} />
                        <F label="Tel" k="collectionTelephone" value={lc.collectionTelephone} />
                    </div>
                </Section>
                <Section title="Delivery" accent="bg-rose-500">
                    <div className="grid grid-cols-2 gap-3">
                        <F label="Address" k="deliveryPoint" value={lc.deliveryPoint} address />
                        <F label="Date" k="deliveryDate" type="date" value={fmt(lc.deliveryDate)} />
                        <F label="Time" k="offloadingTime" type="time" value={lc.offloadingTime} />
                        <F label="Contact" k="deliveryContact" value={lc.deliveryContact} />
                        <F label="Tel" k="deliveryTelephone" value={lc.deliveryTelephone} />
                    </div>
                </Section>
                {(() => {
                    // In-network own truck (GP/KZN ↔ DBN/JHB) = FBN vehicle + driver, NO
                    // subcontractor. Out-of-network end destination (CPT/PE/EL/Bloem…) = FBN
                    // collects then forwards on with a subbie — shown only when the manual
                    // "onward forwarding" toggle is on (or a real subbie is already attached).
                    const hasSubbie = !!lc.supplierId || ((lc.subcontractorName || '').trim() !== '' && (lc.subcontractorName || '').toUpperCase() !== 'FBN TRANSPORT');
                    const needsOnward = !!lc.onwardRequired || hasSubbie;
                    const toggleOnward = async () => {
                        const res = await handleUpdateLoadConfirmation(lc.id, { onwardRequired: !lc.onwardRequired } as any);
                        if (res && res.ok === false) showToast(`Could not save: ${res.error}`);
                    };
                    return (
                        <Section title={needsOnward ? 'Onward forwarding (subcontractor)' : 'FBN Vehicle / Driver'} accent={needsOnward ? 'bg-amber-500' : 'bg-emerald-500'}>
                            <label className="flex items-start gap-2 mb-3 text-xs text-gray-400 cursor-pointer">
                                <input type="checkbox" checked={!!lc.onwardRequired} onChange={toggleOnward} disabled={hasSubbie} className="mt-0.5 accent-amber-500" />
                                <span>Onward forwarding needed — end destination is <strong>out-of-network</strong> (CPT / PE / EL / Bloemfontein…). FBN collects on its own truck, then a subbie takes it on (collects from us or we drop at the depot).</span>
                            </label>
                            {needsOnward ? (
                                <div className="grid grid-cols-2 gap-3">
                                    <F label="Carrier" k="subcontractorName" value={lc.subcontractorName} list={transporterOpts} />
                                    <F label="For Attention" k="forAttention" value={lc.forAttention} />
                                    <F label="Email" k="subcontractorEmail" value={lc.subcontractorEmail} />
                                    <F label="Driver" k="subcontractorDriverName" value={lc.subcontractorDriverName} />
                                    <F label="Driver Cell" k="subcontractorDriverCell" value={lc.subcontractorDriverCell} />
                                    <F label="Vehicle Reg" k="subcontractorVehicleReg" value={lc.subcontractorVehicleReg} />
                                    <F label="Transport Rate" k="supplierRate" type="number" value={rand(lc.supplierRate)} />
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-3">
                                    <F label="Fleet" k="subcontractorName" value={lc.subcontractorName || 'FBN TRANSPORT'} list={transporterOpts} />
                                    <F label="Driver" k="subcontractorDriverName" value={lc.subcontractorDriverName} />
                                    <F label="Driver Cell" k="subcontractorDriverCell" value={lc.subcontractorDriverCell} />
                                    <F label="Vehicle Reg" k="subcontractorVehicleReg" value={lc.subcontractorVehicleReg} />
                                </div>
                            )}
                            {!editing && <LoadLivePosition reg={lc.subcontractorVehicleReg} />}
                        </Section>
                    );
                })()}
                <Section title="Cargo" accent="bg-gray-500">
                    <div className="grid grid-cols-2 gap-3">
                        <F label="Load Type" k="loadType" value={lc.loadType} />
                        <F label="Commodity" k="commodity" value={lc.commodity} list={commodityOpts} />
                        <F label="Packaging" k="packaging" value={lc.packaging} list={packagingOpts} />
                        <F label="Quantity" k="quantity" value={lc.quantity} />
                        <F label="Weight (kg)" k="weightKg" value={lc.weightKg} />
                        <F label="Volume" k="volume" value={lc.volume} />
                        <F label="Cargo Value" k="cargoValue" value={lc.cargoValue} />
                        <F label="Container" k="containerNo" value={lc.containerNo} />
                    </div>
                    <div className="mt-2"><F label="Instructions" k="specialInstructions" value={lc.specialInstructions} prose /></div>
                </Section>
            </div>

            {!editing && (
                <Section title="Status & POD" accent="bg-purple-500">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-center">
                        <F label="Sent to Supplier" value={lc.sentToSupplierDate ? fmt(lc.sentToSupplierDate) : 'Not sent'} />
                        <F label="Payment" value={lc.paymentStatus || '—'} />
                        <F label="POD" value={podLink ? (lc.podAuthorisation === 'blocked' ? 'BLOCKED — do not send' : lc.podAuthorisation === 'pending' ? 'Received — awaiting authorisation' : lc.podAuthorisation === 'authorised' ? 'Sent to client ✓' : 'Received') : 'Awaiting'} />
                        {podLink && (
                            <div className="flex items-center gap-3">
                                <a href={podLink} target="_blank" rel="noreferrer" className="text-xs font-bold text-blue-400 hover:underline">View POD →</a>
                                {lc.podAuthorisation !== 'pending' && <button onClick={sendPod} disabled={sendingPod} className="text-xs font-bold text-emerald-400 hover:underline disabled:opacity-50">{sendingPod ? 'Sending…' : 'Send / Resend POD →'}</button>}
                            </div>
                        )}
                    </div>
                    {/* POD held for review — nothing reaches the client until an admin authorises. */}
                    {(lc.podAuthorisation === 'pending' || lc.podAuthorisation === 'blocked') && (
                        <div className={`mt-3 p-3 rounded-lg border ${lc.podAuthorisation === 'blocked' ? 'border-red-500/50 bg-red-500/10' : 'border-amber-400/40 bg-amber-500/5'}`}>
                            {lc.podAuthorisation === 'blocked' ? (
                                <>
                                    <p className="text-[11px] font-black text-red-400 uppercase tracking-widest">⛔ POD BLOCKED — never send as-is</p>
                                    <p className="text-xs text-slate-300 mt-1 mb-2">This upload contained an <strong>invoice or incorrect document</strong> and must <strong>never</strong> go to the client. To serve a clean POD, upload a <strong>cleaned version</strong> below — the as-is file is permanently barred from sending.</p>
                                </>
                            ) : (
                                <>
                                    <p className="text-[11px] font-black text-amber-400 uppercase tracking-widest">⚠ POD awaiting authorisation</p>
                                    <p className="text-xs text-slate-300 mt-1 mb-2">Open it and make sure there are <strong>no invoices, rates or incorrect documents</strong> before the client sees it. Nothing is sent until you authorise. The original is always kept on file.</p>
                                </>
                            )}
                            {isSuperAdmin ? (
                                <div className="flex flex-wrap gap-2">
                                    {podLink && <a href={podLink} target="_blank" rel="noreferrer" className="text-xs font-bold bg-[#13294b] hover:bg-[#1d3a66] text-white py-2 px-3 rounded-lg">📄 View / download original</a>}
                                    {lc.podAuthorisation !== 'blocked' && <button onClick={() => authorisePod()} disabled={authorising} className="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white py-2 px-3 rounded-lg disabled:opacity-50">{authorising ? '…' : '✅ Authorise as-is & send to client'}</button>}
                                    <label className="text-xs font-bold bg-amber-500 hover:bg-amber-400 text-white py-2 px-3 rounded-lg cursor-pointer">⬆ Upload cleaned version &amp; send<input type="file" className="hidden" accept="application/pdf,image/*" onChange={e => { const f = e.target.files?.[0]; if (f) authorisePod(f); e.currentTarget.value = ''; }} /></label>
                                </div>
                            ) : (
                                <p className="text-[11px] text-slate-400">An admin must review and authorise this POD before it goes to the client.</p>
                            )}
                        </div>
                    )}
                    {lc.podAuthorisation === 'authorised' && <p className="mt-2 text-[11px] font-bold text-emerald-400">✓ POD authorised &amp; sent to the client.</p>}

                    {/* COD — cargo held until payment, then released for delivery. */}
                    <div className="mt-3 pt-3 border-t border-slate-200">
                        {(lc as any).codReleasedAt ? (
                            <p className="text-[11px] font-bold text-emerald-400">💰 COD payment received — cargo RELEASED for delivery ({fmt((lc as any).codReleasedAt)}).</p>
                        ) : (lc as any).codHold ? (
                            <div className="p-3 rounded-lg border border-red-500/50 bg-red-500/10">
                                <p className="text-[11px] font-black text-red-400 uppercase tracking-widest">⛔ COD — cargo HELD pending payment</p>
                                <p className="text-xs text-slate-300 mt-1 mb-2">Ops &amp; the subcontractor must <strong>NOT deliver</strong> until payment is received and the cargo is released.</p>
                                {isSuperAdmin && <button onClick={codReleasePay} disabled={codBusy} className="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white py-2 px-3 rounded-lg disabled:opacity-50">{codBusy ? '…' : '✓ Payment received — release cargo'}</button>}
                            </div>
                        ) : (
                            <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 cursor-pointer">
                                <input type="checkbox" checked={false} disabled={codBusy} onChange={e => toggleCodHold(e.target.checked)} className="h-4 w-4 accent-[#13294b]" />
                                💰 Mark this load <strong>COD</strong> — hold cargo until payment (ops/subbie can't deliver until released)
                            </label>
                        )}
                    </div>
                    {/* Electronic POD / waybill: choose how the signed POD comes back. */}
                    <div className="mt-3 pt-3 border-t border-slate-200">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Get the signed POD / waybill back</p>
                        <div className="flex flex-wrap gap-2">
                            <button onClick={emailWaybillToSupplier} disabled={waybillBusy} className="text-xs font-bold bg-[#13294b] text-white hover:bg-[#1d3a66] disabled:opacity-50 py-2 px-3 rounded-lg">{waybillBusy ? 'Sending…' : '📄 Email waybill/POD to supplier'}</button>
                            <button onClick={podToDriverWhatsApp} className="text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-500 py-2 px-3 rounded-lg">💬 WhatsApp driver to sign &amp; upload</button>
                        </div>
                        <p className="text-[10px] text-gray-500 mt-2">Use the waybill email when the supplier prints &amp; signs; use the driver WhatsApp link when the driver signs on-screen and uploads.</p>
                    </div>
                </Section>
            )}

            {!editing && (
                <div className="flex justify-between items-center gap-3 pt-1">
                    <div className="flex gap-2">
                        {isSuperAdmin && (
                            <>
                                <button
                                    onClick={() => {
                                        if (!window.confirm(`Archive ${lc.loadConNumber}? It will be hidden from the boards (you can still find it under History).`)) return;
                                        hideModal();
                                        handleUpdateLoadConfirmation(lc.id, { status: 'Cancelled' as any })
                                            .then((r: any) => showToast(r?.ok === false ? `Could not archive: ${r.error}` : `${lc.loadConNumber} archived.`));
                                    }}
                                    className="bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold py-2 px-4 rounded-lg text-sm">Archive</button>
                                <button
                                    onClick={() => {
                                        if (!window.confirm(`PERMANENTLY DELETE ${lc.loadConNumber}? This cannot be undone — use it only for loads created in error or that didn't load properly.`)) return;
                                        hideModal();
                                        handleDeleteLoadConfirmation(lc.id)
                                            .then((r: any) => showToast(r?.ok === false ? `Could not delete: ${r.error}` : `${lc.loadConNumber} deleted.`));
                                    }}
                                    className="bg-red-100 hover:bg-red-200 text-red-700 font-bold py-2 px-4 rounded-lg text-sm">Delete</button>
                            </>
                        )}
                    </div>
                    <span className="text-[11px] text-gray-400 italic self-center">{isSuperAdmin ? 'Archive / delete — super admin only' : ''}</span>
                </div>
            )}
        </div>
        </FieldCtx.Provider>
    );
};

export default LoadDetailModal;
