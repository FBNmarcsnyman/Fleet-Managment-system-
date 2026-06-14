import React, { useState } from 'react';
import { LoadConfirmation } from '../../types';
import { useUIState, useAuth, useOperations } from '../../contexts/AppContexts';
import { supabase } from '../../lib/supabase';
import { PrinterIcon } from '../icons/PrinterIcon';
import { FuelIcon } from '../icons/FuelIcon';

type DocType = 'loadcon' | 'clientOrder' | 'deliveryNote';

const rand = (n?: number) => `R ${(n || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d?: string) => {
    if (!d) return '';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
};

const Row: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) =>
    value ? (
        <div className="flex text-sm py-0.5">
            <span className="w-40 shrink-0 text-gray-500 font-semibold">{label}</span>
            <span className="text-gray-900">{value}</span>
        </div>
    ) : null;

const Box: React.FC<{ title: string; accent: string; children: React.ReactNode }> = ({ title, accent, children }) => (
    <div className="border border-gray-300 rounded-lg overflow-hidden">
        <div className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider text-white ${accent}`}>{title}</div>
        <div className="p-3">{children}</div>
    </div>
);

// Renders ONE of the three transport documents from a load. Margin rule:
// - LoadCon (to subcontractor): shows the TRANSPORT rate, never the client/client rate.
// - Client Order (to client): shows the CLIENT rate, never the subcontractor/transport rate.
// - Delivery Note / POD: no rates at all (for the driver to get signed).
const DocView: React.FC<{ lc: LoadConfirmation; type: DocType }> = ({ lc, type }) => {
    const title = type === 'loadcon' ? 'LOAD CONFIRMATION' : type === 'clientOrder' ? 'CLIENT ORDER' : 'DELIVERY NOTE / POD';
    const titleColor = type === 'loadcon' ? 'text-amber-700' : type === 'clientOrder' ? 'text-blue-700' : 'text-gray-700';
    const ref = lc.loadConNumber + (type === 'clientOrder' ? '-C' : type === 'deliveryNote' ? '-DN' : '');

    return (
        <div className="printable-document bg-white text-gray-900 p-8 mx-auto" style={{ maxWidth: '210mm' }}>
            <header className="flex justify-between items-start pb-4 border-b-2 border-gray-800">
                <div className="flex items-center gap-3">
                    <FuelIcon className="h-12 w-12 text-blue-700" />
                    <div>
                        <h1 className="text-2xl font-black leading-none">FBN Transport</h1>
                        <p className="text-xs text-gray-500 mt-1">Nationwide Transport & Logistics</p>
                    </div>
                </div>
                <div className="text-right">
                    <h2 className={`text-2xl font-black ${titleColor}`}>{title}</h2>
                    <p className="mt-1 text-sm"><strong>Ref:</strong> {ref}</p>
                    <p className="text-sm"><strong>Date:</strong> {fmtDate(lc.date) || fmtDate(new Date().toISOString())}</p>
                    {lc.loadRefNo && <p className="text-sm"><strong>Load Ref:</strong> {lc.loadRefNo}</p>}
                </div>
            </header>

            <div className="grid grid-cols-2 gap-4 my-4">
                {/* Party box differs per document */}
                {type === 'loadcon' && (
                    <Box title="To Subcontractor" accent="bg-amber-600">
                        <Row label="Company" value={<strong>{lc.subcontractorName}</strong>} />
                        <Row label="For Attention" value={lc.forAttention} />
                        <Row label="Email" value={lc.subcontractorEmail} />
                        <Row label="Vehicle / Driver" value={lc.subcontractorDriverName} />
                        <Row label="Driver Cell" value={lc.subcontractorDriverCell} />
                        <Row label="Vehicle Reg" value={lc.subcontractorVehicleReg} />
                    </Box>
                )}
                {type === 'clientOrder' && (
                    <Box title="Client" accent="bg-blue-600">
                        <Row label="Company" value={<strong>{lc.clientName}</strong>} />
                        <Row label="For Attention" value={lc.clientContact} />
                        <Row label="Email" value={lc.clientEmail} />
                        <Row label="Customer Order #" value={lc.customerOrderNumber} />
                    </Box>
                )}
                {type === 'deliveryNote' && (
                    <Box title="Consignment" accent="bg-gray-700">
                        <Row label="Load Ref" value={ref} />
                        <Row label="Customer Order #" value={lc.customerOrderNumber} />
                        <Row label="Carrier" value={lc.subcontractorName} />
                        <Row label="Vehicle / Driver" value={lc.subcontractorDriverName} />
                    </Box>
                )}

                <Box title="Route" accent="bg-gray-700">
                    <Row label="FBN Branch" value={lc.arrangingBranch} />
                    <Row label="FBN Rep" value={lc.fbnRepresentative} />
                    <Row label="Route" value={lc.route} />
                    <Row label="Priority" value={lc.priority} />
                </Box>

                <Box title="Collection" accent="bg-emerald-700">
                    <Row label="Address" value={lc.collectionPoint} />
                    <Row label="Date" value={fmtDate(lc.collectionDate)} />
                    <Row label="Time" value={lc.loadingTime} />
                    <Row label="Contact" value={lc.collectionContact} />
                    <Row label="Tel" value={lc.collectionTelephone} />
                </Box>

                <Box title="Delivery" accent="bg-rose-700">
                    <Row label="Address" value={lc.deliveryPoint} />
                    <Row label="Date" value={fmtDate(lc.deliveryDate)} />
                    <Row label="Time" value={lc.offloadingTime} />
                    <Row label="Contact" value={lc.deliveryContact} />
                    <Row label="Tel" value={lc.deliveryTelephone} />
                </Box>
            </div>

            <Box title="Cargo" accent="bg-gray-700">
                <div className="grid grid-cols-2 gap-x-6">
                    <Row label="Load Type" value={lc.loadType} />
                    <Row label="Commodity" value={lc.commodity} />
                    <Row label="Packaging" value={lc.packaging} />
                    <Row label="Quantity" value={lc.quantity} />
                    <Row label="Weight (kg)" value={lc.weightKg} />
                    <Row label="Volume" value={lc.volume} />
                    {type !== 'deliveryNote' && <Row label="Cargo Value" value={lc.cargoValue} />}
                    <Row label="Container #" value={lc.containerNo} />
                </div>
                {lc.equipmentRequired?.length ? <Row label="Equipment" value={lc.equipmentRequired.join(', ')} /> : null}
                {lc.specialInstructions ? <Row label="Instructions" value={lc.specialInstructions} /> : null}
            </Box>

            {/* Rate — only the side that's allowed to see it */}
            {type === 'loadcon' && (
                <div className="mt-4 flex justify-end">
                    <div className="border-2 border-amber-600 rounded-lg px-6 py-3 text-right">
                        <p className="text-xs font-bold uppercase tracking-wider text-amber-700">Agreed Transport Rate (excl. VAT)</p>
                        <p className="text-3xl font-black font-mono">{rand(lc.supplierRate)}</p>
                    </div>
                </div>
            )}
            {type === 'clientOrder' && (
                <div className="mt-4 flex justify-end">
                    <div className="border-2 border-blue-600 rounded-lg px-6 py-3 text-right">
                        <p className="text-xs font-bold uppercase tracking-wider text-blue-700">Agreed Rate (excl. VAT)</p>
                        <p className="text-3xl font-black font-mono">{rand(lc.totalAmount)}</p>
                    </div>
                </div>
            )}

            {/* POD signature block — delivery note only */}
            {type === 'deliveryNote' && (
                <div className="mt-8 grid grid-cols-2 gap-8">
                    <div>
                        <p className="text-sm font-semibold text-gray-600 mb-8">Received in good order by:</p>
                        <div className="border-t border-gray-400 pt-1 text-xs text-gray-500">Name & Signature</div>
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-gray-600 mb-8">Date / Time:</p>
                        <div className="border-t border-gray-400 pt-1 text-xs text-gray-500">Date received</div>
                    </div>
                    <div className="col-span-2 mt-2">
                        <p className="text-xs text-gray-500">Any shortages, damages or remarks:</p>
                        <div className="h-16 border border-gray-300 rounded mt-1" />
                    </div>
                </div>
            )}

            <footer className="mt-8 pt-3 border-t text-center text-[10px] text-gray-400">
                FBN Transport · This document was generated by the FBN Fleet system.
                {type === 'loadcon' && ' Rate shown is the agreed subcontractor buy-rate and is confidential.'}
                {type === 'clientOrder' && ' Rate shown is the agreed client sell-rate.'}
            </footer>
        </div>
    );
};

const TABS: { key: DocType; label: string }[] = [
    { key: 'loadcon', label: 'LoadCon → Subcontractor' },
    { key: 'clientOrder', label: 'Client Order → Client' },
    { key: 'deliveryNote', label: 'Delivery Note / POD' },
];

// Build an email-safe HTML version of a document (inline styles, table layout).
const buildEmailHtml = (lc: LoadConfirmation, type: DocType): string => {
    const title = type === 'loadcon' ? 'LOAD CONFIRMATION' : type === 'clientOrder' ? 'CLIENT ORDER' : 'DELIVERY NOTE / POD';
    const ref = lc.loadConNumber + (type === 'clientOrder' ? '-C' : type === 'deliveryNote' ? '-DN' : '');
    const row = (l: string, v?: string) => (v ? `<tr><td style="padding:2px 10px 2px 0;color:#6b7280;font-weight:600;white-space:nowrap">${l}</td><td style="padding:2px 0;color:#111827">${v}</td></tr>` : '');
    const block = (heading: string, rows: string) => `<div style="margin:0 0 14px"><div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#374151;margin-bottom:4px">${heading}</div><table style="border-collapse:collapse;font-size:13px">${rows}</table></div>`;

    const party = type === 'loadcon'
        ? block('To Subcontractor', row('Company', `<strong>${lc.subcontractorName || ''}</strong>`) + row('For Attention', lc.forAttention) + row('Email', lc.subcontractorEmail) + row('Driver', lc.subcontractorDriverName) + row('Driver Cell', lc.subcontractorDriverCell) + row('Vehicle Reg', lc.subcontractorVehicleReg))
        : type === 'clientOrder'
        ? block('Client', row('Company', `<strong>${lc.clientName || ''}</strong>`) + row('For Attention', lc.clientContact) + row('Email', lc.clientEmail) + row('Customer Order #', lc.customerOrderNumber))
        : block('Consignment', row('Load Ref', ref) + row('Carrier', lc.subcontractorName) + row('Driver', lc.subcontractorDriverName));

    const route = block('Route', row('FBN Branch', lc.arrangingBranch) + row('FBN Rep', lc.fbnRepresentative) + row('Route', lc.route) + row('Priority', lc.priority));
    const collection = block('Collection', row('Address', lc.collectionPoint) + row('Date', fmtDate(lc.collectionDate)) + row('Time', lc.loadingTime) + row('Contact', lc.collectionContact) + row('Tel', lc.collectionTelephone));
    const delivery = block('Delivery', row('Address', lc.deliveryPoint) + row('Date', fmtDate(lc.deliveryDate)) + row('Time', lc.offloadingTime) + row('Contact', lc.deliveryContact) + row('Tel', lc.deliveryTelephone));
    const cargo = block('Cargo', row('Load Type', lc.loadType) + row('Commodity', lc.commodity) + row('Packaging', lc.packaging) + row('Quantity', lc.quantity) + row('Weight (kg)', lc.weightKg) + row('Volume', lc.volume) + (lc.equipmentRequired?.length ? row('Equipment', lc.equipmentRequired.join(', ')) : '') + (lc.specialInstructions ? row('Instructions', lc.specialInstructions) : ''));

    const rate = type === 'loadcon'
        ? `<div style="margin-top:8px;padding:10px;border:2px solid #d97706;border-radius:8px;text-align:right"><div style="font-size:11px;font-weight:800;text-transform:uppercase;color:#b45309">Agreed Transport Rate (excl. VAT)</div><div style="font-size:22px;font-weight:800">${rand(lc.supplierRate)}</div></div>`
        : type === 'clientOrder'
        ? `<div style="margin-top:8px;padding:10px;border:2px solid #2563eb;border-radius:8px;text-align:right"><div style="font-size:11px;font-weight:800;text-transform:uppercase;color:#1d4ed8">Agreed Rate (excl. VAT)</div><div style="font-size:22px;font-weight:800">${rand(lc.totalAmount)}</div></div>`
        : '';

    return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;color:#111827">
      <div style="display:flex;justify-content:space-between;border-bottom:2px solid #111827;padding-bottom:8px;margin-bottom:14px">
        <div><div style="font-size:20px;font-weight:800">FBN Transport</div><div style="font-size:11px;color:#6b7280">Nationwide Transport &amp; Logistics</div></div>
        <div style="text-align:right"><div style="font-size:18px;font-weight:800">${title}</div><div style="font-size:12px">Ref: ${ref}</div><div style="font-size:12px">Date: ${fmtDate(lc.date) || fmtDate(new Date().toISOString())}</div></div>
      </div>
      ${party}${route}${collection}${delivery}${cargo}${rate}
      <div style="margin-top:16px;padding-top:8px;border-top:1px solid #e5e7eb;font-size:10px;color:#9ca3af">FBN Transport · Generated by the FBN Fleet system.${type === 'loadcon' ? ' Rate shown is the confidential subcontractor buy-rate.' : ''}</div>
    </div>`;
};

const LoadDocumentsModal: React.FC = () => {
    const { modal, showToast } = useUIState();
    const { currentUser } = useAuth();
    const { handleUpdateLoadConfirmation } = useOperations();
    const lc: LoadConfirmation | undefined = modal.payload?.loadCon;
    const [tab, setTab] = useState<DocType>('loadcon');
    const [sending, setSending] = useState(false);

    if (!lc) return <div className="p-4 bg-gray-800 text-white">No load selected.</div>;

    const recipientFor = (t: DocType) => t === 'clientOrder' ? lc.clientEmail : lc.subcontractorEmail;

    const handleEmail = async () => {
        const to = recipientFor(tab);
        if (!to) {
            showToast(tab === 'clientOrder' ? 'No client email on this load — add one first.' : 'No subcontractor email on this load — add one first.');
            return;
        }
        const collection = lc.collectionPoint || '';
        const delivery = lc.deliveryPoint || '';
        const subject = tab === 'clientOrder'
            ? `FBN Client Order ${lc.loadConNumber} — ${collection} → ${delivery}`
            : tab === 'deliveryNote'
            ? `FBN Delivery Note ${lc.loadConNumber}`
            : `FBN Load Confirmation ${lc.loadConNumber} — ${collection} → ${delivery}`;
        setSending(true);
        try {
            const { data, error } = await supabase.functions.invoke('send-email', {
                body: {
                    to,
                    cc: tab === 'loadcon' ? (lc.ccEmail || undefined) : undefined,
                    subject,
                    html: buildEmailHtml(lc, tab),
                    fromName: currentUser?.name || 'FBN Transport',
                },
            });
            if (error || (data && (data as any).error)) {
                showToast(`Email failed: ${(data as any)?.error || error?.message || 'unknown error'}`);
                return;
            }
            if (tab === 'loadcon') {
                handleUpdateLoadConfirmation(lc.id, { sentToSupplierDate: new Date().toISOString() });
            }
            showToast(`Sent to ${to}.`);
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
                    <button onClick={() => window.print()} className="flex items-center font-bold py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm">
                        <PrinterIcon className="h-5 w-5 mr-2" /> Print / Save PDF
                    </button>
                </div>
            </div>
            <div className="max-h-[78vh] overflow-y-auto bg-gray-500 p-4">
                <DocView lc={lc} type={tab} />
            </div>
        </div>
    );
};

export default LoadDocumentsModal;
