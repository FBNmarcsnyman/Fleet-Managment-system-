
import React, { useMemo, useState } from 'react';
import { LoadConfirmation, Supplier, Client, Attachment, PodAnalysisResult } from '../../types';
import { useUIState } from '../../contexts/AppContexts';
import { supabase, directInvoke, invokeFn } from '../../lib/supabase';
import { buildLoadConPdf } from '../../lib/loadconPdf';
import { brandedEmail, emailButton } from '../../lib/emailTemplate';
import { sendDriverWhatsApp } from '../../contexts/OperationsContext';
import DateField from './DateField';
import { sendOrderToClient, sendLoadConToSupplier } from '../../lib/loadEmails';
import { format } from 'date-fns';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import { UploadIcon } from '../icons/UploadIcon';

interface SubcontractorLoadsViewProps {
    loadConfirmations: LoadConfirmation[];
    suppliers: Supplier[];
    clients: Client[];
    onUpdateLoadConfirmation: (id: string, updates: Partial<LoadConfirmation>) => void;
}

const SubcontractorLoadsView: React.FC<SubcontractorLoadsViewProps> = ({
    loadConfirmations = [],
    suppliers = [],
    clients = [],
    onUpdateLoadConfirmation,
}) => {
    const { showModal, showToast } = useUIState();
    // Default to "needs action" so the desk sees only what's outstanding (a load to
    // send or a POD to chase), not a wall of already-delivered rows.
    type Filter = 'Needs Action' | 'To Send' | 'Awaiting POD' | 'POD In' | 'All' | 'History';
    const [filter, setFilter] = useState<Filter>('Needs Action');
    // Which row's ⋯ menu is open, and where to draw it (fixed position so the table's
    // own scroll/overflow can't clip it).
    const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
    const openMenu = (e: React.MouseEvent, id: string) => {
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setMenu(m => (m?.id === id ? null : { id, x: Math.max(8, r.right - 208), y: r.bottom + 4 }));
    };
    // Optional "created on" date filter — see what was captured today or on a chosen day.
    const [createdDate, setCreatedDate] = useState('');
    // Click a column header to sort by it; click again to flip direction.
    type SortKey = 'number' | 'supplier' | 'date' | 'route' | 'status' | 'sent' | 'pod';
    const [sortKey, setSortKey] = useState<SortKey>('date');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const toggleSort = (k: SortKey) => {
        if (sortKey === k) { setSortDir(d => (d === 'asc' ? 'desc' : 'asc')); }
        else { setSortKey(k); setSortDir(k === 'date' ? 'desc' : 'asc'); }
    };

    const transportSuppliers = useMemo(() => suppliers.filter(s => s.type === 'Transport'), [suppliers]);
    const supplierMap = useMemo(() => new Map(transportSuppliers.map(s => [s.id, s])), [transportSuppliers]);
    const clientMap = useMemo(() => new Map(clients.map(c => [c.id, c])), [clients]);

    const brokeredLoads = useMemo(() => {
        const sortVal = (lc: LoadConfirmation): string | number => {
            switch (sortKey) {
                case 'number': return (lc.loadConNumber || '').toLowerCase();
                case 'supplier': return (supplierMap.get(lc.supplierId!)?.name || lc.subcontractorName || '').toLowerCase();
                case 'date': return new Date(lc.collectionDate || lc.date || 0).getTime();
                case 'route': return `${lc.collectionPoint || ''} ${lc.deliveryPoint || ''}`.toLowerCase();
                case 'status': return (lc.status || '').toLowerCase();
                case 'sent': return lc.sentToSupplierDate ? new Date(lc.sentToSupplierDate).getTime() : 0;
                case 'pod': return lc.podPhoto ? 2 : (lc.status === 'Delivered' ? 1 : 0);
                default: return 0;
            }
        };
        return (loadConfirmations || [])
            // A load is "brokered" if it has a linked transporter OR just a typed
            // transporter name (older / quick-captured loads never linked an id).
            .filter(lc => (lc.supplierId && supplierMap.has(lc.supplierId)) || (lc.subcontractorName && lc.subcontractorName.trim()))
            .filter(lc => {
                // Created-on filter (by capture date) — applies across every status filter.
                if (createdDate) {
                    const ca = (lc as any).createdAt || (lc as any).created_at;
                    if (!ca || new Date(ca).toISOString().slice(0, 10) !== createdDate) return false;
                }
                // "Invoiced" = completed/imported history — kept out of the active
                // board (you only send current loads); see it under History.
                if (filter === 'History') return lc.status === 'Invoiced';
                if (lc.status === 'Invoiced') return false;
                const toSend = !lc.sentToSupplierDate;
                const awaitingPod = ['Delivered', 'Out for Delivery'].includes(lc.status) && !lc.podPhoto;
                if (filter === 'To Send') return toSend;
                if (filter === 'Awaiting POD') return awaitingPod;
                if (filter === 'POD In') return !!lc.podPhoto;
                // Needs action = still to send, or delivered with the POD outstanding.
                if (filter === 'Needs Action') return toSend || awaitingPod;
                return true; // 'All'
            })
            .sort((a, b) => {
                const av = sortVal(a), bv = sortVal(b);
                const c = av < bv ? -1 : av > bv ? 1 : 0;
                return sortDir === 'asc' ? c : -c;
            });
    }, [loadConfirmations, filter, createdDate, supplierMap, sortKey, sortDir]);

    // Counts for the quick-filter chips (all brokered, current loads — excludes imported history).
    const counts = useMemo(() => {
        const brokered = (loadConfirmations || []).filter(lc => ((lc.supplierId && supplierMap.has(lc.supplierId)) || (lc.subcontractorName && lc.subcontractorName.trim())) && lc.status !== 'Invoiced');
        const toSend = brokered.filter(lc => !lc.sentToSupplierDate).length;
        const awaitingPod = brokered.filter(lc => ['Delivered', 'Out for Delivery'].includes(lc.status) && !lc.podPhoto).length;
        const podIn = brokered.filter(lc => !!lc.podPhoto).length;
        return { needs: toSend + awaitingPod, toSend, awaitingPod, podIn, all: brokered.length };
    }, [loadConfirmations, supplierMap]);

    const [requesting, setRequesting] = useState<string | null>(null);
    const [sendingLc, setSendingLc] = useState<string | null>(null);

    // All known CLIENT email addresses — to warn if a rate-bearing LoadCon is about to
    // be emailed to a client (a company can be both a client and a carrier, so we confirm,
    // never block).
    const clientEmailSet = useMemo(() => {
        const s = new Set<string>();
        (clients as any[]).forEach(c => {
            [c.contactEmail, ...String(c.clientCc || '').split(/[,;]/)].forEach(e => { const v = (e || '').trim().toLowerCase(); if (v) s.add(v); });
            (c.contacts || []).forEach((p: any) => { const v = (p.email || '').trim().toLowerCase(); if (v) s.add(v); });
        });
        return s;
    }, [clients]);

    // Actually EMAIL the Load Confirmation (branded PDF) to the subcontractor,
    // then stamp it as sent. Always lets you confirm / change / add the recipient
    // email first, and can be used again to RESEND.
    const handleSendLoadCon = async (lc: LoadConfirmation) => {
        const entered = window.prompt(`Email Load Confirmation ${lc.loadConNumber} to:`, lc.subcontractorEmail || '');
        if (entered === null) return; // cancelled
        const to = entered.trim();
        if (!to) { showToast('No email entered.'); return; }
        // Guard: this LoadCon shows the transport RATE — warn if it's going to a client
        // address (unless it IS this load's carrier email; a company can be both).
        if (clientEmailSet.has(to.toLowerCase()) && to.toLowerCase() !== (lc.subcontractorEmail || '').toLowerCase()) {
            if (!window.confirm(`⚠ ${to} is also a CLIENT contact.\n\nThis Load Confirmation shows your TRANSPORT RATE. Send it to this address anyway?`)) return;
        }
        // If this load had no (or a different) email, remember the one just used.
        if (to !== (lc.subcontractorEmail || '')) onUpdateLoadConfirmation(lc.id, { subcontractorEmail: to });
        setSendingLc(lc.id);
        try {
            // Use the SHARED sender so the wording is delivered-aware (no "accept this
            // load" after delivery) and transit-depot aware — one source of truth.
            const res = await sendLoadConToSupplier({ ...lc, subcontractorEmail: to }, to);
            if (!res.ok) { showToast(`Email failed: ${res.error || 'unknown error'}`); return; }
            onUpdateLoadConfirmation(lc.id, { sentToSupplierDate: new Date().toISOString() });
            // Also send the client their Order (the shared sender words it correctly
            // whether the load is on-route or already delivered).
            if (lc.clientEmail) {
                void sendOrderToClient({ ...lc, subcontractorEmail: to }).then(r => { if (r.ok) showToast(`Client order also emailed to ${lc.clientEmail}.`); else if (r.error) console.error('[loads] auto client order:', r.error); });
            }
            showToast(res.pdfFailed
                ? `Emailed to ${to} — but the PDF attachment couldn't be built, so only the details were sent.`
                : `Load Confirmation ${lc.loadConNumber} emailed to ${to} with the PDF attached.`);
        } catch (e) {
            showToast(`Could not send: ${e instanceof Error ? e.message : 'unknown error'}`);
        } finally {
            setSendingLc(null);
        }
    };

    // Send the CLIENT their professional order confirmation (Client Order PDF +
    // map links + "we've booked it, regular updates coming"). Files to Drive too.
    const handleSendClientOrder = async (lc: LoadConfirmation) => {
        const entered = window.prompt(`Email the Client Order ${lc.loadConNumber} to:`, lc.clientEmail || '');
        if (entered === null) return;
        const to = entered.trim();
        if (!to) { showToast('No email entered.'); return; }
        if (to !== (lc.clientEmail || '')) onUpdateLoadConfirmation(lc.id, { clientEmail: to });
        setSendingLc(lc.id);
        try {
            // Shared sender: words it correctly for on-route vs already-delivered.
            const res = await sendOrderToClient({ ...lc, clientEmail: to }, to);
            if (!res.ok) { showToast(`Email failed: ${res.error || 'unknown error'}`); return; }
            showToast(`Order confirmation emailed to the client (${to}).`);
        } catch (e) {
            showToast(`Could not send: ${e instanceof Error ? e.message : 'error'}`);
        } finally { setSendingLc(null); }
    };

    // Ask the transporter to send the POD for a delivered load. Works today via
    // email; the same trigger will fire a WhatsApp once a sender number is connected.
    const handleRequestPod = async (lc: LoadConfirmation) => {
        const to = lc.subcontractorEmail;
        if (!to) { showToast('No transporter email on this load — add one first.'); return; }
        setRequesting(lc.id);
        try {
            const route = `${lc.collectionPoint || ''}${lc.deliveryPoint ? ' to ' + lc.deliveryPoint : ''}`;
            const uploadLink = `${window.location.origin}${window.location.pathname}?pod=${lc.id}`;
            const html = brandedEmail(`<p>Good day ${lc.forAttention || lc.subcontractorName || ''},</p>
              <p>Please send through the <strong>POD</strong> for load <strong>${lc.loadConNumber}</strong>${route ? ` (${route})` : ''} now that it has delivered.</p>
              ${emailButton(uploadLink, 'Upload POD &rarr;', '#16a34a')}
              <p style="font-size:13px;color:#5b6573">Tap the button on your phone to snap a photo of the signed POD — no login needed. Or simply reply to this email with the POD attached.</p>
              <p>Thank you,<br>FBN Transport</p>`);
            const { data, error } = await invokeFn('send-email', {
                body: { to, cc: lc.ccEmail || undefined, subject: `POD required - Load ${lc.loadConNumber}`, html, fromName: 'FBN Transport' },
            });
            if (error || (data && (data as any).error)) { showToast(`Could not send request: ${(data as any)?.error || error?.message}`); return; }
            showToast(`POD request sent to ${to}.`);
        } catch (e) {
            showToast(`Could not send request: ${e instanceof Error ? e.message : 'error'}`);
        } finally {
            setRequesting(null);
        }
    };

    // Send (or resend) the received POD to a recipient — defaults to the client,
    // but you can type any address. WhatsApp-to-driver will hook in here once a
    // sender number is connected (it'll use the load's driver cell).
    const handleSendPod = async (lc: LoadConfirmation) => {
        const podUrl = lc.podPhoto?.data;
        if (!podUrl) { showToast('No POD on this load yet.'); return; }
        const def = lc.clientEmail || lc.subcontractorEmail || '';
        const entered = window.prompt(`Send POD for ${lc.loadConNumber} to (email):`, def);
        if (entered === null) return;
        const to = entered.trim();
        if (!to) { showToast('No email entered.'); return; }
        setRequesting(lc.id);
        try {
            const route = `${lc.collectionPoint || ''}${lc.deliveryPoint ? ' to ' + lc.deliveryPoint : ''}`;
            const html = brandedEmail(`<p>Good day,</p>
              <p>Please find the <strong>POD</strong> for load <strong>${lc.loadConNumber}</strong>${route ? ` (${route})` : ''}.</p>
              ${emailButton(podUrl, 'View / download POD &rarr;', '#16a34a')}
              <p>Regards,<br>FBN Transport</p>`);
            const { data, error } = await invokeFn('send-email', {
                body: { to, subject: `POD - Load ${lc.loadConNumber}`, html, fromName: 'FBN Transport' },
            });
            if (error || (data && (data as any).error)) { showToast(`Could not send POD: ${(data as any)?.error || error?.message}`); return; }
            showToast(`POD sent to ${to}.`);
        } catch (e) {
            showToast(`Could not send POD: ${e instanceof Error ? e.message : 'error'}`);
        } finally {
            setRequesting(null);
        }
    };

    // WhatsApp the driver the load brief (asks for their cell if not on file).
    const handleWhatsAppDriver = (lc: LoadConfirmation) => {
        let cell = lc.subcontractorDriverCell;
        if (!cell) {
            const entered = window.prompt(`Driver's cell number for ${lc.loadConNumber} (WhatsApp):`, '');
            if (entered === null) return;
            cell = entered.trim();
            if (!cell) { showToast('No number entered.'); return; }
            onUpdateLoadConfirmation(lc.id, { subcontractorDriverCell: cell });
        }
        const base = `${window.location.origin}${window.location.pathname}`;
        sendDriverWhatsApp({ ...lc, subcontractorDriverCell: cell }, `Hi ${lc.subcontractorDriverName || 'driver'}, FBN Transport load ${lc.loadConNumber}.\nCollect: ${lc.collectionPoint || '-'}\nDeliver: ${lc.deliveryPoint || '-'}\nCargo: ${lc.loadType || ''} ${lc.commodity || ''}${lc.weightKg ? ' · ' + lc.weightKg + 'kg' : ''}\nTrack/POD: ${base}?pod=${lc.id}\n\nWhat is your ETA at the loading point? Reply:\n1 = within 1 hour\n2 = within 2 hours\n3 = other (then type the time)`);
        showToast('WhatsApp sent to the driver.');
    };

    const handleViewPdf = (lc: LoadConfirmation) => {
        // Opens the 3-document set: LoadCon (subbie), Client Order (client), Delivery Note.
        showModal('loadDocuments', { loadCon: lc });
    };

    const handleViewPod = (podPhoto: Attachment) => {
        showModal('viewPod', { podPhoto });
    };

    const handlePodSubmit = (loadConId: string, podData: { 
        photo: Attachment, 
        signature: string,
        analysisResult?: PodAnalysisResult
    }) => {
        onUpdateLoadConfirmation(loadConId, {
            podPhoto: podData.photo,
            podSignature: podData.signature,
            podAnalysis: podData.analysisResult,
            paymentStatus: 'Awaiting POD'
        });
        showModal('hide');
        showToast('POD has been successfully uploaded.');
    };

    const handleUploadPodClick = (lc: LoadConfirmation) => {
        showModal('pod', {
            loadCon: lc,
            isManualUpload: true,
            onSubmit: handlePodSubmit,
            onCancel: () => showModal('hide'),
        });
    };

    // The single primary action for a row, chosen by where the load actually is.
    const primaryFor = (lc: LoadConfirmation): { label: string; tone: 'navy' | 'emerald' | 'slate'; onClick: () => void; icon?: 'upload' } => {
        if (!lc.sentToSupplierDate) return { label: sendingLc === lc.id ? 'Sending…' : 'Send LoadCon', tone: 'navy', onClick: () => handleSendLoadCon(lc) };
        if (lc.podPhoto) return { label: 'View POD', tone: 'emerald', onClick: () => handleViewPod(lc.podPhoto!) };
        if (['Delivered', 'Out for Delivery'].includes(lc.status)) return { label: 'Upload POD', tone: 'emerald', onClick: () => handleUploadPodClick(lc), icon: 'upload' };
        return { label: 'Documents', tone: 'slate', onClick: () => handleViewPdf(lc) };
    };
    const toneCls = (t: 'navy' | 'emerald' | 'slate') =>
        t === 'navy' ? 'bg-[#13294b] hover:bg-[#1d3a66] text-white'
        : t === 'emerald' ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
        : 'bg-slate-200 hover:bg-slate-300 text-slate-700';

    // Everything else lives behind the ⋯ menu, contextual to the row.
    const menuItemsFor = (lc: LoadConfirmation): { label: string; onClick: () => void }[] => {
        const items: { label: string; onClick: () => void }[] = [];
        if (lc.sentToSupplierDate) items.push({ label: 'Resend LoadCon', onClick: () => handleSendLoadCon(lc) });
        items.push({ label: 'Email client order', onClick: () => handleSendClientOrder(lc) });
        items.push({ label: 'WhatsApp driver', onClick: () => handleWhatsAppDriver(lc) });
        if (['Delivered', 'Out for Delivery'].includes(lc.status) && !lc.podPhoto) items.push({ label: 'Request POD from transporter', onClick: () => handleRequestPod(lc) });
        if (lc.podPhoto) { items.push({ label: 'Upload a new POD', onClick: () => handleUploadPodClick(lc) }); items.push({ label: 'Send / resend POD', onClick: () => handleSendPod(lc) }); }
        items.push({ label: 'Open documents', onClick: () => handleViewPdf(lc) });
        return items;
    };

    const Chip: React.FC<{ f: Filter; label: string; n?: number; tone?: string }> = ({ f, label, n, tone }) => (
        <button onClick={() => setFilter(f)} className={`text-xs font-bold px-3 py-1.5 rounded-full border transition ${filter === f ? 'bg-[#13294b] text-white border-[#13294b]' : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'}`}>
            {label}{typeof n === 'number' && <span className={`ml-1.5 ${filter === f ? 'text-blue-200' : tone || 'text-slate-400'}`}>{n}</span>}
        </button>
    );

    const activeMenu = menu ? brokeredLoads.find(l => l.id === menu.id) : null;

    return (
        <div className="bg-white border border-slate-200 p-6 rounded-lg shadow-sm">
            <div className="flex justify-between items-start mb-4 gap-3 flex-wrap">
                <div>
                    <h3 className="text-xl font-bold text-slate-900">Subcontractor Loads</h3>
                    <p className="text-xs text-slate-500 mt-0.5">One click per row does the next thing that's due — the rest is under ⋯.</p>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Created</span>
                    <button onClick={() => setCreatedDate(new Date().toISOString().slice(0, 10))} className={`text-xs font-bold px-2.5 py-1.5 rounded-md ${createdDate === new Date().toISOString().slice(0, 10) ? 'bg-[#13294b] text-white' : 'bg-slate-100 text-slate-600'}`}>Today</button>
                    <div className="w-36"><DateField value={createdDate} onChange={setCreatedDate} /></div>
                    {createdDate && <button onClick={() => setCreatedDate('')} title="Clear" className="text-xs font-bold text-slate-400 hover:text-slate-700 px-1">✕</button>}
                </div>
            </div>

            {/* Quick-filter chips — default lands on "Needs action" so the desk sees only outstanding work. */}
            <div className="flex items-center gap-2 flex-wrap mb-4">
                <Chip f="Needs Action" label="Needs action" n={counts.needs} tone="text-rose-500" />
                <Chip f="To Send" label="To send" n={counts.toSend} tone="text-rose-500" />
                <Chip f="Awaiting POD" label="Awaiting POD" n={counts.awaitingPod} tone="text-amber-500" />
                <Chip f="POD In" label="POD in" n={counts.podIn} tone="text-emerald-600" />
                <Chip f="All" label="All" n={counts.all} />
                <Chip f="History" label="History" />
            </div>

            <div className="overflow-x-auto max-h-[60vh]">
                <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-slate-100">
                        <tr className="border-b border-slate-200">
                            {([
                                ['number', 'LoadCon #'], ['supplier', 'Supplier'], ['date', 'Loading Date'],
                                ['route', 'Route'], ['status', 'Status'], ['sent', 'Sent'],
                            ] as [SortKey, string][]).map(([k, label]) => (
                                <th key={k} onClick={() => toggleSort(k)}
                                    className="p-2 text-slate-500 cursor-pointer select-none hover:text-slate-800 whitespace-nowrap">
                                    {label}<span className="ml-1 text-slate-400">{sortKey === k ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                                </th>
                            ))}
                            <th className="p-2 text-slate-500 text-right">Next action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {brokeredLoads.map(lc => {
                            const supplier = supplierMap.get(lc.supplierId!);
                            const supplierName = supplier?.name || lc.subcontractorName || '—';
                            const route = `${lc.collectionPoint || ''} → ${lc.deliveryPoint || ''}`;
                            const primary = primaryFor(lc);
                            return (
                                <tr key={lc.id} className="border-b border-slate-100 hover:bg-slate-50 text-slate-700">
                                    <td className="p-2 font-mono"><button onClick={() => showModal('loadDetail', { loadCon: lc })} className="text-blue-600 hover:text-blue-700 hover:underline font-bold">{lc.loadConNumber}</button></td>
                                    <td className="p-2 font-semibold text-slate-900 whitespace-nowrap">{supplierName}</td>
                                    <td className="p-2 text-slate-500 whitespace-nowrap">{lc.collectionDate ? format(new Date(lc.collectionDate), 'dd MMM yyyy') : '—'}</td>
                                    <td className="p-2 max-w-[280px] truncate" title={route}>{route}</td>
                                    <td className="p-2 whitespace-nowrap">{lc.status}</td>
                                    <td className="p-2 whitespace-nowrap">
                                        {lc.sentToSupplierDate
                                            ? <span className="inline-flex items-center text-emerald-700 text-xs font-semibold"><CheckCircleIcon className="h-4 w-4 mr-1" />{format(new Date(lc.sentToSupplierDate), 'dd MMM')}</span>
                                            : <span className="text-xs font-semibold text-rose-500">Not sent</span>}
                                    </td>
                                    <td className="p-2 text-right whitespace-nowrap">
                                        <div className="inline-flex items-center gap-1.5">
                                            <button onClick={primary.onClick} disabled={sendingLc === lc.id} className={`inline-flex items-center text-xs font-bold py-1.5 px-3 rounded-lg disabled:opacity-50 ${toneCls(primary.tone)}`}>
                                                {primary.icon === 'upload' && <UploadIcon className="h-4 w-4 mr-1" />}{primary.label}
                                            </button>
                                            <button onClick={e => openMenu(e, lc.id)} title="More actions" className={`text-sm font-black px-2 py-1 rounded-lg border ${menu?.id === lc.id ? 'bg-[#13294b] text-white border-[#13294b]' : 'bg-white text-slate-500 border-slate-300 hover:bg-slate-50'}`}>⋯</button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {brokeredLoads.length === 0 && <p className="text-center text-slate-400 py-16">Nothing here — try another filter.</p>}
            </div>

            {/* ⋯ action menu — fixed-positioned so the table's scroll can't clip it. */}
            {menu && activeMenu && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setMenu(null)} />
                    <div className="fixed z-50 w-52 bg-white border border-slate-200 rounded-xl shadow-lg py-1" style={{ left: menu.x, top: menu.y }}>
                        {menuItemsFor(activeMenu).map((it, i) => (
                            <button key={i} onClick={() => { setMenu(null); it.onClick(); }} disabled={(requesting === activeMenu.id || sendingLc === activeMenu.id)} className="w-full text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 px-3 py-2">{it.label}</button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default SubcontractorLoadsView;
