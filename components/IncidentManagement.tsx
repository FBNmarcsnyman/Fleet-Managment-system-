import React, { useState, useMemo } from 'react';
import { useOperations, useVehicles, useAuth } from '../contexts/AppContexts';
import { IncidentReport, IncidentQuote, Attachment, Vehicle } from '../types';
import Modal from './Modal';
import EditIncidentModal from './EditIncidentModal';
import { format } from 'date-fns';
import { PlusIcon } from './icons/PlusIcon';
import AddIncidentForm from './AddIncidentForm';

const IncidentManagement: React.FC = () => {
    const { users, incidentReports, handleUpdateIncident, handleAddIncidentQuote, handleAddIncident } = useOperations();
    const { vehicles } = useVehicles();
    const { currentUser } = useAuth();
    const [selectedIncident, setSelectedIncident] = useState<IncidentReport | null>(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    const vehicleMap = useMemo(() => new Map<string, Vehicle>(
        (vehicles as Vehicle[]).map((v: Vehicle) => [v.id, v]),
    ), [vehicles]);

    const handleUpdate = (updatedIncident: IncidentReport) => {
        handleUpdateIncident(updatedIncident);
        setSelectedIncident(null);
    };

    const handleAddQuote = (incidentId: string, quote: Omit<IncidentQuote, 'attachment'>, file: File) => {
        handleAddIncidentQuote(incidentId, quote, file);
        // Optimistically update the selected incident to show the new quote without closing the modal
        const reader = new FileReader();
        reader.onload = (event) => {
            const newQuote: IncidentQuote = {
                ...quote,
                attachment: {
                    name: file.name,
                    type: file.type,
                    data: event.target?.result as string,
                }
            };
            setSelectedIncident(prev => {
                if (!prev) return null;
                return {
                    ...prev,
                    quotes: [...prev.quotes, newQuote],
                };
            });
        };
        reader.readAsDataURL(file);
    };
    
    return (
        <>
            <div className="flex justify-between items-center mb-6">
                 <h2 className="text-3xl font-bold text-white">Incident Management</h2>
                 <button onClick={() => setIsAddModalOpen(true)} className="flex items-center font-bold py-2 px-4 rounded-lg bg-orange-600 hover:bg-orange-700 text-white">
                    <PlusIcon className="h-5 w-5 mr-2" /> Report New Incident
                </button>
            </div>
            <div className="bg-gray-800 rounded-lg shadow-lg">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-gray-700/50">
                            <th className="p-4">Vehicle</th>
                            <th className="p-4">Date</th>
                            <th className="p-4">Type</th>
                            <th className="p-4">Status</th>
                            <th className="p-4"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {incidentReports.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(incident => (
                            <tr key={incident.id} className="border-b border-gray-700">
                                <td className="p-4 font-semibold text-white">{vehicleMap.get(incident.vehicleId)?.registration}</td>
                                <td className="p-4">{format(new Date(incident.date), 'dd MMM yyyy')}</td>
                                <td className="p-4">{incident.incidentType}</td>
                                <td className="p-4">{incident.status}</td>
                                <td className="p-4 text-right">
                                    <button onClick={() => setSelectedIncident(incident)} className="text-sm font-semibold text-blue-400">Manage</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {selectedIncident && (
                <Modal isOpen={!!selectedIncident} onClose={() => setSelectedIncident(null)} size="3xl">
                    <EditIncidentModal
                        incident={selectedIncident}
                        users={users}
                        onUpdate={handleUpdate}
                        onAddQuote={(quote, file) => handleAddQuote(selectedIncident.id, quote, file)}
                        onCancel={() => setSelectedIncident(null)}
                    />
                </Modal>
            )}
             {isAddModalOpen && (
                <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} size="4xl">
                    <AddIncidentForm 
                        vehicleId={vehicles[0]?.id || ''} 
                        userId={currentUser?.email || ""}
                        onSubmit={(data) => {
                            handleAddIncident(data);
                            setIsAddModalOpen(false);
                        }}
                        onCancel={() => setIsAddModalOpen(false)}
                    />
                </Modal>
            )}
        </>
    );
};

export default IncidentManagement;