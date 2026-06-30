import React, { useMemo, useState } from 'react';
import { JobCard } from '../types';
import { useWorkshop, useVehicles, useUIState } from '../contexts/AppContexts';
import { SparklesIcon } from './icons/SparklesIcon';
import { formatDistanceToNow } from 'date-fns';

const priorityChip: Record<string, string> = {
    Critical: 'bg-red-100 text-red-700',
    High: 'bg-orange-100 text-orange-700',
    Medium: 'bg-amber-100 text-amber-700',
    Low: 'bg-slate-100 text-slate-600',
};
const PRIORITY_ORDER: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };

const JobCardPortal: React.FC<any> = () => {
    const { showModal } = useUIState();
    const { jobCards = [] } = useWorkshop();
    const { vehicles = [] } = useVehicles();
    const [showResolved, setShowResolved] = useState(false);
    const vehicleMap = useMemo(() => new Map((vehicles || []).map((v: any) => [v.id, v])), [vehicles]);

    const open = useMemo(() => (jobCards || []).filter((j: JobCard) => j.status !== 'Resolved')
        .sort((a: JobCard, b: JobCard) => (PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]) || (new Date(b.reportedDate).getTime() - new Date(a.reportedDate).getTime())), [jobCards]);
    const resolved = useMemo(() => (jobCards || []).filter((j: JobCard) => j.status === 'Resolved')
        .sort((a: JobCard, b: JobCard) => new Date(b.completionDate || b.reportedDate).getTime() - new Date(a.completionDate || a.reportedDate).getTime()), [jobCards]);

    const Row: React.FC<{ jc: JobCard }> = ({ jc }) => {
        const v: any = vehicleMap.get(jc.vehicleId);
        const defects = jc.defects || [];
        const openCount = defects.filter(d => !d.resolved).length;
        return (
            <button onClick={() => showModal('jobCardDetail', { jobCardId: jc.id })} className="w-full text-left bg-white border border-slate-200 rounded-xl p-4 hover:bg-slate-50 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="font-black text-[#13294b]">{v?.registration || 'Unknown'}</span>
                        {jc.priority && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${priorityChip[jc.priority] || 'bg-slate-100 text-slate-600'}`}>{jc.priority}</span>}
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">{jc.status}</span>
                    </div>
                    <p className="text-sm text-slate-600 truncate mt-0.5">{jc.itemDescription}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{formatDistanceToNow(new Date(jc.reportedDate), { addSuffix: true })}{jc.type ? ` · ${jc.type}` : ''}</p>
                </div>
                {defects.length > 0 && (
                    <div className="shrink-0 text-right">
                        <div className="text-lg font-black text-[#13294b]">{openCount}</div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase">of {defects.length} open</div>
                    </div>
                )}
            </button>
        );
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-black text-[#13294b]">Job Cards</h2>
                <button onClick={() => showModal('aiTriage')} className="flex items-center font-bold py-2 px-4 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50">
                    <SparklesIcon className="h-5 w-5 mr-2 text-[#f5b700]" /> AI Triage Assistant
                </button>
            </div>

            <div className="space-y-2 max-w-3xl">
                {open.length === 0 && <p className="text-center text-slate-400 py-12 bg-white border border-slate-200 rounded-xl">No open job cards. </p>}
                {open.map((jc: JobCard) => <Row key={jc.id} jc={jc} />)}
            </div>

            {resolved.length > 0 && (
                <div className="max-w-3xl mt-6">
                    <button onClick={() => setShowResolved(s => !s)} className="text-sm font-bold text-slate-500 hover:text-slate-700">{showResolved ? '▾' : '▸'} Resolved ({resolved.length})</button>
                    {showResolved && <div className="space-y-2 mt-2 opacity-70">{resolved.map((jc: JobCard) => <Row key={jc.id} jc={jc} />)}</div>}
                </div>
            )}
        </div>
    );
};

export default JobCardPortal;
