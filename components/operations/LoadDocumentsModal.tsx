import React, { useState, useEffect } from 'react';
import { LoadConfirmation } from '../../types';
import { useUIState, useAuth, useOperations } from '../../contexts/AppContexts';
import { supabase } from '../../lib/supabase';
import { buildLoadConPdf } from '../../lib/loadconPdf';
import { PrinterIcon } from '../icons/PrinterIcon';

type DocType = 'loadcon' | 'clientOrder' | 'deliveryNote';

// FBN brand palette
const NAVY = '#13294b';
const YELLOW = '#f5b700';
const GREY = '#5b6573';

const fmtDate = (d?: string) => {
    if (!d) return '';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
};

// Preview shows the EXACT PDF that gets emailed/printed (the FBN "Transport Order"
// grid built in lib/loadconPdf.ts), so the screen and the document never drift.
const DocView: React.FC<{ lc: LoadConfirmation; type: DocType }> = ({ lc, type }) => {
    const [url, setUrl] = useState<string | null>(null);
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        let made: string | null = null;
        setUrl(null); setErr(null);
        buildLoadConPdf(lc, type)
            .then(({ doc }) => {
                if (cancelled) return;
                made = doc.output('bloburl') as unknown as string;
                setUrl(made);
            })
            .catch(e => { if (!cancelled) setErr(e instanceof Error ? e.message : 'Could not build the document.'); });
        return () => { cancelled = true; if (made) URL.revokeObjectURL(made); };
    }, [lc, type]);

    if (err) return <div style={{ padding: 40, textAlign: 'center', color: '#fca5a5' }}>{err}</div>;
    if (!url) return <div style={{ padding: 40, textAlign: 'center', color: '#fff' }}>Building document…</div>;
    return <iframe src={url} title="document" style={{ width: '100%', height: '76vh', border: 'none', background: '#fff', borderRadius: 6 }} />;
};

// A short covering message above the document in the email.
const coverNote = (lc: LoadConfirmation, type: DocType, sender: string): string => {
    const route = `${lc.collectionPoint || ''}${lc.deliveryPoint ? ' → ' + lc.deliveryPoint : ''}`;
    const when = fmtDate(lc.collectionDate);
    const p = (s: string) => `<p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1f2937;margin:0 0 10px">${s}</p>`;
    if (type === 'clientOrder') {
        return `<div style="margin-bottom:18px">${p(`Good day ${lc.clientContact || lc.clientName || ''},`)}${p(`Please find your FBN Transport Order <strong>${lc.loadConNumber}</strong>${route ? ` for <strong>${route}</strong>` : ''}${when ? `, collection ${when}` : ''}.`)}${p('Kindly confirm and reply with your order number if not already supplied.')}${p(`Regards,<br>${sender}<br>FBN Transport · tracking@fbn-transport.co.za`)}</div>`;
    }
    return `<div style="margin-bottom:18px">${p(`Good day ${lc.forAttention || lc.subcontractorName || ''},`)}${p(`Please find attached FBN Load Confirmation <strong>${lc.loadConNumber}</strong>${route ? ` for <strong>${route}</strong>` : ''}${when ? `, collection ${when}` : ''}.`)}${p('Please <strong>confirm acceptance</strong> and reply with your <strong>driver name, vehicle registration and driver cell</strong>. POD to be returned on delivery.')}${p(`Regards,<br>${sender}<br>FBN Transport · tracking@fbn-transport.co.za`)}</div>`;
};

const TABS: { key: DocType; label: string }[] = [
    { key: 'loadcon', label: 'LoadCon → Subcontractor' },
    { key: 'clientOrder', label: 'Client Order → Client' },
    { key: 'deliveryNote', label: 'Delivery Note / POD' },
];

const LoadDocumentsModal: React.FC = () => {
    const { modal, showToast } = useUIState();
    const { currentUser } = useAuth();
    const { handleUpdateLoadConfirmation } = useOperations();
    const lc: LoadConfirmation | undefined = modal.payload?.loadCon;
    const [tab, setTab] = useState<DocType>('loadcon');
    const [sending, setSending] = useState(false);
    const [downloading, setDownloading] = useState(false);

    if (!lc) return <div className="p-4 bg-gray-800 text-white">No load selected.</div>;

    const recipientFor = (t: DocType) => t === 'clientOrder' ? lc.clientEmail : lc.subcontractorEmail;
    const docLabel = (t: DocType) => t === 'clientOrder' ? 'Client Order' : t === 'deliveryNote' ? 'Delivery Note' : 'Load Confirmation';

    // Download a clean, branded PDF of the current document (no print dialog).
    const handleDownload = async () => {
        setDownloading(true);
        try {
            const { doc, filename } = await buildLoadConPdf(lc, tab);
            doc.save(filename);
        } catch (e) {
            showToast(`Could not make the PDF: ${e instanceof Error ? e.message : 'error'}`);
        } finally {
            setDownloading(false);
        }
    };

    const handleEmail = async () => {
        // Always let the user confirm / change / add the recipient before sending
        // (and use this to resend). Pre-fill with whatever is on the load.
        const existing = recipientFor(tab) || '';
        const entered = window.prompt(`Email ${docLabel(tab)} ${lc.loadConNumber} to:`, existing);
        if (entered === null) return; // cancelled
        const to = entered.trim();
        if (!to) { showToast('No email entered.'); return; }
        // Remember a newly-entered / changed address on the load.
        if (to !== existing) {
            handleUpdateLoadConfirmation(lc.id, tab === 'clientOrder' ? { clientEmail: to } : { subcontractorEmail: to });
        }
        const collection = lc.collectionPoint || '';
        const delivery = lc.deliveryPoint || '';
        // Keep the subject plain ASCII — special chars (em-dash / arrow) get
        // mis-encoded by some mail stacks and break the whole email's headers.
        const subject = tab === 'clientOrder'
            ? `FBN Transport Order ${lc.loadConNumber} - ${collection} to ${delivery}`
            : tab === 'deliveryNote'
            ? `FBN Delivery Note ${lc.loadConNumber}`
            : `FBN Load Confirmation ${lc.loadConNumber} - ${collection} to ${delivery}`;
        setSending(true);
        try {
            // Attach the document as a proper PDF and keep the email body short and
            // branded — a wall of inline tables reads as spam to most mail clients.
            const { base64, filename } = await buildLoadConPdf(lc, tab);
            const sender = currentUser?.name || 'FBN Transport';
            const origin = typeof window !== 'undefined' ? window.location.origin : '';
            const base = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '';
            const label = docLabel(tab);
            // LoadCon -> carrier "Accept this load" link; Client Order -> client "Track" link.
            const cta = tab === 'loadcon'
                ? `<p style="text-align:center;margin:20px 0"><a href="${base}?accept=${lc.id}" style="background:#16a34a;color:#fff;text-decoration:none;font-weight:bold;padding:12px 26px;border-radius:8px;display:inline-block">Accept this load &amp; send driver details &rarr;</a></p>`
                : tab === 'clientOrder'
                ? `<p style="text-align:center;margin:20px 0"><a href="${base}?track=${lc.id}" style="background:${NAVY};color:#fff;text-decoration:none;font-weight:bold;padding:12px 26px;border-radius:8px;display:inline-block">Track this shipment &rarr;</a></p>`
                : '';
            const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;color:#1f2937">
              <div style="background:#ffffff;padding:14px 0;border-bottom:3px solid ${NAVY}"><img src="${origin}/fbn-logo.jpg" alt="FBN Transport" height="44" style="height:44px;display:block" /><div style="color:${GREY};font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-top:4px">Commercial Freight Specialists</div></div>
              <div style="height:4px;background:${YELLOW}"></div>
              <div style="padding:18px 2px">${coverNote(lc, tab, sender)}<p style="font-size:13px;color:${GREY};margin-top:6px">Your ${label} (Ref ${lc.loadConNumber}) is attached to this email as a PDF.</p>${cta}</div>
            </div>`;
            const { data, error } = await supabase.functions.invoke('send-email', {
                body: {
                    to,
                    cc: tab !== 'deliveryNote' ? (lc.ccEmail || undefined) : undefined,
                    subject,
                    html,
                    fromName: sender,
                    attachments: [{ filename, content: base64, contentType: 'application/pdf' }],
                },
            });
            if (error || (data && (data as any).error)) {
                showToast(`Email failed: ${(data as any)?.error || error?.message || 'unknown error'}`);
                return;
            }
            if (tab === 'loadcon') handleUpdateLoadConfirmation(lc.id, { sentToSupplierDate: new Date().toISOString() });
            showToast(`Sent to ${to} with the ${label} attached.`);
        } catch (e) {
            showToast(`Email failed: ${e instanceof Error ? e.message : 'unknown error'}`);
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="bg-gray-700">
            <div className="p-3 bg-gray-800 flex flex-wrap justify-between items-center gap-3 no-print">
                <div className="flex bg-gray-900/60 rounded-lg p-1">
                    {TABS.map(t => (
                        <button key={t.key} onClick={() => setTab(t.key)}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${tab === t.key ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                            {t.label}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-2">
                    {tab !== 'deliveryNote' && (
                        <button onClick={handleEmail} disabled={sending} className="flex items-center font-bold py-2 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm">
                            {sending ? 'Sending…' : tab === 'clientOrder' ? 'Email to Client' : 'Email to Subcontractor'}
                        </button>
                    )}
                    <button onClick={handleDownload} disabled={downloading} className="flex items-center font-bold py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm">
                        <PrinterIcon className="h-5 w-5 mr-2" /> {downloading ? 'Building PDF…' : 'Download PDF'}
                    </button>
                </div>
            </div>
            <div className="bg-gray-500 p-4">
                <DocView lc={lc} type={tab} />
            </div>
        </div>
    );
};

export default LoadDocumentsModal;
