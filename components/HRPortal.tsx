import React, { useState } from 'react';
import { useWorkshop, useOperations } from '../contexts/AppContexts';
import { HRCase } from '../types';
import Modal from './Modal';
import EditHRCaseModal from './EditHRCaseModal';
import { format } from 'date-fns';

const HRPortal: React.FC = () => {
    const { users, hrCases, handleUpdateHRCase } = useWorkshop();
    const { incidentReports } = useOperations();
    const [selectedCase, setSelectedCase] = useState<HRCase | null>(null);

    const userMap = new Map(users.map(u => [u.email, u.name]));

    const handleSubmit = (updatedCase: HRCase) => {
        handleUpdateHRCase(updatedCase);
        setSelectedCase(null);
    };

    return (
        <>
            <h2 className="text-3xl font-bold text-white mb-6">HR Accountability Portal</h2>
            <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-gray-700/50">
                            <th className="p-4 text-gray-300">Driver</th>
                            <th className="p-4 text-gray-300">Reason</th>
                            <th className="p-4 text-gray-300">Date Reported</th>
                            <th className="p-4 text-gray-300 text-right">Cost To Recover</th>
                            <th className="p-4 text-gray-300 text-center">Status</th>
                            <th className="p-4 text-gray-300 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {hrCases.map(hrCase => (
                            <tr key={hrCase.id} className="border-b border-gray-700">
                                <td className="p-4 font-medium text-white">{userMap.get(hrCase.driverId) || hrCase.driverId}</td>
                                <td className="p-4 text-gray-300">{hrCase.damageReason}</td>
                                <td className="p-4 text-gray-400">{format(new Date(hrCase.reportedDate), 'dd MMM yyyy')}</td>
                                <td className="p-4 text-right font-mono text-red-400">R {hrCase.costToRecover.toFixed(2)}</td>
                                <td className="p-4 text-center">{hrCase.status}</td>
                                <td className="p-4 text-right">
                                    <button onClick={() => setSelectedCase(hrCase)} className="text-sm font-semibold text-blue-400 hover:text-white">Edit</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {selectedCase && (
                <Modal isOpen={!!selectedCase} onClose={() => setSelectedCase(null)}>
                    <EditHRCaseModal
                        hrCase={selectedCase}
                        incidentReports={incidentReports}
                        onSubmit={handleSubmit}
                        onCancel={() => setSelectedCase(null)}
                    />
                </Modal>
            )}
        </>
    );
};

export default HRPortal;