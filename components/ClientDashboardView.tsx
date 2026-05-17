

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
                <h2 className="text-2xl font-bold text-white mb-4">Active Shipments</h2>
                {activeJobs.length > 0 ? (
                    <div className="space-y-4">
                        {activeJobs.map(job => <ClientJobCard key={job.id} loadConfirmation={job} />)}
                    </div>
                ) : (
                    <div className="text-center py-10 bg-gray-800 rounded-lg"><p className="text-gray-400">You have no active shipments.</p></div>
                )}
            </div>
            <div>
                <h2 className="text-2xl font-bold text-white mb-4">Completed Shipments</h2>
                {completedJobs.length > 0 ? (
                    <div className="space-y-4">
                        {completedJobs.map(job => <ClientJobCard key={job.id} loadConfirmation={job} />)}
                    </div>
                ) : (
                    <div className="text-center py-10 bg-gray-800 rounded-lg"><p className="text-gray-400">You have no completed shipments yet.</p></div>
                )}
            </div>
        </div>
    );
};

export default ClientDashboardView;
