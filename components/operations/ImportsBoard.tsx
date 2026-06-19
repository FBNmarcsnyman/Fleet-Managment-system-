import React, { useMemo, useState } from 'react';
import { LoadConfirmation, Branch } from '../../types';
import { useOperations, useUIState, useAuth } from '../../contexts/AppContexts';
import { invokeFn, directInvoke } from '../../lib/supabase';
import { brandedEmail, emailButton } from '../../lib/emailTemplate';

// Imports / Depot Watch — the LCL groupage pool. Consignments logged from
// cartage advices sit here (awaiting unpack/release) grouped by unpack depot;
// once released, ops books ONE vehicle to collect all of that depot's ready
// cargo for the day, which sends them onto the Shipments board to consolidate.
const opsEmailFor = (b?: string) => b === 'FBN DBN' ? 'opsdbn@fbn-transport.co.za' : b === 'FBN JHB' ? 'opsjhb@fbn-transport.co.za' : 'ops@fbn-transport.co.za';

const ImportsBoard: React.FC = () => {
    const { loadConfirmations = [], clients = [], handleUpdateLoadConfirmation, handleRefreshLoads } = useOperations() as any;
    const { showModal, showToast } = useUIState();
    const { currentUser } = useAuth();
    const [busy, setBusy] = useState<string | null>(null);

    const clientName = (lc: LoadConfirmation) => (clients as any[]).find(c => c.id === lc.clientId)?.name || lc.clientName || '—';

    const imports = useMemo(() =>
        (loadConfirmations as LoadConfirmation[]).filter(lc => lc.importStage === 'awaiting_release' || lc.importStage === 'released'),
        [loadConfirmations]);

    // Group by unpack depot.
    const groups = useMemo(() => {
        const map = new Map<string, LoadConfirmation[]>();
        imports.forEach(lc => {
            const key = lc.unpackDepot || 'OTHER';
            map.set(key, [...(map.get(key) || []), lc]);
        });
        return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    }, [imports]);

    const kg = (n: number) => Math.round(n).toLocaleString('en-ZA');
    const totals = (list: LoadConfirmation[]) => ({
        pkgs: list.reduce((s, l) => s + (Number(l.loadedPackages) || 0), 0),
        weight: list.reduce((s, l) => s + (Number(l.weightKg) || 0), 0),
        cube: list.reduce((s, l) => s + (Number((l as any).cubeM3) || 0), 0),
    });

    const markReleased = async (lc: LoadConfirmation) => {
        setBusy(lc.id);
        const res = await handleUpdateLoadConfirmation(lc.id, { importStage: 'released' } as any);
        setBusy(null);
        if (res && res.ok === false) showToast(`Could not update: ${res.error}`);
    };
    const undoRelease = async (lc: LoadConfirmation) => {
        setBusy(lc.id);
        await handleUpdateLoadConfirmation(lc.id, { importStage: 'awaiting_release' } as any);
        setBusy(null);
    };

    // Book one collection for ALL released cargo at this depot today.
    const bookDepot = async (depot: string, list: LoadConfirmation[]) => {
        const ready = list.filter(l => l.importStage === 'released');
        if (!ready.length) { showToast('Nothing marked released at this depot yet.'); return; }
        setBusy(depot);
        const ref = `COL-${depot}-${String(Date.now()).slice(-6)}`;
        const branch = (ready[0].collectionBranch as Branch) || 'FBN DBN';
        let ok = 0;
        for (const lc of ready) {
            const res = await handleUpdateLoadConfirmation(lc.id, { importStage: 'collected', collectionRef: ref } as any);
            if (!(res && res.ok === false)) ok++;
        }
        const t = totals(ready);
        try {
            const base = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '';
            const html = brandedEmail(`<p><strong>Collect groupage at ${depot}.</strong></p>
              <p><strong>${ok}</strong> consignment${ok !== 1 ? 's' : ''} released &amp; ready — total <strong>${kg(t.weight)} kg</strong>${t.cube ? ` / ${t.cube.toFixed(1)} m³` : ''}. Ref <strong>${ref}</strong>.</p>
              <p>Please send a vehicle to collect all at ${depot} today, then bring to depot for consolidation.</p>
              ${emailButton(`${base}?view=operations`, 'Open Shipments board &rarr;', '#16a34a')}
              <p>Regards,<br>FBN Transport</p>`);
            void invokeFn('send-email', { body: { to: opsEmailFor(branch), cc: ['ops@fbn-transport.co.za'], subject: `COLLECT GROUPAGE ${depot} - ${ok} consignments - ${ref}`, html, fromName: 'FBN Transport' } });
            void directInvoke('send-push', { title: `Collect groupage ${depot}`, body: `${ok} consignments, ${kg(t.weight)} kg ready`, url: '?view=operations' });
        } catch (e) { console.error('[imports] book email', e); }
        setBusy(null);
        showToast(`Booked ${ok} consignment${ok !== 1 ? 's' : ''} at ${depot} — ops notified to send a vehicle (ref ${ref}).`);
        handleRefreshLoads?.();
    };

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                    <h3 className="text-xl font-black text-slate-900">Imports — depot watch</h3>
                    <p className="text-xs text-slate-500">LCL groupage awaiting unpack/release. Mark released as the depot frees cargo, then book one collection per depot for the day.</p>
                </div>
                <button onClick={() => showModal('cartageScan', {})} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-4 rounded-lg text-sm shadow active:scale-95">📄 Scan cartage advice</button>
            </div>

            {groups.length === 0 && <p className="text-center text-slate-400 text-sm py-12 font-bold uppercase tracking-widest">No import consignments awaiting collection.</p>}

            {groups.map(([depot, list]) => {
                const t = totals(list);
                const readyCount = list.filter(l => l.importStage === 'released').length;
                return (
                    <div key={depot} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                        <div className="flex items-center justify-between flex-wrap gap-2 mb-3 pb-2 border-b border-slate-200">
                            <div>
                                <span className="text-sm font-black text-[#13294b]">{depot}</span>
                                <span className="text-[11px] text-slate-500 ml-2">{list.length} consignment{list.length !== 1 ? 's' : ''} · {t.pkgs} pkgs · {kg(t.weight)} kg{t.cube ? ` · ${t.cube.toFixed(1)} m³` : ''}</span>
                            </div>
                            <button onClick={() => bookDepot(depot, list)} disabled={busy === depot || readyCount === 0}
                                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-black py-1.5 px-4 rounded-lg text-xs uppercase tracking-wider">
                                {busy === depot ? 'Booking…' : `Book collection (${readyCount} ready)`}
                            </button>
                        </div>
                        <div className="space-y-2">
                            {list.map(lc => {
                                const released = lc.importStage === 'released';
                                return (
                                    <div key={lc.id} className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                                        <button onClick={() => showModal('loadDetail', { loadCon: lc })} className="text-left min-w-0">
                                            <p className="font-bold text-slate-900 text-sm truncate">{clientName(lc)}</p>
                                            <p className="text-[10px] text-slate-500 truncate">{lc.deliveryPoint || '—'}{lc.loadRefNo ? ` · HBL ${lc.loadRefNo}` : ''}</p>
                                            <p className="text-[10px] text-slate-500">{Number(lc.loadedPackages) || lc.packaging || '?'} pkgs{lc.weightKg ? ` · ${kg(Number(lc.weightKg))} kg` : ''}</p>
                                        </button>
                                        <div className="shrink-0 flex items-center gap-2">
                                            <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase ${released ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{released ? 'Released' : 'Awaiting'}</span>
                                            {released ? (
                                                <button onClick={() => undoRelease(lc)} disabled={busy === lc.id} className="text-[10px] font-bold text-slate-500 hover:text-slate-800 px-2 py-1">Undo</button>
                                            ) : (
                                                <button onClick={() => markReleased(lc)} disabled={busy === lc.id} className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black py-1.5 px-3 rounded-lg uppercase tracking-wider">{busy === lc.id ? '…' : 'Mark released'}</button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default ImportsBoard;
