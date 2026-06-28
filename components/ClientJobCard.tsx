import React, { useState } from 'react';
import { LoadConfirmation, LoadConfirmationStatus } from '../types';
import Modal from './Modal';

interface ClientJobCardProps {
    loadConfirmation: LoadConfirmation;
}

const STATUS_STEPS: LoadConfirmationStatus[] = ['Booked', 'Collected', 'In Transit', 'Out for Delivery', 'Delivered', 'POD Submitted'];
const STEP_LABEL: Record<string, string> = { Booked: 'Booked', Collected: 'Collected', 'In Transit': 'In transit', 'Out for Delivery': 'Out for delivery', Delivered: 'Delivered', 'POD Submitted': 'POD in' };
const fmt = (d?: string) => { if (!d) return ''; const t = new Date(d); return isNaN(t.getTime()) ? String(d) : t.toLocaleString('en-ZA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); };

const ClientJobCard: React.FC<ClientJobCardProps> = ({ loadConfirmation: lc }) => {
    const [podOpen, setPodOpen] = useState(false);

    const simpleStatus = (status: LoadConfirmationStatus): LoadConfirmationStatus => {
        if (['Driver Assigned', 'At Collection Point', 'Loading'].includes(status)) return 'Booked';
        if (['At Collection Depot', 'At Destination Depot', 'Unloaded'].includes(status)) return 'In Transit';
        if (status === 'Invoiced') return 'POD Submitted';
        return status;
    };
    const current = simpleStatus(lc.status);
    const idx = STATUS_STEPS.indexOf(current);

    const a: any = lc;
    const driver = a.subcontractorDriverName || a.driverId || '';
    const vehicle = a.subcontractorVehicleReg || '';
    const cell = a.subcontractorDriverCell || '';
    const eta = a.deliveryEta || a.eta || a.loadingEta || '';
    const exception = a.damageReport || a.delayReason || '';
    const podUrl = a.podDriveUrl || (Array.isArray(a.podDocUrls) && a.podDocUrls[0]) || a.podPhoto?.data || '';

    return (
        <>
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-2">
                    <div className="min-w-0">
                        <p className="font-bold text-slate-900">{lc.collectionPoint} → {lc.deliveryPoint}</p>
                        <p className="text-xs text-slate-500 font-mono">{lc.loadConNumber}{lc.customerOrderNumber ? ` · Your ref: ${lc.customerOrderNumber}` : ''}</p>
                    </div>
                    {podUrl && (
                        <a href={podUrl} target="_blank" rel="noreferrer" download className="shrink-0 bg-[#13294b] hover:bg-[#1d3a66] text-white font-bold py-1.5 px-3 rounded-lg text-xs">⬇ Download POD</a>
                    )}
                </div>

                {/* Timeline */}
                <div className="mt-4">
                    <div className="flex items-center gap-1">
                        {STATUS_STEPS.map((step, i) => (
                            <div key={step} className={`flex-1 h-1.5 rounded-full ${i <= idx ? 'bg-[#13294b]' : 'bg-slate-200'}`} title={STEP_LABEL[step]} />
                        ))}
                    </div>
                    <div className="flex justify-between mt-1"><p className="text-[11px] font-bold text-[#13294b]">{STEP_LABEL[current] || current}</p>{eta && <p className="text-[11px] text-slate-500">ETA: {fmt(eta)}</p>}</div>
                </div>

                {/* Vehicle / driver */}
                {(driver || vehicle || cell) && (
                    <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-[12px]">
                        <div><span className="block text-[10px] font-bold text-slate-400 uppercase">Vehicle</span><span className="text-slate-700">{vehicle || '—'}</span></div>
                        <div><span className="block text-[10px] font-bold text-slate-400 uppercase">Driver</span><span className="text-slate-700">{driver || '—'}</span></div>
                        <div><span className="block text-[10px] font-bold text-slate-400 uppercase">Contact</span><span className="text-slate-700">{cell || '—'}</span></div>
                    </div>
                )}

                {/* Exception */}
                {exception && (
                    <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                        <span className="text-amber-600">⚠</span>
                        <p className="text-[12px] text-amber-700 font-semibold">{exception}</p>
                    </div>
                )}
            </div>

            {podOpen && (
                <Modal isOpen={podOpen} onClose={() => setPodOpen(false)} size="2xl">
                    <h3 className="text-xl font-bold text-slate-900 mb-4">Proof of Delivery — {lc.loadConNumber}</h3>
                    {a.podPhoto && <img src={a.podPhoto.data} alt="POD" className="w-full h-auto rounded-lg border border-slate-200" />}
                </Modal>
            )}
        </>
    );
};

export default ClientJobCard;
