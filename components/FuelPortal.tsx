import React, { useState } from 'react';
import { useVehicles, useUIState } from '../contexts/AppContexts';
import FuelDashboard from './fleet/FuelDashboard';
import FuelManagement from './FuelManagement';
import { BRANCHES } from '../constants';

// Top-level Fuel module (own sidebar item + own access permission). Holds the
// at-a-glance dashboard (tank levels, today's fills, CPK, Google-Drive import)
// and the detailed logs / bowsers / price management.
const FuelPortal: React.FC = () => {
    const [tab, setTab] = useState<'dashboard' | 'logs'>('dashboard');
    const fleet = useVehicles() as any;
    const { showModal, hideModal } = useUIState();
    const { vehicles, fuelPriceRecords, bowsers, bowserRefills, handleAddFuelEntry, handleSetFuelPrice, handleAddBowserRefill, handleAddBowser } = fleet;

    const onAddBowser = () => showModal('addBowser', {
        onSubmit: (data: any) => { handleAddBowser(data); hideModal(); },
        onCancel: hideModal,
    });

    const tabs: [typeof tab, string][] = [['dashboard', 'Dashboard'], ['logs', 'Logs & Bowsers']];

    return (
        <div className="space-y-5">
            <div className="flex items-center gap-1 overflow-x-auto bg-gray-800/60 p-1 rounded-xl w-fit">
                {tabs.map(([v, label]) => (
                    <button key={v} onClick={() => setTab(v)}
                        className={`px-4 py-2 text-sm font-bold rounded-lg whitespace-nowrap transition ${tab === v ? 'bg-brand-primary text-white shadow' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}>
                        {label}
                    </button>
                ))}
            </div>
            {tab === 'dashboard'
                ? <FuelDashboard />
                : <FuelManagement
                    vehicles={vehicles}
                    prices={fuelPriceRecords}
                    bowsers={bowsers}
                    bowserRefills={bowserRefills}
                    onSubmitSingle={(entry: any) => handleAddFuelEntry(entry.vehicleId, entry)}
                    onSetPrice={handleSetFuelPrice}
                    onAddBowser={onAddBowser}
                    onAddBowserRefill={handleAddBowserRefill}
                    availableBranches={[...BRANCHES]}
                    onFileUpload={() => { }}
                    onConnectSheet={() => { }}
                    isSheetConnected={false}
                    onSyncNow={() => { }}
                />}
        </div>
    );
};

export default FuelPortal;
