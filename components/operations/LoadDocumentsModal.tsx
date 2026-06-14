import React, { useState } from 'react';
import { LoadConfirmation } from '../../types';
import { useUIState, useAuth, useOperations } from '../../contexts/AppContexts';
import { supabase } from '../../lib/supabase';
import { PrinterIcon } from '../icons/PrinterIcon';

type DocType = 'loadcon' | 'clientOrder' | 'deliveryNote';

// FBN brand palette
const NAVY = '#13294b';
const YELLOW = '#f5b700';
const GREY = '#5b6573';
const LINE = '#d7dde3';

const rand = (n?: number) => `R ${(n || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d?: string) => {
    if (!d) return '';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
};

const Row: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) =>
    value ? (
        <div style={{ display: 'flex', fontSize: '13px', padding: '2px 0' }}>
            <span style={{ width: '120px', flexShrink: 0, color: GREY, fontWeight: 600 }}>{label}</span>
            <span style={{ color: '#1f2937' }}>{value}</span>
        </div>
    ) : null;

const Box: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div style={{ border: `1px solid ${LINE}`, borderRadius: '8px', overflow: 'hidden' }}>
        <div style={{ background: NAVY, color: '#fff', fontSize: '10.5px', fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase', padding: '6px 12px' }}>{title}</div>
        <div style={{ padding: '8px 12px' }}>{children}</div>
    </div>
);

// Renders ONE of the three transport documents. Margin rule:
// - LoadCon (to subbie): shows the TRANSPORT rate, never client/ client rate.
// - Client Order (to client): shows the CLIENT rate, never subbie/transport rate.
// - Delivery Note / POD: no rates at all.
const DocView: React.FC<{ lc: LoadConfirmation; type: DocType }> = ({ lc, type }) => {
    const title = type === 'loadcon' ? 'LOAD CONFIRMATION' : type === 'clientOrder' ? 'CLIENT ORDER' : 'DELIVERY NOTE / POD';
    const ref = lc.loadConNumber + (type === 'clientOrder' ? '-C' : type === 'deliveryNote' ? '-DN' : '');

    return (
        <div className="printable-document" style={{ maxWidth: '210mm', margin: '0 auto', background: '#fff', color: '#1f2937', fontFamily: 'Arial, Helvetica, sans-serif' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', padding: '24px 28px 14px', borderBottom: `3px solid ${NAVY}` }}>
                <div>
                    <img src="/fbn-logo.png" alt="FBN Transport" onError={(e) => { const t = e.currentTarget as HTMLImageElement; if (!t.src.endsWith('.svg')) t.src = '/fbn-logo.svg'; }} style={{ height: '64px', display: 'block' }} />
                    <div style={{ fontSize: '9.5px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: GREY, marginTop: '4px' }}>Commercial Freight Specialists</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '22px', fontWeight: 800, color: NAVY, letterSpacing: '0.5px' }}>{title}</div>
                    <div style={{ height: '3px', width: '96px', background: YELLOW, marginLeft: 'auto', marginTop: '5px' }} />
                    <div style={{ marginTop: '8px', fontSize: '12px', color: GREY }}><strong style={{ color: NAVY }}>Ref:</strong> {ref}</div>
                    <div style={{ fontSize: '12px', color: GREY }}><strong style={{ color: NAVY }}>Date:</strong> {fmtDate(lc.date) || fmtDate(new Date().toISOString())}</div>
                    {lc.loadRefNo && <div style={{ fontSize: '12px', color: GREY }}><strong style={{ color: NAVY }}>Load Ref:</strong> {lc.loadRefNo}</div>}
                </div>
            </div>
            <div style={{ height: '4px', background: YELLOW }} />

            <div style={{ padding: '18px 28px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    {type === 'loadcon' && (
                        <Box title="To Subcontractor">
                            <Row label="Company" value={<strong>{lc.subcontractorName}</strong>} />
                            <Row label="For Attention" value={lc.forAttention} />
                            <Row label="Email" value={lc.subcontractorEmail} />
                            <Row label="Vehicle / Driver" value={lc.subcontractorDriverName} />
                            <Row label="Driver Cell" value={lc.subcontractorDriverCell} />
                            <Row label="Vehicle Reg" value={lc.subcontractorVehicleReg} />
                        </Box>
                    )}
                    {type === 'clientOrder' && (
                        <Box title="Client">
                            <Row label="Company" value={<strong>{lc.clientName}</strong>} />
                            <Row label="For Attention" value={lc.clientContact} />
                            <Row label="Email" value={lc.clientEmail} />
                            <Row label="Customer Order #" value={lc.customerOrderNumber} />
                        </Box>
                    )}
                    {type === 'deliveryNote' && (
                        <Box title="Consignment">
                            <Row label="Load Ref" value={ref} />
                            <Row label="Customer Order #" value={lc.customerOrderNumber} />
                            <Row label="Carrier" value={lc.subcontractorName} />
                            <Row label="Vehicle / Driver" value={lc.subcontractorDriverName} />
                        </Box>
                    )}

                    <Box title="Route">
                        <Row label="FBN Branch" value={lc.arrangingBranch} />
                        <Row label="FBN Rep" value={lc.fbnRepresentative} />
                        <Row label="Route" value={lc.route} />
                        <Row label="Priority" value={lc.priority} />
                    </Box>

                    <Box title="Collection">
                        <Row label="Address" value={lc.collectionPoint} />
                        <Row label="Date" value={fmtDate(lc.collectionDate)} />
                        <Row label="Time" value={lc.loadingTime} />
                        <Row label="Contact" value={lc.collectionContact} />
                        <Row label="Tel" value={lc.collectionTelephone} />
                    </Box>

                    <Box title="Delivery">
                        <Row label="Address" value={lc.deliveryPoint} />
                        <Row label="Date" value={fmtDate(lc.deliveryDate)} />
                        <Row label="Time" value={lc.offloadingTime} />
                        <Row label="Contact" value={lc.deliveryContact} />
                        <Row label="Tel" value={lc.deliveryTelephone} />
                    </Box>
                </div>

                <div style={{ marginTop: '12px' }}>
                    <Box title="Cargo">
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: '24px' }}>
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
                </div>

                {/* Rate — only the side allowed to see it */}
                {(type === 'loadcon' || type === 'clientOrder') && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px' }}>
                        <div style={{ background: NAVY, borderRadius: '8px', padding: '12px 24px', textAlign: 'right', minWidth: '240px' }}>
                            <div style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase', color: YELLOW }}>
                                {type === 'loadcon' ? 'Agreed Transport Rate (excl. VAT)' : 'Agreed Rate (excl. VAT)'}
                            </div>
                            <div style={{ fontSize: '26px', fontWeight: 800, color: '#fff' }}>{rand(type === 'loadcon' ? lc.supplierRate : lc.totalAmount)}</div>
                        </div>
                    </div>
                )}

                {/* POD signature block */}
                {type === 'deliveryNote' && (
                    <div style={{ marginTop: '28px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px' }}>
                        <div>
                            <p style={{ fontSize: '13px', fontWeight: 600, color: GREY, marginBottom: '34px' }}>Received in good order by:</p>
                            <div style={{ borderTop: `1px solid ${NAVY}`, paddingTop: '4px', fontSize: '11px', color: GREY }}>Name &amp; Signature</div>
                        </div>
                        <div>
                            <p style={{ fontSize: '13px', fontWeight: 600, color: GREY, marginBottom: '34px' }}>Date / Time:</p>
                            <div style={{ borderTop: `1px solid ${NAVY}`, paddingTop: '4px', fontSize: '11px', color: GREY }}>Date received</div>
                        </div>
                        <div style={{ gridColumn: 'span 2' }}>
                            <p style={{ fontSize: '11px', color: GREY }}>Shortages, damages or remarks:</p>
                            <div style={{ height: '64px', border: `1px solid ${LINE}`, borderRadius: '6px', marginTop: '4px' }} />
                        </div>
                    </div>
                )}

                <div style={{ marginTop: '22px', paddingTop: '10px', borderTop: `1px solid ${LINE}`, textAlign: 'center', fontSize: '10px', color: '#9aa3af' }}>
                    FBN Transport · Commercial Freight Specialists · tracking@fbn-transport.co.za
                    {type === 'loadcon' && ' · Rate shown is the confidential subcontractor buy-rate.'}
                </div>
            </div>
        </div>
    );
};

// Email-safe HTML version (inline styles, table layout, navy/grey/yellow).
const buildEmailHtml = (lc: LoadConfirmation, type: DocType): string => {
    const title = type === 'loadcon' ? 'LOAD CONFIRMATION' : type === 'clientOrder' ? 'CLIENT ORDER' : 'DELIVERY NOTE / POD';
    const ref = lc.loadConNumber + (type === 'clientOrder' ? '-C' : type === 'deliveryNote' ? '-DN' : '');
    const row = (l: string, v?: string) => (v ? `<tr><td style="padding:2px 10px 2px 0;color:${GREY};font-weight:600;white-space:nowrap;font-size:13px">${l}</td><td style="padding:2px 0;color:#1f2937;font-size:13px">${v}</td></tr>` : '');
    const block = (heading: string, rows: string) => `<div style="border:1px solid ${LINE};border-radius:8px;overflow:hidden;margin:0 0 12px"><div style="background:${NAVY};color:#fff;font-size:10.5px;font-weight:800;letter-spacing:1px;text-transform:uppercase;padding:6px 12px">${heading}</div><table style="border-collapse:collapse;padding:8px 12px;width:100%"><tbody>${rows}</tbody></table></div>`;

    const party = type === 'loadcon'
        ? block('To Subcontractor', row('Company', `<strong>${lc.subcontractorName || ''}</strong>`) + row('For Attention', lc.forAttention) + row('Email', lc.subcontractorEmail) + row('Driver', lc.subcontractorDriverName) + row('Driver Cell', lc.subcontractorDriverCell) + row('Vehicle Reg', lc.subcontractorVehicleReg))
        : type === 'clientOrder'
        ? block('Client', row('Company', `<strong>${lc.clientName || ''}</strong>`) + row('For Attention', lc.clientContact) + row('Email', lc.clientEmail) + row('Customer Order #', lc.customerOrderNumber))
        : block('Consignment', row('Load Ref', ref) + row('Carrier', lc.subcontractorName) + row('Driver', lc.subcontractorDriverName));

    const route = block('Route', row('FBN Branch', lc.arrangingBranch) + row('FBN Rep', lc.fbnRepresentative) + row('Route', lc.route) + row('Priority', lc.priority));
    const collection = block('Collection', row('Address', lc.collectionPoint) + row('Date', fmtDate(lc.collectionDate)) + row('Time', lc.loadingTime) + row('Contact', lc.collectionContact) + row('Tel', lc.collectionTelephone));
    const delivery = block('Delivery', row('Address', lc.deliveryPoint) + row('Date', fmtDate(lc.deliveryDate)) + row('Time', lc.offloadingTime) + row('Contact', lc.deliveryContact) + row('Tel', lc.deliveryTelephone));
    const cargo = block('Cargo', row('Load Type', lc.loadType) + row('Commodity', lc.commodity) + row('Packaging', lc.packaging) + row('Quantity', lc.quantity) + row('Weight (kg)', lc.weightKg) + row('Volume', lc.volume) + (lc.equipmentRequired?.length ? row('Equipment', lc.equipmentRequired.join(', ')) : '') + (lc.specialInstructions ? row('Instructions', lc.specialInstructions) : ''));

    const rate = (type === 'loadcon' || type === 'clientOrder')
        ? `<div style="margin-top:8px;text-align:right"><div style="display:inline-block;background:${NAVY};border-radius:8px;padding:10px 22px;text-align:right"><div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:${YELLOW}">${type === 'loadcon' ? 'Agreed Transport Rate (excl. VAT)' : 'Agreed Rate (excl. VAT)'}</div><div style="font-size:22px;font-weight:800;color:#fff">${rand(type === 'loadcon' ? lc.supplierRate : lc.totalAmount)}</div></div></div>`
        : '';

    return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:660px;color:#1f2937;border:1px solid ${LINE};border-radius:10px;overflow:hidden">
      <div style="background:${NAVY};padding:16px 22px">
        <span style="color:#fff;font-weight:900;font-style:italic;font-size:26px">FBN</span><span style="color:#c4ccd4;font-weight:700;font-style:italic;font-size:20px"> transport</span>
        <span style="color:${YELLOW};font-weight:800;font-size:15px;text-transform:uppercase;float:right;padding-top:8px">${title}</span>
        <div style="color:#9aa9bd;font-size:9.5px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-top:2px">Commercial Freight Specialists</div>
      </div>
      <div style="height:4px;background:${YELLOW}"></div>
      <div style="padding:18px 22px">
        <p style="font-size:12px;color:${GREY};margin:0 0 14px"><strong style="color:${NAVY}">Ref:</strong> ${ref} &nbsp;·&nbsp; <strong style="color:${NAVY}">Date:</strong> ${fmtDate(lc.date) || fmtDate(new Date().toISOString())}</p>
        ${party}${route}${collection}${delivery}${cargo}${rate}
        <div style="margin-top:16px;padding-top:8px;border-top:1px solid ${LINE};font-size:10px;color:#9aa3af">FBN Transport · Commercial Freight Specialists · tracking@fbn-transport.co.za${type === 'loadcon' ? ' · Rate shown is the confidential subcontractor buy-rate.' : ''}</div>
      </div>
    </div>`;
};

// A short covering message above the document in the email.
const coverNote = (lc: LoadConfirmation, type: DocType, sender: string): string => {
    const route = `${lc.collectionPoint || ''}${lc.deliveryPoint ? ' → ' + lc.deliveryPoint : ''}`;
    const when = fmtDate(lc.collectionDate);
    const p = (s: string) => `<p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1f2937;margin:0 0 10px">${s}</p>`;
    if (type === 'clientOrder') {
        return `<div style="margin-bottom:18px">${p(`Good day ${lc.clientContact || lc.clientName || ''},`)}${p(`Please find your FBN Client Order <strong>${lc.loadConNumber}</strong>${route ? ` for <strong>${route}</strong>` : ''}${when ? `, collection ${when}` : ''}.`)}${p('Kindly confirm and reply with your order number if not already supplied.')}${p(`Regards,<br>${sender}<br>FBN Transport · tracking@fbn-transport.co.za`)}</div>`;
    }
    return `<div style="margin-bottom:18px">${p(`Good day ${lc.forAttention || lc.subcontractorName || ''},`)}${p(`Please find FBN Load Confirmation <strong>${lc.loadConNumber}</strong>${route ? ` for <strong>${route}</strong>` : ''}${when ? `, collection ${when}` : ''} below.`)}${p('Please <strong>confirm acceptance</strong> and reply with your <strong>driver name, vehicle registration and driver cell</strong>. POD to be returned on delivery.')}${p(`Regards,<br>${sender}<br>FBN Transport · tracking@fbn-transport.co.za`)}</div>`;
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
                    html: coverNote(lc, tab, currentUser?.name || 'FBN Transport') + buildEmailHtml(lc, tab),
                    fromName: currentUser?.name || 'FBN Transport',
                },
            });
            if (error || (data && (data as any).error)) {
                showToast(`Email failed: ${(data as any)?.error || error?.message || 'unknown error'}`);
                return;
            }
            if (tab === 'loadcon') handleUpdateLoadConfirmation(lc.id, { sentToSupplierDate: new Date().toISOString() });
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
