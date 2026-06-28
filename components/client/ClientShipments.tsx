import React, { useEffect, useState } from 'react';
import { directSelect } from '../../lib/supabase';

// Container (FCL) + LCL groupage tracking for the logged-in client. Loads on demand
// via directSelect — RLS scopes both tables to the client's own rows (client_id =
// auth_client_id()), so a plain select only returns theirs.
const fmt = (d?: string) => d ? new Date(d).toLocaleDateString('en-ZA') : '—';
const pill = (s?: string) => {
    const v = (s || '').toLowerCase();
    if (/deliver|complete|unpacked|collected|done/.test(v)) return 'bg-emerald-100 text-emerald-700';
    if (/transit|depot|uplift|water|sail|port|arriv/.test(v)) return 'bg-blue-100 text-blue-700';
    if (/hold|delay|storage|demurrage|damage/.test(v)) return 'bg-red-100 text-red-700';
    return 'bg-amber-100 text-amber-700';
};

const ClientShipments: React.FC<{ clientId?: string }> = ({ clientId }) => {
    const [containers, setContainers] = useState<any[]>([]);
    const [lcl, setLcl] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let live = true;
        (async () => {
            setLoading(true);
            const [c, l] = await Promise.all([
                directSelect('containers?select=*&order=updated_at.desc'),
                directSelect('lcl_shipments?select=*&is_history=eq.false&order=updated_at.desc'),
            ]);
            if (!live) return;
            setContainers(Array.isArray(c.data) ? c.data : []);
            setLcl(Array.isArray(l.data) ? l.data : []);
            setLoading(false);
        })();
        return () => { live = false; };
    }, [clientId]);

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Shipments &amp; Tracking</h2>
                <p className="text-slate-500 mt-1">Your containers and LCL groupage cargo, with live status.</p>
            </div>

            {loading ? <p className="text-slate-400 text-sm py-10 text-center">Loading…</p> : (
                <>
                    {/* Containers (FCL) */}
                    <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Container tracking</h3>
                            <span className="text-xs font-bold text-slate-400">{containers.length}</span>
                        </div>
                        {containers.length === 0 ? <p className="text-sm text-slate-400 py-8 text-center">No containers linked to your account yet.</p> : (
                            <div className="overflow-x-auto"><table className="w-full text-sm">
                                <thead><tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                                    <th className="py-2 pl-4 px-2">Container</th><th className="py-2 px-2">Vessel / Line</th><th className="py-2 px-2">ETA port</th><th className="py-2 px-2">Your ref</th><th className="py-2 px-2 text-center">Status</th>
                                </tr></thead>
                                <tbody>{containers.map(c => (
                                    <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                                        <td className="py-2 pl-4 px-2 font-bold text-slate-900">{c.container_no || '—'}<span className="block text-[11px] font-normal text-slate-400">{c.size || ''} {c.commodity || ''}</span></td>
                                        <td className="py-2 px-2 text-slate-600">{[c.vessel_name, c.shipping_line].filter(Boolean).join(' · ') || '—'}</td>
                                        <td className="py-2 px-2 text-slate-600">{fmt(c.eta_port)}</td>
                                        <td className="py-2 px-2 text-slate-500">{c.client_ref || '—'}</td>
                                        <td className="py-2 px-2 text-center"><span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ${pill(c.status)}`}>{c.status || 'In progress'}</span></td>
                                    </tr>
                                ))}</tbody>
                            </table></div>
                        )}
                    </section>

                    {/* LCL / groupage */}
                    <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">LCL / groupage status</h3>
                            <span className="text-xs font-bold text-slate-400">{lcl.length}</span>
                        </div>
                        {lcl.length === 0 ? <p className="text-sm text-slate-400 py-8 text-center">No LCL shipments linked to your account yet.</p> : (
                            <div className="overflow-x-auto"><table className="w-full text-sm">
                                <thead><tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                                    <th className="py-2 pl-4 px-2">Ref</th><th className="py-2 px-2">House bill / container</th><th className="py-2 px-2">Cargo</th><th className="py-2 px-2">ETA</th><th className="py-2 px-2">Delivered</th><th className="py-2 px-2 text-center">Status</th>
                                </tr></thead>
                                <tbody>{lcl.map(s => (
                                    <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50">
                                        <td className="py-2 pl-4 px-2 font-bold text-slate-900">{s.fbn_di || s.file_ref || '—'}</td>
                                        <td className="py-2 px-2 text-slate-600">{[s.house_bill, s.container_no].filter(Boolean).join(' · ') || '—'}</td>
                                        <td className="py-2 px-2 text-slate-600">{[s.commodity, s.qty ? `${s.qty} pkg` : '', s.weight_kg ? `${s.weight_kg}kg` : ''].filter(Boolean).join(' · ') || '—'}{s.hazardous && <span className="ml-1 text-[10px] font-bold text-red-600">HAZ</span>}</td>
                                        <td className="py-2 px-2 text-slate-600">{fmt(s.eta)}</td>
                                        <td className="py-2 px-2 text-slate-500">{fmt(s.delivered_client_date)}</td>
                                        <td className="py-2 px-2 text-center"><span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ${pill(s.status)}`}>{s.status || 'In progress'}</span></td>
                                    </tr>
                                ))}</tbody>
                            </table></div>
                        )}
                    </section>
                </>
            )}
        </div>
    );
};

export default ClientShipments;
