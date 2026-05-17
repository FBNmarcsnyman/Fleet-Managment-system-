import React, { useState } from 'react';
import { useAuth, useUIState, useVehicles, useOperations, useWorkshop } from '../contexts/AppContexts';
import DriverVehicleCard from './DriverVehicleCard';
import { differenceInDays, isPast } from 'date-fns';
import PerformChecklistForm from './PerformChecklistForm';
import { Vehicle } from '../types';
import AddIncidentForm from './AddIncidentForm';
import Modal from './Modal';
import DriverJobUpdateModal from './DriverJobUpdateModal';

type DriverView = 'dashboard' | 'checklist' | 'incident';

const DriverDashboard: React.FC = () => {
    const { currentUser, handleLogout } = useAuth();
    const { vehicles = [] } = useVehicles();
    const { loadConfirmations = [], handleUpdateLoadConfirmation } = useOperations();
    const { checklistTemplates = [], handleAddChecklistSubmission } = useWorkshop();
    const [view, setView] = useState<DriverView>('dashboard');
    const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
    const [jobToUpdate, setJobToUpdate] = useState<any>(null);

    if (!currentUser) return null;

    const assignedVehicles = (vehicles || []).filter(v => currentUser.assignedVehicleIds?.includes(v.id));

    const checkExpiry = (expiryDate?: string) => {
        if (!expiryDate) return null;
        const daysUntilExpiry = differenceInDays(new Date(expiryDate), new Date());
        if (isPast(new Date(expiryDate))) return 'expired';
        if (daysUntilExpiry <= 30) return 'expiring';
        return null;
    };

    const licenseExpiryWarning = checkExpiry(currentUser.licenseExpiry);
    const pdpExpiryWarning = checkExpiry(currentUser.pdpExpiry);

    const handleStartChecklist = (vehicle: Vehicle) => {
        setSelectedVehicle(vehicle);
        setView('checklist');
    };

    const handleReportIncident = (vehicle: Vehicle) => {
        setSelectedVehicle(vehicle);
        setView('incident');
    };

    const handleBackToDashboard = () => {
        setSelectedVehicle(null);
        setView('dashboard');
    };
    
    if (view === 'checklist' && selectedVehicle) {
        return (
            <div className="max-w-4xl mx-auto">
                <button onClick={handleBackToDashboard} className="text-brand-secondary mb-4">&larr; Back to Dashboard</button>
                <PerformChecklistForm
                    vehicle={selectedVehicle}
                    currentUser={currentUser}
                    templates={checklistTemplates || []}
                    onSubmit={(data) => { 
                        handleAddChecklistSubmission(data);
                        alert('Checklist Submitted!'); 
                        handleBackToDashboard(); 
                    }}
                    onCancel={handleBackToDashboard}
                    isStandalonePage
                />
            </div>
        );
    }

    if (view === 'incident' && selectedVehicle) {
        return (
             <div className="max-w-4xl mx-auto">
                <button onClick={handleBackToDashboard} className="text-brand-secondary mb-4">&larr; Back to Dashboard</button>
                <AddIncidentForm
                    vehicleId={selectedVehicle.id}
                    userId={currentUser.email}
                    onSubmit={() => { alert('Incident Reported!'); handleBackToDashboard(); }}
                    onCancel={handleBackToDashboard}
                />
            </div>
        );
    }
    
    const driverJobs = (loadConfirmations || []).filter(lc => lc.driverId === currentUser.email && ['At Collection Point', 'Collected', 'In Transit', 'Out for Delivery'].includes(lc.status));

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-white">Driver Dashboard</h2>
                <button onClick={handleLogout} className="text-sm font-semibold text-red-400 hover:text-white">Logout</button>
            </div>
            
            <h3 className="text-xl font-semibold text-white mb-4">My Assigned Vehicles</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {assignedVehicles.map(v => (
                    <DriverVehicleCard
                        key={v.id}
                        vehicle={v}
                        onStartChecklist={() => handleStartChecklist(v)}
                        onReportIncident={() => handleReportIncident(v)}
                        licenseExpiryWarning={licenseExpiryWarning}
                        pdpExpiryWarning={pdpExpiryWarning}
                    />
                ))}
                {assignedVehicles.length === 0 && <p className="text-gray-500 col-span-full py-10 text-center">No vehicles currently assigned to you.</p>}
            </div>

            <h3 className="text-xl font-semibold text-white mb-4">My Active Jobs</h3>
            <div className="space-y-3">
                {driverJobs.map(job => (
                    <div key={job.id} className="bg-gray-800 p-4 rounded-lg flex justify-between items-center">
                        <div>
                            <p className="font-bold text-white">{job.collectionPoint} &rarr; {job.deliveryPoint}</p>
                            <p className="text-sm text-gray-400 font-mono">{job.loadConNumber}</p>
                        </div>
                        <button onClick={() => setJobToUpdate(job)} className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg">Update</button>
                    </div>
                ))}
                 {driverJobs.length === 0 && <p className="text-gray-500 py-10 text-center">You have no active dispatch jobs.</p>}
            </div>
            {jobToUpdate && (
                <Modal isOpen={!!jobToUpdate} onClose={() => setJobToUpdate(null)}>
                    <DriverJobUpdateModal 
                        loadCon={jobToUpdate}
                        onCancel={() => setJobToUpdate(null)}
                        onSubmit={(id, updates) => {
                            handleUpdateLoadConfirmation(id, updates);
                            setJobToUpdate(null);
                        }}
                    />
                </Modal>
            )}

        </div>
    );
};

export default DriverDashboard;