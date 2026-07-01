import React, { useState, useEffect } from 'react';
import { LoadConfirmation } from '../../types';
import { useUIState, useAuth, useOperations } from '../../contexts/AppContexts';
import { buildLoadConPdf } from '../../lib/loadconPdf';
import { sendLoadConToSupplier, sendOrderToClient } from '../../lib/loadEmails';
import { PrinterIcon } from '../icons/PrinterIcon';

type DocType = 'loadcon' | 'clientOrder' | 'deliveryNote';

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
        setSending(true);
        try {
            // Route through the ONE canonical sender in lib/loadEmails.ts so this modal's
            // email is byte-identical to the standard path — same branded shell + detail
            // table, plain-ASCII subject, COD/transit-depot warnings, the client/subbie
            // cc wall (dropAddrs), Drive filing, and the back-dated "upload POD" rule.
            // Never inline a duplicate email body here (see back-dated-loadcon-rule).
            const label = docLabel(tab);
            const res = tab === 'clientOrder'
                ? await sendOrderToClient(lc, to)
                : await sendLoadConToSupplier(lc, to);
            if (!res.ok) {
                showToast(`Email failed: ${res.error || 'unknown error'}`);
                return;
            }
            if (tab === 'loadcon') handleUpdateLoadConfirmation(lc.id, { sentToSupplierDate: new Date().toISOString() });
            showToast(`Sent to ${to} with the ${label} attached.${res.pdfFailed ? ' (PDF could not be attached.)' : ''}`);
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
