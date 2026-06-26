import React from 'react';
import type { WaybillEvent } from '../../types';

const STAGE_LABEL: Record<string, string> = {
    collection: 'Collection', origin_depot_grn: 'Origin depot — GRN', linehaul_load: 'Linehaul loaded',
    dest_depot_grn: 'Destination depot — GRN', delivery: 'Delivery', pod: 'POD', other: 'Other',
};
const when = (s?: string) => { if (!s) return ''; const d = new Date(s); return isNaN(d.getTime()) ? '' : d.toLocaleString('en-ZA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); };

// Read-only journey log for one waybill: every verification checkpoint with its
// package count, condition and photos, newest first. The shared "media timeline".
const WaybillTimeline: React.FC<{ events: WaybillEvent[] }> = ({ events }) => {
    if (!events?.length) return <p className="text-xs text-gray-500">No cargo checks logged yet.</p>;
    const sorted = [...events].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return (
        <div className="space-y-2">
            {sorted.map(ev => {
                const mismatch = ev.packagesExpected != null && ev.packagesActual != null && ev.packagesExpected !== ev.packagesActual;
                const bad = !!ev.damageFlag || mismatch;
                return (
                    <div key={ev.id} className={`rounded-lg border p-3 ${bad ? 'border-red-500/40 bg-red-500/5' : 'border-gray-700/50 bg-gray-900/30'}`}>
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-[11px] font-black uppercase tracking-wider text-gray-200">{STAGE_LABEL[ev.stage] || ev.stage}</span>
                            <span className="text-[10px] text-gray-500">{when(ev.createdAt)}{ev.createdByName ? ` · ${ev.createdByName}` : ''}</span>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-gray-300">
                            {(ev.packagesExpected != null || ev.packagesActual != null) && <span className={mismatch ? 'text-red-400 font-bold' : ''}>Packages: {ev.packagesActual ?? '?'}{ev.packagesExpected != null ? ` / ${ev.packagesExpected}` : ''}{mismatch ? ' ⚠' : ''}</span>}
                            {ev.weightKg != null && <span>{ev.weightKg} kg</span>}
                            {ev.condition && <span className={ev.condition !== 'ok' ? 'text-red-400 font-bold uppercase' : 'text-emerald-400'}>{ev.condition === 'ok' ? 'OK' : ev.condition}</span>}
                            {ev.waybillNo && <span className="text-gray-400">WB: {ev.waybillNo}</span>}
                        </div>
                        {ev.notes && <p className="text-xs text-gray-400 mt-1">{ev.notes}</p>}
                        {!!ev.photos?.length && (
                            <div className="flex flex-wrap gap-2 mt-2">
                                {ev.photos.map((p, i) => (
                                    <a key={i} href={p.url} target="_blank" rel="noreferrer"><img src={p.url} alt={p.caption || ''} className="h-14 w-14 object-cover rounded border border-gray-600" /></a>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default WaybillTimeline;
