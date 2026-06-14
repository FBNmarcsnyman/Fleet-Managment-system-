import React, { useState } from 'react';
import { LoadConfirmation } from '../../types';
import { useUIState } from '../../contexts/AppContexts';
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

const LoadDocumentsModal: React.FC = () => {
    const { modal } = useUIState();
    const lc: LoadConfirmation | undefined = modal.payload?.loadCon;
    const [tab, setTab] = useState<DocType>('loadcon');

    if (!lc) return <div className="p-4 bg-gray-800 text-white">No load selected.</div>;

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
                <button onClick={() => window.print()} className="flex items-center font-bold py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm">
                    <PrinterIcon className="h-5 w-5 mr-2" /> Print / Save PDF
                </button>
            </div>
            <div className="max-h-[78vh] overflow-y-auto bg-gray-500 p-4">
                <DocView lc={lc} type={tab} />
            </div>
        </div>
    );
};

export default LoadDocumentsModal;
