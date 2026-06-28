

import React from 'react';
import { LoadConfirmation } from '../types';
import ClientJobCard from './ClientJobCard';

interface ClientDashboardViewProps {
    loadConfirmations: LoadConfirmation[];
}

const ClientDashboardView: React.FC<ClientDashboardViewProps> = ({ loadConfirmations }) => {
    const activeJobs = loadConfirmations.filter(lc => lc.status !== 'Invoiced' && lc.status !== 'Cancelled' && lc.status !== 'POD Submitted');
    const completedJobs = loadConfirmations.filter(lc => lc.status === 'POD Submitted' || lc.status === 'Invoiced');

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-1">My Loads</h2>
                <p className="text-slate-500 mb-4">Track your shipments, see the assigned vehicle &amp; driver, and download PODs.</p>
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">Active · {activeJobs.length}</h3>
                {activeJobs.length > 0 ? (
                    <div className="space-y-3">
                        {activeJobs.map(job => <ClientJobCard key={job.id} loadConfirmation={job} />)}
                    </div>
                ) : (
                    <div className="text-center py-10 bg-white border border-slate-200 rounded-xl"><p className="text-slate-400">You have no active shipments.</p></div>
                )}
            </div>
            <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">Completed · {completedJobs.length}</h3>
                {completedJobs.length > 0 ? (
                    <div className="space-y-3">
                        {completedJobs.map(job => <ClientJobCard key={job.id} loadConfirmation={job} />)}
                    </div>
                ) : (
                    <div className="text-center py-10 bg-white border border-slate-200 rounded-xl"><p className="text-slate-400">You have no completed shipments yet.</p></div>
                )}
            </div>
        </div>
    );
};

export default ClientDashboardView;
