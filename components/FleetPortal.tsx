import React, { useState, useEffect } from 'react';
// Fix: Added missing import for XLSX to handle Google Sheets data synchronization
import * as XLSX from 'xlsx';
import { useUIState, useVehicles, useOperations } from '../contexts/AppContexts';
import VehicleList from './fleet/VehicleList';
import LiveFleetMap from './operations/LiveFleetMap';
import RoutePlanner from './RoutePlanner';
import FuelManagement from './FuelManagement';
import { BRANCHES } from '../constants';
import FleetDashboard from './fleet/FleetDashboard';
import FleetMaintenanceView from './fleet/FleetMaintenanceView';
import FleetChecklistView from './fleet/FleetChecklistView';
import FleetOperationsLogView from './fleet/FleetOperationsLogView';
import FleetAssetAdmin from './fleet/FleetAssetAdmin';
import DriversManagementView from './fleet/DriversManagementView';
import { FuelEntry } from '../types';

type FleetView = 'dashboard' | 'vehicles' | 'admin' | 'drivers' | 'fuelAndCosts' | 'maintenance' | 'checklists' | 'operationsLog' | 'fleetMap' | 'routePlanner';

const FleetPortal: React.FC = () => {
    const { fleetSubView, handleFleetSubViewChange, showModal, showToast, hideModal } = useUIState();
    const { vehicles, fuelPriceRecords, bowsers, bowserRefills, handleAddFuelEntry, handleSetFuelPrice, handleAddBowserRefill, handleAddBowser, handleBulkAddFuelEntries } = useVehicles();
    const { users = [], loadConfirmations = [] } = useOperations();
    
    // Persist the connection URL in localStorage
    const [connectedFuelSheetUrl, setConnectedFuelSheetUrl] = useState<string>(() => {
        return localStorage.getItem('fbn_connected_fuel_sheet') || '';
    });
    const [isSyncing, setIsSyncing] = useState(false);

    const navItems = [
        { view: 'dashboard', label: 'Dashboard' },
        { view: 'vehicles', label: 'Asset List' },
        { view: 'admin', label: 'Asset Admin' },
        { view: 'drivers', label: 'Drivers' },
        { view: 'fuelAndCosts', label: 'Fuel & Costs' },
        { view: 'maintenance', label: 'Maintenance' },
        { view: 'checklists', label: 'Checklists' },
        { view: 'fleetMap', label: 'Live Map' },
        { view: 'routePlanner', label: 'Route Planner' },
        { view: 'operationsLog', label: 'Operations Log' },
    ];

    const onAddBowser = () => {
        showModal('addBowser', {
            onSubmit: (data: any) => {
                handleAddBowser(data);
                hideModal();
            },
            onCancel: hideModal
        });
    };

    const handleSyncFuelData = async () => {
        if (!connectedFuelSheetUrl) {
            showToast("No fuel sheet connected. Use the 'Live Sheet' option in Fuel & Costs to connect one.");
            return;
        }

        setIsSyncing(true);
        showToast("Synchronizing with Google Sheets...");
        
        try {
            // Robust URL transformation: Handle both Published and Share links
            let csvUrl = connectedFuelSheetUrl;
            
            if (csvUrl.includes('docs.google.com/spreadsheets')) {
                if (csvUrl.includes('/pub?')) {
                    // Already a published link, ensure it's CSV
                    if (!csvUrl.includes('output=csv')) {
                        csvUrl = csvUrl.replace(/output=[^&]+/, 'output=csv');
                        if (!csvUrl.includes('output=csv')) csvUrl += (csvUrl.includes('?') ? '&' : '?') + 'output=csv';
                    }
                } else {
                    // Standard share link: /edit#gid=123 -> /export?format=csv&gid=123
                    const gidMatch = csvUrl.match(/[#&]gid=(\d+)/);
                    const gid = gidMatch ? gidMatch[1] : '0';
                    csvUrl = csvUrl.replace(/\/edit.*$/, `/export?format=csv&gid=${gid}`);
                }
            }

            const response = await fetch(csvUrl);
            if (!response.ok) throw new Error("Could not reach Google Sheets. Ensure the sheet is Shared with 'Anyone with the link' or Published to Web.");
            
            const csvText = await response.text();
            const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
            if (lines.length < 2) throw new Error("The sheet appears to be empty.");

            // Use XLSX library to parse CSV safely (handles commas in quotes)
            const workbook = XLSX.read(csvText, { type: 'string' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json<any>(worksheet);

            if (!rows || rows.length === 0) throw new Error("No data rows found in sheet.");

            // Helper to find key regardless of case or spaces
            const findValue = (row: any, ...aliases: string[]) => {
                const keys = Object.keys(row);
                for (const alias of aliases) {
                    const match = keys.find(k => k.toLowerCase().trim() === alias.toLowerCase());
                    if (match) return row[match];
                }
                return null;
            };

            const newEntries: Omit<FuelEntry, 'id'>[] = [];

            rows.forEach(row => {
                const rawReg = findValue(row, 'Vehicle Registration', 'Reg', 'Registration', 'Vehicle');
                const rawDate = findValue(row, 'Date', 'Timestamp', 'Day');
                const rawOdo = findValue(row, 'Odometer', 'KM', 'Odo');
                const rawLiters = findValue(row, 'Liters', 'Litres', 'Fuel', 'Amount');

                // Normalize registration matching (strip spaces/non-alphanumeric)
                const cleanRowReg = rawReg?.toString().toUpperCase().replace(/[^A-Z0-9]/g, '');
                
                if (!cleanRowReg) return;

                const vehicle = vehicles.find(v => v.registration.toUpperCase().replace(/[^A-Z0-9]/g, '') === cleanRowReg);
                
                const odoVal = parseFloat(rawOdo);
                const ltrVal = parseFloat(rawLiters);

                if (vehicle && rawDate && !isNaN(odoVal) && !isNaN(ltrVal)) {
                    newEntries.push({
                        vehicleId: vehicle.id,
                        date: new Date(rawDate).toISOString(),
                        odometer: odoVal,
                        liters: ltrVal,
                    });
                }
            });

            if (newEntries.length > 0) {
                const result = await handleBulkAddFuelEntries(newEntries);
                if (result?.ok) {
                    showToast(`Successfully synchronized ${result.count} fuel entries from cloud.`);
                } else {
                    showToast(`Fuel sync failed: ${result?.error ?? 'Unknown error'}`);
                }
            } else {
                showToast(`Sync finished: 0 new entries matched your fleet (${rows.length} rows processed). Check headers.`);
            }
        } catch (error) {
            console.error("Sync Error:", error);
            showToast(`Sync Failed: ${error instanceof Error ? error.message : 'Unknown error'}. Check URL sharing permissions.`);
        } finally {
            setIsSyncing(false);
        }
    };

    const onConnectFuelSheet = () => {
        showModal('connectAssetSheet', {
            onImport: (url: string) => {
                setConnectedFuelSheetUrl(url);
                localStorage.setItem('fbn_connected_fuel_sheet', url);
                showToast("Fuel sheet connected successfully. Stored for future sessions.");
                hideModal();
            },
            onClose: hideModal
        });
    };

    const renderView = () => {
        switch (fleetSubView as FleetView) {
            case 'vehicles':
                return <VehicleList />;
            case 'admin':
                return <FleetAssetAdmin />;
            case 'drivers':
                return <DriversManagementView />;
            case 'fuelAndCosts':
                return <FuelManagement
                    vehicles={vehicles}
                    prices={fuelPriceRecords}
                    bowsers={bowsers}
                    bowserRefills={bowserRefills}
                    onSubmitSingle={(entry) => handleAddFuelEntry(entry.vehicleId, entry)}
                    onSetPrice={handleSetFuelPrice}
                    onAddBowser={onAddBowser}
                    onAddBowserRefill={handleAddBowserRefill}
                    availableBranches={[...BRANCHES]}
                    onFileUpload={() => {}}
                    onConnectSheet={onConnectFuelSheet}
                    isSheetConnected={!!connectedFuelSheetUrl}
                    onSyncNow={handleSyncFuelData}
                    isSyncing={isSyncing}
                />;
            case 'maintenance':
                return <FleetMaintenanceView />;
            case 'checklists':
                return <FleetChecklistView />;
            case 'fleetMap':
                return <LiveFleetMap vehicles={vehicles} users={users} loadConfirmations={loadConfirmations} />;
            case 'routePlanner':
                return <RoutePlanner />;
            case 'operationsLog':
                return <FleetOperationsLogView />;
            case 'dashboard':
            default:
                return <FleetDashboard />;
        }
    };
    
    return (
        <div>
            <div className="flex items-center space-x-1 mb-6 overflow-x-auto no-scrollbar">
                {navItems.map(item => (
                     <button 
                        key={item.view} 
                        onClick={() => handleFleetSubViewChange(item.view)} 
                        className={`px-4 py-2 text-sm font-semibold rounded-md whitespace-nowrap transition-all ${fleetSubView === item.view ? 'bg-brand-primary text-white shadow-lg shadow-blue-900/40' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
                        {item.label}
                    </button>
                ))}
            </div>
            {fleetSubView === 'vehicles' && (
                <div className="flex flex-wrap gap-3 mb-4">
                    <button
                        onClick={() => showModal('bulkAssignDrivers')}
                        className="px-4 py-2 text-sm font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-500 transition"
                    >
                        Bulk Assign Drivers
                    </button>
                    <button
                        onClick={() => showModal('bulkFuelImport')}
                        className="px-4 py-2 text-sm font-semibold rounded-xl bg-green-600 text-white hover:bg-green-500 transition"
                    >
                        Fuel Import / Validator
                    </button>
                </div>
            )}
            {renderView()}
        </div>
    );
};

export default FleetPortal;
