import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { FuelEntry, Vehicle, Bowser } from '../types';
import { FuelIcon } from './icons/FuelIcon';
import { TableIcon } from './icons/TableIcon';
import { LinkIcon } from './icons/LinkIcon';
import { RefreshIcon } from './icons/RefreshIcon';
import { useVehicles } from '../contexts/AppContexts';

interface FuelFillingFormProps {
    vehicles: Vehicle[];
    onSubmitSingle: (entry: Omit<FuelEntry, 'id'>) => void;
    onSubmitBulk: (entries: Omit<FuelEntry, 'id'>[]) => void;
    isSheetConnected: boolean;
    onSyncNow: () => void;
    onConnectSheet: () => void;
    availableBranches: string[];
    isSyncing?: boolean;
}

type ActiveTab = 'single' | 'bulk';

const FuelFillingForm: React.FC<FuelFillingFormProps> = ({ 
    vehicles, 
    onSubmitSingle, 
    onSubmitBulk, 
    isSheetConnected, 
    onSyncNow, 
    onConnectSheet, 
    availableBranches,
    isSyncing = false 
}) => {
    const { bowsers = [] } = useVehicles();
    const [activeTab, setActiveTab] = useState<ActiveTab>('single');

    // --- Single Entry State ---
    const [branchFilter, setBranchFilter] = useState('All');
    const [vehicleId, setVehicleId] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [odometer, setOdometer] = useState('');
    const [liters, setLiters] = useState('');
    const [sourceBowserId, setSourceBowserId] = useState('');

    const filteredVehicles = useMemo(() => {
        if (branchFilter === 'All') return vehicles;
        return vehicles.filter(v => v.branch === branchFilter);
    }, [vehicles, branchFilter]);

    const handleSingleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!vehicleId || !date || !odometer || !liters) {
            alert('Please fill out all fields.');
            return;
        }
        
        onSubmitSingle({
            vehicleId,
            date,
            odometer: parseFloat(odometer),
            liters: parseFloat(liters),
            sourceBowserId: sourceBowserId || undefined,
        });

        // Reset fields for next entry
        setOdometer('');
        setLiters('');
        setSourceBowserId('');
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                if (!data) throw new Error("Failed to read file.");
                const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json<any>(worksheet);

                if (!json || json.length === 0) {
                    alert("The file appears to be empty.");
                    return;
                }

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
                const errors: string[] = [];

                json.forEach((row, index) => {
                    const rawReg = findValue(row, 'Vehicle Registration', 'Reg', 'Registration', 'Vehicle');
                    const rawDate = findValue(row, 'Date', 'Timestamp', 'Day');
                    const rawOdo = findValue(row, 'Odometer', 'KM', 'Odo');
                    const rawLiters = findValue(row, 'Liters', 'Litres', 'Fuel', 'Amount');
                    const rawSource = findValue(row, 'Source', 'Bowser', 'Location');

                    const reg = rawReg?.toString().trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
                    const vehicle = vehicles.find(v => v.registration.toUpperCase().replace(/[^A-Z0-9]/g, '') === reg);
                    const rowNum = index + 2;

                    if (!reg) return; // Skip truly empty rows

                    if (!vehicle) {
                        errors.push(`Row ${rowNum}: Asset '${rawReg}' not found in system.`);
                        return;
                    }
                    if (!rawDate || rawOdo === undefined || rawLiters === undefined) {
                        errors.push(`Row ${rowNum}: Missing data (Date: ${!!rawDate}, Odo: ${rawOdo !== undefined}, Liters: ${rawLiters !== undefined})`);
                        return;
                    }

                    const entryDate = new Date(rawDate);
                    const odo = parseFloat(rawOdo);
                    const ltrs = parseFloat(rawLiters);

                    if (isNaN(entryDate.getTime()) || isNaN(odo) || isNaN(ltrs)) {
                         errors.push(`Row ${rowNum}: Invalid formats for Date/Odo/Liters.`);
                         return;
                    }

                    // Try to match source to a bowser
                    const matchedBowser = bowsers.find(b => b.name.toLowerCase() === rawSource?.toString().toLowerCase());

                    newEntries.push({
                        vehicleId: vehicle.id,
                        date: entryDate.toISOString(),
                        odometer: odo,
                        liters: ltrs,
                        sourceBowserId: matchedBowser?.id,
                    });
                });
                
                if (newEntries.length > 0) {
                    onSubmitBulk(newEntries);
                    alert(`Import Success!\n- ${newEntries.length} entries uploaded.\n- ${errors.length} rows skipped with issues.`);
                } else if (errors.length > 0) {
                    alert(`Import Failed:\n${errors.slice(0, 5).join('\n')}\n${errors.length > 5 ? '...' : ''}`);
                } else {
                    alert("No valid fuel data was found in the file. Check headers.");
                }

            } catch (error) {
                alert(`Error processing file: ${error instanceof Error ? error.message : 'An unknown error occurred.'}`);
            }
        };
        reader.readAsArrayBuffer(file);
        event.target.value = ''; // Reset file input
    };

    const TabButton = ({ tab, label, icon: Icon }: { tab: ActiveTab, label: string, icon: React.ElementType }) => {
        const isActive = activeTab === tab;
        return (
             <button
                onClick={() => setActiveTab(tab)}
                className={`flex-1 flex items-center justify-center px-4 py-3 font-semibold text-sm transition-colors rounded-t-lg ${
                    isActive ? 'bg-gray-800 text-white border-t-2 border-brand-primary' : 'bg-gray-900 text-gray-400 hover:bg-gray-700'
                }`}
            >
                <Icon className="h-5 w-5 mr-2" />
                {label}
            </button>
        )
    };

    return (
        <div className="max-w-4xl mx-auto">
            <div className="flex w-full">
                <TabButton tab="single" label="Single Entry" icon={FuelIcon} />
                <TabButton tab="bulk" label="Bulk Upload" icon={TableIcon} />
            </div>
            <div className="bg-gray-800 p-8 rounded-b-xl shadow-lg border-x border-b border-gray-700">
                {activeTab === 'single' ? (
                     <div>
                        <h2 className="text-3xl font-black text-white mb-6 flex items-center">
                            <span className="w-2 h-8 bg-green-500 rounded mr-3"></span>
                            Rapid Fuel Entry
                        </h2>
                        <form onSubmit={handleSingleSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label htmlFor="branchFilter" className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Filter by Branch</label>
                                    <select id="branchFilter" value={branchFilter} onChange={e => setBranchFilter(e.target.value)} className="w-full bg-gray-700 text-white p-3 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-secondary">
                                        <option value="All">All Branches</option>
                                        {availableBranches.map(b => <option key={b} value={b}>{b}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="vehicleId" className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Vehicle Registration</label>
                                    <select id="vehicleId" value={vehicleId} onChange={e => setVehicleId(e.target.value)} required className="w-full bg-gray-700 text-white p-3 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-secondary">
                                        <option value="" disabled>Select a vehicle</option>
                                        {filteredVehicles.map(v => (
                                            <option key={v.id} value={v.id}>{v.registration} ({v.name})</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                <div>
                                    <label htmlFor="date" className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Date</label>
                                    <input id="date" type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-gray-700 text-white p-3 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-secondary" />
                                </div>
                                <div>
                                    <label htmlFor="odometer" className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Odometer (km)</label>
                                    <input id="odometer" type="number" required placeholder="e.g., 12500" value={odometer} onChange={e => setOdometer(e.target.value)} className="w-full bg-gray-700 text-white p-3 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-secondary" />
                                </div>
                                <div>
                                    <label htmlFor="liters" className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Fuel (Liters)</label>
                                    <input id="liters" type="number" required placeholder="e.g., 55.5" value={liters} onChange={e => setLiters(e.target.value)} className="w-full bg-gray-700 text-white p-3 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-secondary" step="0.01" />
                                </div>
                                <div>
                                    <label htmlFor="sourceBowserId" className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Fuel Source</label>
                                    <select id="sourceBowserId" value={sourceBowserId} onChange={e => setSourceBowserId(e.target.value)} className="w-full bg-gray-700 text-white p-3 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-secondary">
                                        <option value="">Commercial Station</option>
                                        {bowsers.map(b => (
                                            <option key={b.id} value={b.id}>Internal: {b.name} ({b.currentStock.toLocaleString()}L available)</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="pt-2">
                                <button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white font-black py-3 px-4 rounded-lg transition-all active:scale-95 uppercase tracking-widest shadow-lg shadow-green-900/30">
                                    Log Fuel Entry
                                </button>
                            </div>
                        </form>
                    </div>
                ) : (
                    <div>
                         <h2 className="text-3xl font-black text-white mb-6 flex items-center">
                            <span className="w-2 h-8 bg-blue-500 rounded mr-3"></span>
                            Bulk Fuel Upload
                         </h2>
                         <div className="space-y-6">
                            <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-700/50">
                                <h3 className="font-bold text-white mb-2">Upload via Excel</h3>
                                <p className="text-sm text-gray-400 mb-4">Upload an .xlsx or .xls file. The system automatically detects headers like "Reg", "Date", "Odometer", and "Liters".</p>
                                <div className="flex flex-wrap gap-2 mb-6">
                                    {['Registration', 'Date', 'Odometer', 'Liters', 'Source (Optional)'].map(header => (
                                        <span key={header} className="font-mono text-[10px] bg-gray-800 border border-gray-700 text-gray-200 py-1 px-2 rounded uppercase tracking-tighter">{header}</span>
                                    ))}
                                </div>
                                <label className="flex flex-col items-center justify-center w-full h-32 bg-gray-800 rounded-xl border-2 border-dashed border-gray-700 cursor-pointer hover:border-blue-500 hover:bg-gray-700/50 transition-all group">
                                    <TableIcon className="h-8 w-8 text-gray-500 mb-2 group-hover:text-blue-400 group-hover:scale-110 transition-all" />
                                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Click to select file</span>
                                    <input id="bulk-upload" type="file" onChange={handleFileChange} className="hidden" accept=".xlsx, .xls, .csv"/>
                                </label>
                            </div>
                             <div className="relative">
                                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                    <div className="w-full border-t border-gray-700"></div>
                                </div>
                                <div className="relative flex justify-center">
                                    <span className="bg-gray-800 px-3 text-xs font-black text-gray-500 uppercase tracking-widest">Or</span>
                                </div>
                             </div>
                            <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-700/50">
                                 <h3 className="font-bold text-white mb-2">Google Sheets Synchronization</h3>
                                 <p className="text-sm text-gray-400 mb-4">Automate your fuel logging by connecting a live Google Sheet. Data will sync directly to the fleet ledger.</p>
                                  {isSheetConnected ? (
                                    <button 
                                        onClick={onSyncNow} 
                                        disabled={isSyncing}
                                        className="w-full flex items-center justify-center font-black py-3 px-4 rounded-xl transition-all bg-emerald-600 hover:bg-emerald-700 text-white uppercase tracking-widest text-xs shadow-lg shadow-emerald-900/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
                                        <RefreshIcon className={`h-5 w-5 mr-3 ${isSyncing ? 'animate-spin' : ''}`} />
                                        {isSyncing ? 'Synchronizing...' : 'Sync Data Now'}
                                    </button>
                                  ) : (
                                    <button 
                                        onClick={onConnectSheet} 
                                        className="w-full flex items-center justify-center font-black py-3 px-4 rounded-xl transition-all bg-gray-700 hover:bg-gray-600 text-emerald-400 border border-emerald-500/20 uppercase tracking-widest text-xs shadow-lg active:scale-95">
                                        <LinkIcon className="h-5 w-5 mr-3" />
                                        Connect Google Sheet
                                    </button>
                                  )}
                                {!isSheetConnected && <p className="text-[10px] text-yellow-500/80 mt-3 font-bold uppercase tracking-wider text-center">Connection required to enable real-time cloud sync.</p>}
                            </div>
                         </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FuelFillingForm;
