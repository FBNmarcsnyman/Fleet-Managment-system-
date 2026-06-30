import React, { lazy, Suspense, useState } from 'react';

// One "Deliveries / POD" tab combining the two POD screens that used to be separate tabs:
//  • By day      — DeliveriesDayView (work through deliveries by date, chase PODs)
//  • POD sign-off — PodSignOffBoard (admin authorises PODs before client send)
const DeliveriesDayView = lazy(() => import('./DeliveriesDayView'));
const PodSignOffBoard = lazy(() => import('./PodSignOffBoard'));

const DeliveriesPod: React.FC = () => {
    const [tab, setTab] = useState<'day' | 'signoff'>('day');
    const chip = (active: boolean) => `px-3 py-1.5 text-xs font-bold rounded-md ${active ? 'bg-[#13294b] text-white' : 'text-slate-600 hover:bg-white'}`;
    return (
        <div>
            <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit mb-4">
                <button onClick={() => setTab('day')} className={chip(tab === 'day')}>By day</button>
                <button onClick={() => setTab('signoff')} className={chip(tab === 'signoff')}>POD sign-off</button>
            </div>
            <Suspense fallback={<div className="text-slate-400 p-6">Loading…</div>}>
                {tab === 'day' ? <DeliveriesDayView /> : <PodSignOffBoard />}
            </Suspense>
        </div>
    );
};

export default DeliveriesPod;
