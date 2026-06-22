import React, { useState } from 'react';
import { LoadConfirmation } from '../../types';
import { useUIState, useOperations, useAuth } from '../../contexts/AppContexts';
import { supabase, invokeFn } from '../../lib/supabase';
import { brandedEmail, emailButton } from '../../lib/emailTemplate';
import { sendDriverWhatsApp } from '../../contexts/OperationsContext';
import LoadStatusTimeline from './LoadStatusTimeline';
import { buildLoadConPdf } from '../../lib/loadconPdf';
import { usePickOptions } from '../../hooks/usePickOptions';
import AddressAutocompleteInput from './AddressAutocompleteInput';

const rand = (n?: number) => `R ${(n || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmt = (d?: string) => {
    if (!d) return '—';
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
};
const STATUSES = ['Booked', 'Driver Assigned', 'At Collection Point', 'Collected', 'At Collection Depot', 'In Transit', 'At Destination Depot', 'Out for Delivery', 'Delivered', 'POD Submitted', 'Invoiced', 'Cancelled'];

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
const F: React.FC<{ label: string; k?: string; value?: React.ReactNode; type?: string; opts?: string[]; list?: string[]; address?: boolean }> = ({ label, k, value, type = 'text', opts, list, address }) => {
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
                        <input type={type} list={list && list.length ? listId : undefined} value={d[k] ?? ''} onChange={e => set(k, e.target.value)} className={inputCls} />
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
    const { handleUpdateLoadConfirmation, handleDeleteLoadConfirmation, quotes = [], clients = [], suppliers = [] } = useOperations() as any;
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

    // Email the received POD to a chosen recipient (defaults to the client).
    // Goes only to you while EMAILS: TEST is on.
    const [sendingPod, setSendingPod] = useState(false);
    const sendPod = async () => {
        const podUrl = lc.podPhoto?.data;
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

    const margin = (lc.totalAmount || 0) - (lc.supplierRate || 0);
    const marginPct = lc.totalAmount ? (margin / lc.totalAmount) * 100 : 0;

    return (
        <FieldCtx.Provider value={{ editing, d, set }}>
        <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
            <div className="flex items-start justify-between">
                <div>
                    <h2 className="text-2xl font-black text-white">{lc.loadConNumber}</h2>
                    {sourceQuote && (
                        <p className="text-xs font-bold text-amber-400 font-mono">From quote {sourceQuote.quoteNumber}{lc.totalAmount ? ` · R ${Number(lc.totalAmount).toLocaleString()}` : ''}</p>
                    )}
                    <p className="text-sm text-gray-400">{lc.collectionPoint} → {lc.deliveryPoint}</p>
                </div>
                <div className="flex items-center gap-2">
                    {!editing && <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-slate-200 text-slate-700">{lc.status}</span>}
                    {!editing && <button onClick={() => showModal('captureLoad', { loadCon: lc })} className="bg-[#13294b] hover:bg-[#1d3a66] text-white text-xs font-bold py-1.5 px-3 rounded-lg">📷 Capture</button>}
                    {!editing && <button onClick={whatsappDriver} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-1.5 px-3 rounded-lg">💬 WhatsApp Driver</button>}
                    {!editing && <button onClick={() => showModal('loadDocuments', { loadCon: lc })} className="bg-[#13294b] hover:bg-[#1d3a66] text-white text-xs font-bold py-1.5 px-3 rounded-lg">📁 Documents</button>}
                    {!editing && !lc.supplierId && (
                        <button onClick={() => showModal('assignLoadCon', { loadCon: lc })} title="Shipment going onward (e.g. to CPT) after collection — raise a subcontractor LoadCon; it then shows on the Broking board to keep updating." className="bg-[#13294b] hover:bg-[#1d3a66] text-white text-xs font-bold py-1.5 px-3 rounded-lg">+ Onward → Broking</button>
                    )}
                    {!editing
                        ? <button onClick={startEdit} className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold py-1.5 px-3 rounded-lg">Edit</button>
                        : <><button onClick={() => setEditing(false)} className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold py-1.5 px-3 rounded-lg">Cancel</button>
                           <button onClick={save} className="bg-[#13294b] hover:bg-[#1d3a66] text-white text-xs font-bold py-1.5 px-3 rounded-lg">Save</button></>}
                </div>
            </div>

            {!editing && lc.transitDepot && (() => {
                const received = !!lc.transitReceivedAt;
                const dwellH = received ? Math.max(0, Math.round((Date.now() - new Date(lc.transitReceivedAt!).getTime()) / 3600000)) : 0;
                const finalRegion = (lc.destinationBranch || '').replace('FBN ', '') || (lc.deliveryPoint || '').split(',').pop()?.trim();
                return (
                    <div className="rounded-xl p-4 border bg-indigo-50 border-indigo-200">
                        <p className="text-[11px] font-black uppercase tracking-widest mb-1 text-indigo-700">🔄 Transit via {lc.transitDepot}</p>
                        <p className="text-sm text-slate-700 mb-2">Leg 1 (subbie): <strong>{(lc.collectionBranch || '').replace('FBN ', '') || 'origin'} → {lc.transitDepot}</strong> · Leg 2 (FBN): <strong>{lc.transitDepot} → {finalRegion}</strong></p>
                        {!received ? (
                            <button onClick={() => handleUpdateLoadConfirmation(lc.id, { transitReceivedAt: new Date().toISOString(), status: 'At Destination Depot' as any }).then((r: any) => showToast(r?.ok === false ? `Could not update: ${r.error}` : `Received at ${lc.transitDepot} — onward planning ready.`))}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-4 rounded-lg text-sm">📦 Mark received at {lc.transitDepot} depot</button>
                        ) : (
                            <div className="space-y-2">
                                <p className="text-xs text-slate-600">At {lc.transitDepot} depot for <strong className={dwellH >= 48 ? 'text-rose-600' : 'text-slate-800'}>{dwellH}h</strong>{dwellH >= 48 ? ' — chase the onward leg' : ''}.</p>
                                <div className="flex flex-wrap items-end gap-2">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase">Planned final delivery
                                        <input type="date" value={onwardDate} onChange={e => setOnwardDate(e.target.value)} className="block bg-white border border-slate-300 rounded-md p-1.5 text-sm text-slate-700" /></label>
                                    <input type="time" value={onwardTime} onChange={e => setOnwardTime(e.target.value)} className="bg-white border border-slate-300 rounded-md p-1.5 text-sm text-slate-700" />
                                    <button onClick={() => handleUpdateLoadConfirmation(lc.id, { onwardPlannedDate: onwardDate || undefined, onwardPlannedTime: onwardTime || undefined } as any).then((r: any) => showToast(r?.ok === false ? `Could not save: ${r.error}` : 'Onward plan saved.'))}
                                        className="bg-[#13294b] text-white font-bold py-1.5 px-3 rounded-md text-sm">Save plan</button>
                                </div>
                                <div className="flex flex-wrap gap-2 pt-1">
                                    <button onClick={() => showModal('assignFbn', { loadCon: lc })} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-1.5 px-3 rounded-md text-sm">🚚 Onward on FBN fleet</button>
                                    <button onClick={() => showModal('assignLoadCon', { loadCon: lc })} className="bg-amber-600 hover:bg-amber-500 text-white font-bold py-1.5 px-3 rounded-md text-sm">+ Onward subbie LoadCon</button>
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
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-gray-900/50 rounded-xl p-3"><p className="text-[10px] font-bold text-gray-500 uppercase">Client Rate</p><p className="text-lg font-black text-blue-300">{rand(lc.totalAmount)}</p></div>
                    <div className="bg-gray-900/50 rounded-xl p-3"><p className="text-[10px] font-bold text-gray-500 uppercase">Transport Rate</p><p className="text-lg font-black text-amber-300">{rand(lc.supplierRate)}</p></div>
                    <div className={`rounded-xl p-3 ${margin < 0 ? 'bg-red-950/40 ring-1 ring-red-500' : 'bg-gray-900/50'}`}><p className="text-[10px] font-bold text-gray-500 uppercase">Margin{margin < 0 ? ' ⚠ LOSS' : ''}</p><p className={`text-lg font-black ${margin < 0 ? 'text-red-400' : marginPct < 10 ? 'text-amber-400' : 'text-emerald-400'}`}>{rand(margin)} <span className="text-xs">({marginPct.toFixed(0)}%)</span></p></div>
                </div>
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
                    // Own FBN fleet (collection leg) vs a real subcontractor (broking /
                    // outlying leg). Don't call an own-fleet truck a "Subcontractor".
                    const ownFleet = !lc.supplierId && (lc.subcontractorName || '').toUpperCase() === 'FBN TRANSPORT';
                    return (
                        <Section title={ownFleet ? 'FBN Vehicle / Driver' : 'Subcontractor'} accent={ownFleet ? 'bg-emerald-500' : 'bg-amber-500'}>
                            <div className="grid grid-cols-2 gap-3">
                                <F label={ownFleet ? 'Fleet' : 'Carrier'} k="subcontractorName" value={lc.subcontractorName} list={transporterOpts} />
                                <F label="For Attention" k="forAttention" value={lc.forAttention} />
                                {!ownFleet && <F label="Email" k="subcontractorEmail" value={lc.subcontractorEmail} />}
                                <F label="Driver" k="subcontractorDriverName" value={lc.subcontractorDriverName} />
                                <F label="Driver Cell" k="subcontractorDriverCell" value={lc.subcontractorDriverCell} />
                                <F label="Vehicle Reg" k="subcontractorVehicleReg" value={lc.subcontractorVehicleReg} />
                                {!ownFleet && <F label="Transport Rate" k="supplierRate" type="number" value={rand(lc.supplierRate)} />}
                            </div>
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
                    <div className="mt-2"><F label="Instructions" k="specialInstructions" value={lc.specialInstructions} /></div>
                </Section>
            </div>

            {!editing && (
                <Section title="Status & POD" accent="bg-purple-500">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-center">
                        <F label="Sent to Supplier" value={lc.sentToSupplierDate ? fmt(lc.sentToSupplierDate) : 'Not sent'} />
                        <F label="Payment" value={lc.paymentStatus || '—'} />
                        <F label="POD" value={lc.podPhoto ? 'Received' : 'Awaiting'} />
                        {lc.podPhoto?.data && (
                            <div className="flex items-center gap-3">
                                <a href={lc.podPhoto.data} target="_blank" rel="noreferrer" className="text-xs font-bold text-blue-400 hover:underline">View POD →</a>
                                <button onClick={sendPod} disabled={sendingPod} className="text-xs font-bold text-emerald-400 hover:underline disabled:opacity-50">{sendingPod ? 'Sending…' : 'Send / Resend POD →'}</button>
                            </div>
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
