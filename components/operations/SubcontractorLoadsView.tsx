
import React, { useMemo, useState } from 'react';
import { LoadConfirmation, Supplier, Client, Attachment, PodAnalysisResult } from '../../types';
import { useUIState } from '../../contexts/AppContexts';
import { supabase, directInvoke, invokeFn } from '../../lib/supabase';
import { buildLoadConPdf } from '../../lib/loadconPdf';
import { brandedEmail, emailButton } from '../../lib/emailTemplate';
import { sendDriverWhatsApp } from '../../contexts/OperationsContext';
import { sendOrderToClient } from '../../lib/loadEmails';
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
    const [filter, setFilter] = useState<'All' | 'To Send' | 'Sent' | 'Awaiting POD' | 'History'>('All');
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
                case 'supplier': return (supplierMap.get(lc.supplierId!)?.name || '').toLowerCase();
                case 'date': return new Date(lc.collectionDate || lc.date || 0).getTime();
                case 'route': return `${lc.collectionPoint || ''} ${lc.deliveryPoint || ''}`.toLowerCase();
                case 'status': return (lc.status || '').toLowerCase();
                case 'sent': return lc.sentToSupplierDate ? new Date(lc.sentToSupplierDate).getTime() : 0;
                case 'pod': return lc.podPhoto ? 2 : (lc.status === 'Delivered' ? 1 : 0);
                default: return 0;
            }
        };
        return (loadConfirmations || [])
            .filter(lc => lc.supplierId && supplierMap.has(lc.supplierId))
            .filter(lc => {
                // "Invoiced" = completed/imported history — kept out of the active
                // board (you only send current loads); see it under History.
                if (filter === 'History') return lc.status === 'Invoiced';
                if (lc.status === 'Invoiced') return false;
                if (filter === 'To Send') return !lc.sentToSupplierDate;
                if (filter === 'Sent') return !!lc.sentToSupplierDate;
                if (filter === 'Awaiting POD') return ['Delivered', 'Out for Delivery'].includes(lc.status) && !lc.podPhoto;
                return true;
            })
            .sort((a, b) => {
                const av = sortVal(a), bv = sortVal(b);
                const c = av < bv ? -1 : av > bv ? 1 : 0;
                return sortDir === 'asc' ? c : -c;
            });
    }, [loadConfirmations, filter, supplierMap, sortKey, sortDir]);

    const [requesting, setRequesting] = useState<string | null>(null);
    const [sendingLc, setSendingLc] = useState<string | null>(null);

    // Actually EMAIL the Load Confirmation (branded PDF) to the subcontractor,
    // then stamp it as sent. Always lets you confirm / change / add the recipient
    // email first, and can be used again to RESEND.
    const handleSendLoadCon = async (lc: LoadConfirmation) => {
        const entered = window.prompt(`Email Load Confirmation ${lc.loadConNumber} to:`, lc.subcontractorEmail || '');
        if (entered === null) return; // cancelled
        const to = entered.trim();
        if (!to) { showToast('No email entered.'); return; }
        // If this load had no (or a different) email, remember the one just used.
        if (to !== (lc.subcontractorEmail || '')) onUpdateLoadConfirmation(lc.id, { subcontractorEmail: to });
        setSendingLc(lc.id);
        try {
            let attachments: any[] | undefined;
            let pdfFailed = false;
            let loadConB64: string | undefined;
            try {
                const { base64, filename } = await buildLoadConPdf(lc, 'loadcon');
                loadConB64 = base64;
                attachments = [{ filename, content: base64, contentType: 'application/pdf' }];
            } catch (pdfErr) {
                console.error('[loads] LoadCon PDF build failed, sending without attachment:', pdfErr);
                pdfFailed = true;
            }
            const base = `${window.location.origin}${window.location.pathname}`;
            const fmtD = (d?: string) => { if (!d) return ''; try { return format(new Date(d), 'dd/MM/yyyy'); } catch { return d; } };
            // Short locality (last part of the address) for a tidy intro line.
            const shortLoc = (a?: string) => { const p = String(a || '').split(',').map(s => s.trim()).filter(Boolean); return p.length ? p[p.length - 1] : (a || ''); };
            const collLoc = shortLoc(lc.collectionPoint); const delLoc = shortLoc(lc.deliveryPoint);
            // Clickable Google Maps link for an address (no API key needed for the link).
            const mapLink = (addr?: string) => addr ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}` : '';
            const withMap = (addr?: string) => addr ? `${addr} &nbsp;<a href="${mapLink(addr)}" style="color:#1d4ed8;font-weight:700;white-space:nowrap">📍 View on map</a>` : '';
            // Key details in the email body itself, so the load info is always there
            // even if the PDF doesn't render in their mail client.
            const rows: [string, string | undefined][] = [
                ['Collection', withMap(lc.collectionPoint)],
                ['Delivery', withMap(lc.deliveryPoint)],
                ['Loading date', fmtD(lc.collectionDate)],
                ['Loading time', lc.loadingTime],
                ['Load type / size', lc.loadType],
                ['Weight (kg)', lc.weightKg],
                ['Commodity', lc.commodity],
                ['Packaging', lc.packaging],
                ['Transport rate', lc.supplierRate ? `R ${lc.supplierRate}` : ''],
                ['Special instructions', lc.specialInstructions],
            ];
            const detailRows = rows.filter(([, v]) => v != null && `${v}`.trim() !== '')
                .map(([k, v]) => `<tr><td style="padding:5px 14px 5px 0;color:#13294b;font-size:13px;font-weight:700;white-space:nowrap;vertical-align:top">${k}</td><td style="padding:5px 0;color:#13294b;font-size:13px;font-weight:700">${v}</td></tr>`).join('');
            const detailsTable = detailRows ? `<table style="border-collapse:collapse;margin:6px 0 14px">${detailRows}</table>` : '';
            const html = brandedEmail(`<div style="text-align:right;font-weight:800;color:#13294b;font-size:16px;margin-bottom:10px">${lc.loadConNumber}</div>
              <p>Good day ${lc.forAttention || lc.subcontractorName || ''},</p>
              <p>Please find ${attachments ? 'attached ' : ''}your FBN Load Confirmation for the load from <strong>${collLoc}</strong> to <strong>${delLoc}</strong>.</p>
              ${detailsTable}
              <p>Kindly <strong>confirm acceptance</strong> and send your driver name, vehicle registration and driver cell using the button below. POD to be returned on delivery.</p>
              ${emailButton(`${base}?accept=${lc.id}`, 'Accept this load &amp; send driver details &rarr;', '#16a34a')}
              <p>Regards,<br>FBN Transport</p>`);
            const subjLoc = (a: string) => a ? `${lc.clientName ? lc.clientName + ', ' : ''}${a}` : '';
            const { data, error } = await invokeFn('send-email', {
                body: { to, cc: ['loadcons@fbn-transport.co.za', ...(lc.ccEmail ? [lc.ccEmail] : [])], subject: `FBN Load Confirmation ${lc.loadConNumber} - ${subjLoc(collLoc)} to ${subjLoc(delLoc)}`,
                    html, fromName: 'FBN Transport', attachments },
            });
            if (error || (data as any)?.error) { showToast(`Email failed: ${(data as any)?.error || error?.message || 'unknown error'}`); return; }
            onUpdateLoadConfirmation(lc.id, { sentToSupplierDate: new Date().toISOString() });
            // Send the client their Order at the SAME time the LoadCon goes to the
            // transporter — all subsequent client updates thread under this email.
            // Skip for already-delivered (back-dated) loads: there the client gets
            // the order together with the signed POD once it's uploaded.
            if (lc.clientEmail && lc.status !== 'Delivered' && lc.status !== 'POD Submitted' && lc.status !== 'Invoiced') {
                void sendOrderToClient(lc).then(r => { if (r.ok) showToast(`Client order also emailed to ${lc.clientEmail}.`); else if (r.error) console.error('[loads] auto client order:', r.error); });
            }
            // File the LoadCon + Client Order PDFs into the load's Google Drive folder (fire-and-forget).
            void (async () => {
                try {
                    const files: any[] = [];
                    if (loadConB64) files.push({ base64: loadConB64, name: 'LoadCon.pdf', kind: 'loadcon', contentType: 'application/pdf' });
                    try { const co = await buildLoadConPdf(lc, 'clientOrder'); files.push({ base64: co.base64, name: 'Client-Order.pdf', kind: 'clientorder', contentType: 'application/pdf' }); } catch { /* */ }
                    if (files.length) await directInvoke('drive-file', { loadId: lc.id, files });
                } catch (e) { console.error('[loads] drive filing of PDFs failed:', e); }
            })();
            showToast(pdfFailed
                ? `Emailed to ${to} — but the PDF attachment couldn't be built, so only the details (in the email body) were sent.`
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
            let attachments: any[] | undefined; let clientB64: string | undefined;
            try { const { base64, filename } = await buildLoadConPdf(lc, 'clientOrder'); clientB64 = base64; attachments = [{ filename, content: base64, contentType: 'application/pdf' }]; }
            catch (e) { console.error('[loads] Client Order PDF failed:', e); }
            const base = `${window.location.origin}${window.location.pathname}`;
            const fmtD = (d?: string) => { if (!d) return ''; try { return format(new Date(d), 'dd/MM/yyyy'); } catch { return d; } };
            const shortLoc = (a?: string) => { const p = String(a || '').split(',').map(s => s.trim()).filter(Boolean); return p.length ? p[p.length - 1] : (a || ''); };
            const mapLink = (a?: string) => a ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a)}` : '';
            const withMap = (a?: string) => a ? `${a} &nbsp;<a href="${mapLink(a)}" style="color:#1d4ed8;font-weight:700;white-space:nowrap">📍 View on map</a>` : '';
            const rows: [string, string | undefined][] = [
                ['Collection', withMap(lc.collectionPoint)], ['Delivery', withMap(lc.deliveryPoint)],
                ['Loading date', fmtD(lc.collectionDate)], ['Load type / size', lc.loadType],
                ['Weight (kg)', lc.weightKg], ['Commodity', lc.commodity], ['Packaging', lc.packaging],
                ['Your reference', lc.customerOrderNumber],
            ];
            const detailRows = rows.filter(([, v]) => v != null && `${v}`.trim() !== '')
                .map(([k, v]) => `<tr><td style="padding:5px 14px 5px 0;color:#13294b;font-size:13px;font-weight:700;white-space:nowrap;vertical-align:top">${k}</td><td style="padding:5px 0;color:#13294b;font-size:13px;font-weight:700">${v}</td></tr>`).join('');
            const detailsTable = detailRows ? `<table style="border-collapse:collapse;margin:6px 0 14px">${detailRows}</table>` : '';
            const html = brandedEmail(`<div style="text-align:right;font-weight:800;color:#13294b;font-size:16px;margin-bottom:10px">${lc.loadConNumber}</div>
              <p>Good day ${lc.clientContact || lc.clientName || ''},</p>
              <p><strong>Thank you for your load.</strong> We have made all the arrangements and booked it accordingly. Please find your order ${attachments ? 'attached, ' : ''}with all the details${attachments ? '' : ' below'}:</p>
              ${detailsTable}
              ${emailButton(`${base}?track=${lc.id}`, 'Track your shipment &rarr;')}
              <p>You'll receive regular updates as we progress through collection and delivery, and the POD as soon as it's available.</p>
              <p>Regards,<br>FBN Transport</p>`);
            const subjLoc = (a: string) => a ? `${lc.clientName ? lc.clientName + ', ' : ''}${a}` : '';
            const { data, error } = await invokeFn('send-email', {
                body: { to, cc: lc.ccEmail || undefined, subject: `FBN Transport Order ${lc.loadConNumber} - ${subjLoc(shortLoc(lc.collectionPoint))} to ${subjLoc(shortLoc(lc.deliveryPoint))}`, html, fromName: 'FBN Transport', attachments },
            });
            if (error || (data as any)?.error) { showToast(`Email failed: ${(data as any)?.error || error?.message}`); return; }
            if (clientB64) void directInvoke('drive-file', { loadId: lc.id, files: [{ base64: clientB64, name: 'Client-Order.pdf', kind: 'clientorder', contentType: 'application/pdf' }] });
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

    return (
        <div className="bg-white border border-slate-200 p-6 rounded-lg shadow-sm">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-slate-900">Subcontractor Loads</h3>
                <div className="flex items-center space-x-3">
                    <select value={filter} onChange={e => setFilter(e.target.value as any)} className="bg-white text-slate-800 p-2 rounded-md border border-slate-300">
                        <option value="All">All active</option>
                        <option value="To Send">To send (email confirmation)</option>
                        <option value="Sent">Sent to subcontractor</option>
                        <option value="Awaiting POD">Awaiting PODs</option>
                        <option value="History">History (imported)</option>
                    </select>
                </div>
            </div>
            <div className="overflow-x-auto max-h-[60vh]">
                <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-slate-100">
                        <tr className="border-b border-slate-200">
                            {([
                                ['number', 'LoadCon #'], ['supplier', 'Supplier'], ['date', 'Loading Date'],
                                ['route', 'Route'], ['status', 'Status'], ['sent', 'Sent to Supplier'], ['pod', 'POD Status'],
                            ] as [SortKey, string][]).map(([k, label]) => (
                                <th key={k} onClick={() => toggleSort(k)}
                                    className="p-2 text-slate-500 cursor-pointer select-none hover:text-slate-800 whitespace-nowrap">
                                    {label}<span className="ml-1 text-slate-400">{sortKey === k ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                                </th>
                            ))}
                            <th className="p-2 text-slate-500 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {brokeredLoads.map(lc => {
                            const supplier = supplierMap.get(lc.supplierId!);
                            return (
                                <tr key={lc.id} className="border-b border-slate-100 hover:bg-slate-50 text-slate-700">
                                    <td className="p-2 font-mono"><button onClick={() => showModal('loadDetail', { loadCon: lc })} className="text-blue-600 hover:text-blue-700 hover:underline font-bold">{lc.loadConNumber}</button></td>
                                    <td className="p-2 font-semibold text-slate-900">{supplier?.name}</td>
                                    <td className="p-2 text-slate-500">{lc.collectionDate ? format(new Date(lc.collectionDate), 'dd MMM yyyy') : '—'}</td>
                                    <td className="p-2">{lc.collectionPoint} &rarr; {lc.deliveryPoint}</td>
                                    <td className="p-2">{lc.status}</td>
                                    <td className="p-2">
                                        <div className="flex items-center gap-2">
                                            {lc.sentToSupplierDate && (
                                                <span className="flex items-center text-green-400 text-xs"><CheckCircleIcon className="h-4 w-4 mr-1" />{format(new Date(lc.sentToSupplierDate), 'dd MMM')}</span>
                                            )}
                                            <button onClick={() => handleSendLoadCon(lc)} disabled={sendingLc === lc.id} className="text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-1 px-2 rounded-lg">
                                                {sendingLc === lc.id ? 'Sending…' : lc.sentToSupplierDate ? 'Resend' : 'Email LoadCon'}
                                            </button>
                                            <button onClick={() => handleSendClientOrder(lc)} disabled={sendingLc === lc.id} title="Email the client their order confirmation" className="text-xs font-semibold bg-slate-200 hover:bg-slate-300 disabled:opacity-50 text-slate-700 py-1 px-2 rounded-lg">Email Order</button>
                                            <button onClick={() => handleWhatsAppDriver(lc)} title="WhatsApp the driver the load brief" className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white py-1 px-2 rounded-lg">WhatsApp</button>
                                        </div>
                                    </td>
                                    <td className="p-2">
                                        {lc.podPhoto ? (
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => handleViewPod(lc.podPhoto!)} className="inline-flex items-center text-xs font-semibold bg-green-100 text-green-700 hover:bg-green-200 py-1 px-2 rounded-lg">View POD</button>
                                                <button onClick={() => handleSendPod(lc)} disabled={requesting === lc.id} title="Email the POD to the client or anyone (WhatsApp to driver coming soon)" className="text-xs font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-50">{requesting === lc.id ? 'Sending…' : 'Send / Resend'}</button>
                                            </div>
                                        ) : lc.status === 'Delivered' ? (
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => handleUploadPodClick(lc)} className="inline-flex items-center text-xs font-semibold bg-green-600 hover:bg-green-700 text-white py-1 px-2 rounded-lg"><UploadIcon className="h-4 w-4 mr-1"/> Upload POD</button>
                                                <button onClick={() => handleRequestPod(lc)} disabled={requesting === lc.id} title="Email the transporter to send the POD" className="text-xs font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-50">{requesting === lc.id ? 'Sending…' : 'Request'}</button>
                                            </div>
                                        ) : (
                                            <span className="text-amber-600 text-xs">Awaiting delivery</span>
                                        )}
                                    </td>
                                    <td className="p-2 text-right">
                                        <button onClick={() => handleViewPdf(lc)} className="text-xs font-semibold bg-slate-200 hover:bg-slate-300 text-slate-700 py-1 px-3 rounded-lg">Documents</button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {brokeredLoads.length === 0 && <p className="text-center text-slate-400 py-16">No subcontractor loads found.</p>}
            </div>
        </div>
    );
};

export default SubcontractorLoadsView;
