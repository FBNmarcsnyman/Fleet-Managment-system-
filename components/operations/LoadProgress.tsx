import React from 'react';
import { LoadConfirmation } from '../../types';
import { stageFlow, STATUS_LABEL } from '../../lib/loadStatus';

// A compact live progress bar showing how far a shipment is through its journey.
// Driven purely by the current status against this load's stage flow (direct vs
// depot), so it updates the moment the board refreshes.
const LoadProgress: React.FC<{ lc: LoadConfirmation }> = ({ lc }) => {
    if (lc.status === 'Cancelled') {
        return <div className="text-[9px] font-black text-red-600 uppercase tracking-wider">Cancelled</div>;
    }
    const flow = stageFlow(lc);
    const idx = Math.max(0, flow.indexOf(lc.status));
    const total = flow.length;
    const delivered = lc.status === 'Delivered' || lc.status === 'POD Submitted';
    const pct = delivered ? 100 : Math.round(((idx + 1) / total) * 100);
    const barColor = delivered ? 'bg-emerald-500' : 'bg-blue-500';
    return (
        <div className="mb-2">
            <div className="flex justify-between items-center text-[8px] font-bold text-slate-400 mb-0.5">
                <span className="uppercase tracking-wider text-slate-500">{STATUS_LABEL[lc.status]}</span>
                <span>{delivered ? 'Done' : `Step ${idx + 1}/${total}`}</span>
            </div>
            <div className="flex gap-0.5">
                {flow.map((s, i) => (
                    <div key={s} title={STATUS_LABEL[s]}
                        className={`h-1.5 flex-1 rounded-full ${i < idx ? barColor : i === idx ? `${barColor} animate-pulse` : 'bg-slate-200'}`} />
                ))}
            </div>
        </div>
    );
};

export default LoadProgress;
