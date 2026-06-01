import React, { useMemo } from 'react';
import { useOperations, useVehicles } from '../../contexts/AppContexts';
import { format } from 'date-fns';

const FleetOperationsLogView: React.FC = () => {
    const { loadConfirmations = [], clients = [] } = useOperations();
    const { vehicles = [] } = useVehicles();

    const vehicleMap = useMemo(() => new Map<string, string>(
        (vehicles || []).map((v: { id: string; registration: string }) => [v.id, v.registration]),
    ), [vehicles]);
    const clientMap = useMemo(() => new Map<string, string>(
        (clients || []).map((c: { id: string; name: string }) => [c.id, c.name]),
    ), [clients]);

    const sortedLogs = useMemo(() => {
        return [...(loadConfirmations || [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [loadConfirmations]);

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <h2 className="text-3xl font-bold text-white mb-6">Fleet Operations Log</h2>
            <div className="overflow-x-auto max-h-[calc(100vh-25rem)]">
                <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-gray-800">
                        <tr className="border-b border-gray-700">
                            <th className="p-2 text-gray-400">Date</th>
                            <th className="p-2 text-gray-400">LoadCon #</th>
                            <th className="p-2 text-gray-400">Vehicle</th>
                            <th className="p-2 text-gray-400">Client</th>
                            <th className="p-2 text-gray-400">Route</th>
                            <th className="p-2 text-gray-400">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedLogs.map(lc => (
                            <tr key={lc.id} className="border-b border-gray-700/50 hover:bg-gray-700/50">
                                <td className="p-2 whitespace-nowrap">{format(new Date(lc.date), 'dd MMM yyyy')}</td>
                                <td className="p-2 font-mono text-white">{lc.loadConNumber}</td>
                                <td className="p-2 font-mono">{vehicleMap.get(lc.vehicleId || '') || 'N/A'}</td>
                                <td className="p-2">{clientMap.get(lc.clientId)}</td>
                                <td className="p-2 truncate" title={`${lc.collectionPoint} to ${lc.deliveryPoint}`}>
                                    {lc.collectionPoint} &rarr; {lc.deliveryPoint}
                                </td>
                                <td className="p-2">{lc.status}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default FleetOperationsLogView;