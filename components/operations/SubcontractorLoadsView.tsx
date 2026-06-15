
import React, { useMemo, useState } from 'react';
import { LoadConfirmation, Supplier, Client, Attachment, PodAnalysisResult } from '../../types';
import { useUIState } from '../../contexts/AppContexts';
import { supabase } from '../../lib/supabase';
import { buildLoadConPdf } from '../../lib/loadconPdf';
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
    const [filter, setFilter] = useState<'All' | 'POD Awaiting' | 'Sent' | 'History'>('All');

    const transportSuppliers = useMemo(() => suppliers.filter(s => s.type === 'Transport'), [suppliers]);
    const supplierMap = useMemo(() => new Map(transportSuppliers.map(s => [s.id, s])), [transportSuppliers]);
    const clientMap = useMemo(() => new Map(clients.map(c => [c.id, c])), [clients]);

    const brokeredLoads = useMemo(() => {
        return (loadConfirmations || [])
            .filter(lc => lc.supplierId && supplierMap.has(lc.supplierId))
            .filter(lc => {
                // "Invoiced" = completed/imported history — kept out of the active
                // board (you only send current loads); see it under History.
                if (filter === 'History') return lc.status === 'Invoiced';
                if (lc.status === 'Invoiced') return false;
                if (filter === 'POD Awaiting') return !lc.podPhoto;
                if (filter === 'Sent') return !!lc.sentToSupplierDate;
                return true;
            })
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [loadConfirmations, filter, supplierMap]);

    const [requesting, setRequesting] = useState<string | null>(null);
    const [sendingLc, setSendingLc] = useState<string | null>(null);

    // Actually EMAIL the Load Confirmation (branded PDF) to the subcontractor,
    // then stamp it as sent. (Previously this only stamped the date.)
    const handleSendLoadCon = async (lc: LoadConfirmation) => {
        const to = lc.subcontractorEmail;
        if (!to) { showToast('No subcontractor email on this load — open Documents to add one first.'); return; }
        setSendingLc(lc.id);
        try {
            let attachments: any[] | undefined;
            try {
                const { base64, filename } = await buildLoadConPdf(lc, 'loadcon');
                attachments = [{ filename, content: base64, contentType: 'application/pdf' }];
            } catch (pdfErr) {
                console.error('[loads] LoadCon PDF build failed, sending without attachment:', pdfErr);
            }
            const route = `${lc.collectionPoint || ''}${lc.deliveryPoint ? ' to ' + lc.deliveryPoint : ''}`;
            const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;color:#1f2937">
              <p>Good day ${lc.forAttention || lc.subcontractorName || ''},</p>
              <p>Please find attached FBN Load Confirmation <strong>${lc.loadConNumber}</strong>${route ? ` for <strong>${route}</strong>` : ''}.</p>
              <p>Kindly <strong>confirm acceptance</strong> and reply with your driver name, vehicle registration and driver cell. POD to be returned on delivery.</p>
              <p>Regards,<br>FBN Transport &middot; tracking@fbn-transport.co.za</p>
            </div>`;
            const { data, error } = await supabase.functions.invoke('send-email', {
                body: { to, cc: lc.ccEmail || undefined, subject: `FBN Load Confirmation ${lc.loadConNumber} - ${lc.collectionPoint || ''} to ${lc.deliveryPoint || ''}`,
                    html, fromName: 'FBN Transport', attachments },
            });
            if (error || (data as any)?.error) { showToast(`Email failed: ${(data as any)?.error || error?.message || 'unknown error'}`); return; }
            onUpdateLoadConfirmation(lc.id, { sentToSupplierDate: new Date().toISOString() });
            showToast(`Load Confirmation ${lc.loadConNumber} emailed to ${to}.`);
        } catch (e) {
            showToast(`Could not send: ${e instanceof Error ? e.message : 'unknown error'}`);
        } finally {
            setSendingLc(null);
        }
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
            const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;color:#1f2937">
              <p>Good day ${lc.forAttention || lc.subcontractorName || ''},</p>
              <p>Please send through the <strong>POD</strong> for load <strong>${lc.loadConNumber}</strong>${route ? ` (${route})` : ''} now that it has delivered.</p>
              <p style="text-align:center;margin:22px 0">
                <a href="${uploadLink}" style="background:#13294b;color:#fff;text-decoration:none;font-weight:bold;padding:12px 26px;border-radius:8px;display:inline-block">Upload POD &rarr;</a>
              </p>
              <p style="font-size:13px;color:#5b6573">Tap the button on your phone to snap a photo of the signed POD — no login needed. Or simply reply to this email with the POD attached.</p>
              <p>Thank you,<br>FBN Transport &middot; tracking@fbn-transport.co.za</p>
            </div>`;
            const { data, error } = await supabase.functions.invoke('send-email', {
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
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-white">Subcontractor Loads</h3>
                <div className="flex items-center space-x-3">
                    <select value={filter} onChange={e => setFilter(e.target.value as any)} className="bg-gray-700 text-white p-2 rounded-md border border-gray-600">
                        <option value="All">Active Loads</option>
                        <option value="POD Awaiting">POD Awaiting</option>
                        <option value="Sent">Sent to Supplier</option>
                        <option value="History">History (imported)</option>
                    </select>
                </div>
            </div>
            <div className="overflow-x-auto max-h-[60vh]">
                <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-gray-800">
                        <tr className="border-b border-gray-700">
                            <th className="p-2 text-gray-400">LoadCon #</th>
                            <th className="p-2 text-gray-400">Supplier</th>
                            <th className="p-2 text-gray-400">Loading Date</th>
                            <th className="p-2 text-gray-400">Route</th>
                            <th className="p-2 text-gray-400">Status</th>
                            <th className="p-2 text-gray-400">Sent to Supplier</th>
                            <th className="p-2 text-gray-400">POD Status</th>
                            <th className="p-2 text-gray-400 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {brokeredLoads.map(lc => {
                            const supplier = supplierMap.get(lc.supplierId!);
                            return (
                                <tr key={lc.id} className="border-b border-gray-700/50 hover:bg-gray-700/50">
                                    <td className="p-2 font-mono"><button onClick={() => showModal('loadDetail', { loadCon: lc })} className="text-blue-400 hover:text-blue-300 hover:underline font-bold">{lc.loadConNumber}</button></td>
                                    <td className="p-2 font-semibold">{supplier?.name}</td>
                                    <td className="p-2 text-gray-300">{lc.collectionDate ? format(new Date(lc.collectionDate), 'dd MMM yyyy') : '—'}</td>
                                    <td className="p-2">{lc.collectionPoint} &rarr; {lc.deliveryPoint}</td>
                                    <td className="p-2">{lc.status}</td>
                                    <td className="p-2">
                                        {lc.sentToSupplierDate ? (
                                            <span className="flex items-center text-green-400 text-xs"><CheckCircleIcon className="h-4 w-4 mr-1" />{format(new Date(lc.sentToSupplierDate), 'dd MMM')}</span>
                                        ) : (
                                            <button onClick={() => handleSendLoadCon(lc)} disabled={sendingLc === lc.id} className="text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-1 px-2 rounded-lg">{sendingLc === lc.id ? 'Sending…' : 'Email LoadCon'}</button>
                                        )}
                                    </td>
                                    <td className="p-2">
                                        {lc.podPhoto ? (
                                            <button onClick={() => handleViewPod(lc.podPhoto!)} className="inline-flex items-center text-xs font-semibold bg-green-600/20 text-green-400 hover:bg-green-600/30 py-1 px-2 rounded-lg">View POD</button>
                                        ) : lc.status === 'Delivered' ? (
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => handleUploadPodClick(lc)} className="inline-flex items-center text-xs font-semibold bg-green-600 hover:bg-green-700 text-white py-1 px-2 rounded-lg"><UploadIcon className="h-4 w-4 mr-1"/> Upload POD</button>
                                                <button onClick={() => handleRequestPod(lc)} disabled={requesting === lc.id} title="Email the transporter to send the POD" className="text-xs font-semibold text-blue-300 hover:text-blue-200 disabled:opacity-50">{requesting === lc.id ? 'Sending…' : 'Request'}</button>
                                            </div>
                                        ) : (
                                            <span className="text-yellow-400 text-xs">Awaiting delivery</span>
                                        )}
                                    </td>
                                    <td className="p-2 text-right">
                                        <button onClick={() => handleViewPdf(lc)} className="text-xs font-semibold bg-gray-600 hover:bg-gray-500 text-white py-1 px-3 rounded-lg">Documents</button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {brokeredLoads.length === 0 && <p className="text-center text-gray-500 py-16">No subcontractor loads found.</p>}
            </div>
        </div>
    );
};

export default SubcontractorLoadsView;
