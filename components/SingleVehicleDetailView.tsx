import React, { useMemo, useState } from 'react';
import { Vehicle, ServiceInterval, ServiceStatus } from '../types';
import { useVehicles, useWorkshop, useUIState, useAuth, useOperations } from '../contexts/AppContexts';
import StatCard from './StatCard';
import { BackIcon } from './icons/BackIcon';
import { ChartBarIcon } from './icons/ChartBarIcon';
import { FuelIcon } from './icons/FuelIcon';
import { WrenchIcon } from './icons/WrenchIcon';
import { SparklesIcon } from './icons/SparklesIcon';
import CostBreakdownChart from './charts/CostBreakdownChart';
import VehicleCostTrendChart from './charts/VehicleCostTrendChart';
import FuelConsumptionAnalysis from './FuelConsumptionAnalysis';
import VehicleChat from './VehicleChat';
// Fix: Import the AIInsights component which was being used in the 'ai' tab but was missing an import
import AIInsights from './AIInsights';
import { format } from 'date-fns';
import { EyeIcon } from './icons/EyeIcon';
import { ClipboardDocumentListIcon } from './icons/ClipboardDocumentListIcon';
import { RouteIcon } from './icons/RouteIcon';
import { TrashIcon } from './icons/TrashIcon';
import { SpeedometerIcon } from './icons/SpeedometerIcon';

type DetailViewTab = 'overview' | 'financials' | 'performance' | 'maintenance' | 'checklists' | 'operations' | 'ai';

const DetailItem: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
    <div className="flex justify-between border-b border-gray-700/50 py-2">
        <span className="text-gray-400 text-sm">{label}</span>
        <span className="font-semibold text-white text-sm text-right">{value || 'N/A'}</span>
    </div>
);

const PerformancePill: React.FC<{ label: string; value: string; color: string; icon: React.ElementType }> = ({ label, value, color, icon: Icon }) => (
    <div className={`bg-gray-800/60 border border-gray-700 rounded-xl p-3 flex items-center space-x-4 flex-1`}>
        <div className={`p-2 rounded-lg ${color}`}>
            <Icon className="h-5 w-5 text-white" />
        </div>
        <div>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none mb-1">{label}</p>
            <p className="text-sm font-black text-white leading-none">{value}</p>
        </div>
    </div>
);

const SingleVehicleDetailView: React.FC<{ vehicle: Vehicle; isEmbedded?: boolean; }> = ({ vehicle, isEmbedded = false }) => {
    // Trailers don't have their own engine so fuel consumption, average
    // L/100km, and "Log Fuel" don't make sense for them - fuel burns on
    // the horse pulling them. We still surface mileage (odometer for
    // service intervals), services, tires, revenue, costs, and checklists.
    const isTrailer = (vehicle.weightCategory || '').toLowerCase().includes('trailer');
    const [activeTab, setActiveTab] = useState<DetailViewTab>('overview');
    const { currentUser } = useAuth();
    const { 
        handleSelectVehicle, 
        fuelEntriesWithCost = [], 
        serviceEntries = [], 
        generatedOtherCosts = [],
        revenueEntries = [],
        calculatedFuelData = [],
        recurringCosts = [],
        messages = [],
        serviceIntervals = [],
        serviceStatuses = new Map(),
        handleAddFuelEntry,
        handleAddServiceEntry,
        handleAddOtherCost,
        handleAddRecurringCost,
        handleAddRevenue,
        handleAddServiceInterval,
        handleDeleteServiceInterval,
        handleSendMessage,
        vehiclePerformanceMap = new Map()
    } = useVehicles();
    const { jobCards = [], handleCreateJobCard, checklistSubmissions = [] } = useWorkshop();
    const { showModal, hideModal } = useUIState();
    const { loadConfirmations = [], clients = [] } = useOperations();

    const clientMap = useMemo(() => new Map((clients || []).map(c => [c.id, c.name])), [clients]);

    const performance = useMemo(() => {
        return vehiclePerformanceMap.get(vehicle.id) || { avgCpk: 0, avgConsumption: 0, latestOdo: vehicle.currentOdometer || 0 };
    }, [vehiclePerformanceMap, vehicle.id, vehicle.currentOdometer]);

    const vehicleData = useMemo(() => {
        const id = vehicle.id;
        const filteredJobs = (jobCards || []).filter((e: any) => e.vehicleId === id);
        return {
            fuel: (fuelEntriesWithCost || []).filter((e: any) => e.vehicleId === id),
            services: (serviceEntries || []).filter((e: any) => e.vehicleId === id),
            otherCosts: (generatedOtherCosts || []).filter((c: any) => c.vehicleId === id),
            revenue: (revenueEntries || []).filter((e: any) => e.vehicleId === id),
            jobs: filteredJobs,
            openJobs: filteredJobs.filter((j: any) => j.status !== 'Resolved'),
            calculatedFuel: (calculatedFuelData || []).filter((e: any) => e.vehicleId === id),
            recurring: (recurringCosts || []).filter((e: any) => e.vehicleId === id),
            messages: (messages || []).filter((e: any) => e.vehicleId === id),
            checklists: (checklistSubmissions || []).filter((cs: any) => cs.vehicleId === id),
            operations: (loadConfirmations || []).filter((lc: any) => lc.vehicleId === id),
            intervals: (serviceIntervals || []).filter((i: ServiceInterval) => i.vehicleId === id),
            statuses: serviceStatuses?.get(id) || [],
        };
    }, [vehicle.id, fuelEntriesWithCost, serviceEntries, generatedOtherCosts, revenueEntries, jobCards, calculatedFuelData, recurringCosts, messages, checklistSubmissions, loadConfirmations, serviceIntervals, serviceStatuses]);

    const financials = useMemo(() => {
        const totalFuelCost = vehicleData.fuel.reduce((s, e) => s + (e.cost || 0), 0);
        const totalServiceCost = vehicleData.services.reduce((s, e) => s + (e.cost || 0), 0);
        const totalOtherCost = vehicleData.otherCosts.reduce((s, e) => s + (e.amount || 0), 0);
        const totalCost = totalFuelCost + totalServiceCost + totalOtherCost;
        const totalRevenue = vehicleData.revenue.reduce((s, e) => s + (e.amount || 0), 0);
        const netProfit = totalRevenue - totalCost;
        return { totalCost, totalRevenue, netProfit };
    }, [vehicleData]);

    const openModal = (type: string, handler: (...args: any[]) => void) => {
        showModal(type, {
            onSubmit: (data: any) => { handler(vehicle.id, data); hideModal(); },
            onCancel: hideModal,
            vehicleId: vehicle.id, 
        });
    };
    
    const openCreateJobCardModal = () => showModal('createJobCard', { vehicleId: vehicle.id, onSubmit: handleCreateJobCard, onCancel: hideModal });
    const handleSendMessageForVehicle = (text: string) => {
        if (!currentUser) return;
        handleSendMessage(vehicle.id, { userId: currentUser.email, userName: currentUser.name, timestamp: new Date().toISOString(), text });
    };

    const formatCurrency = (val: number) => `R ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const TabButton: React.FC<{ tab: DetailViewTab, label: string, icon: React.ElementType }> = ({ tab, label, icon: Icon }) => (
        <button onClick={() => setActiveTab(tab)} className={`flex items-center space-x-2 px-3 sm:px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${activeTab === tab ? 'text-white border-brand-secondary' : 'text-gray-400 border-transparent hover:text-white hover:border-gray-500'}`}>
            <Icon className="h-5 w-5" />
            <span className="hidden sm:inline">{label}</span>
        </button>
    );

    const OverviewTab = () => (
        <div className="space-y-6">
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h2 className="text-3xl font-black text-white">{vehicle.name} <span className="text-lg font-normal text-gray-500">({vehicle.registration})</span></h2>
                        <div className="flex gap-2 mt-2">
                             <span className="text-[10px] font-black uppercase tracking-widest text-blue-400 bg-blue-900/20 px-2 py-1 rounded border border-blue-500/10">
                                {vehicle.branch}
                            </span>
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 bg-gray-900/40 px-2 py-1 rounded border border-gray-700">
                                {vehicle.weightCategory}
                            </span>
                        </div>
                    </div>
                    <div className="flex flex-col items-end">
                        <div className={`px-3 py-1 rounded border text-xs font-black uppercase tracking-widest mb-1 ${vehicle.status === 'On the road' ? 'text-green-400 border-green-500/20 bg-green-900/10' : 'text-yellow-400 border-yellow-500/20 bg-yellow-900/10'}`}>
                            {vehicle.status}
                        </div>
                         <div className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">Health: {vehicle.healthScore}%</div>
                    </div>
                </div>

                <div className="flex flex-wrap gap-4 mb-8">
                    <PerformancePill label="Running CPK" value={`R ${performance.avgCpk.toFixed(2)}`} color="bg-emerald-600" icon={ChartBarIcon} />
                    {!isTrailer && (
                        <PerformancePill label="Avg Consumption" value={`${performance.avgConsumption.toFixed(1)} L/100km`} color="bg-orange-600" icon={FuelIcon} />
                    )}
                    <PerformancePill label="Current Odometer" value={`${performance.latestOdo.toLocaleString()} km`} color="bg-blue-600" icon={SpeedometerIcon} />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard title="Total Revenue" value={formatCurrency(financials.totalRevenue)} />
                    <StatCard title="Total Costs" value={formatCurrency(financials.totalCost)} />
                    <StatCard title="Net Profit" value={formatCurrency(financials.netProfit)} />
                    <StatCard title="Open Job Cards" value={vehicleData.openJobs.length.toString()} />
                </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                    <h3 className="text-xl font-semibold text-white mb-4">Asset Identification</h3>
                    <div className="space-y-1">
                        <DetailItem label="Make & Model" value={`${vehicle.make} ${vehicle.model}`} />
                        <DetailItem label="Year" value={vehicle.year} />
                        <DetailItem label="VIN" value={vehicle.vin} />
                        <DetailItem label="Purchase Price" value={formatCurrency(vehicle.purchasePrice)} />
                    </div>
                </div>
                <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                    <h3 className="text-xl font-semibold text-white mb-4">Quick Actions</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {!isTrailer && (
                            <button onClick={() => openModal('addFuel', handleAddFuelEntry)} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-3 rounded-lg text-sm">Log Fuel</button>
                        )}
                        <button onClick={() => openModal('addService', handleAddServiceEntry)} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-3 rounded-lg text-sm">Log Service</button>
                        <button onClick={() => openModal('addRevenue', handleAddRevenue)} className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-3 rounded-lg text-sm">Log Revenue</button>
                        <button onClick={openCreateJobCardModal} className="bg-yellow-600 hover:bg-yellow-700 text-white font-semibold py-2 px-3 rounded-lg text-sm">New Job Card</button>
                        <button onClick={() => openModal('addCost', handleAddOtherCost)} className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-3 rounded-lg text-sm">Log Cost</button>
                        <button onClick={() => openModal('addInterval', handleAddServiceInterval)} className="bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-3 rounded-lg text-sm">Set Interval</button>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderTabContent = () => {
        switch (activeTab) {
            case 'financials':
                return (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-gray-800 p-6 rounded-lg shadow-lg"><h3 className="text-xl font-semibold text-white mb-4">Monthly Cost Trend</h3><VehicleCostTrendChart fuelEntries={vehicleData.fuel} otherCosts={vehicleData.otherCosts} serviceEntries={vehicleData.services} /></div>
                        <div className="bg-gray-800 p-6 rounded-lg shadow-lg"><h3 className="text-xl font-semibold text-white mb-4">Cost Breakdown</h3><CostBreakdownChart fuelData={vehicleData.fuel} otherData={vehicleData.otherCosts} serviceData={vehicleData.services} /></div>
                    </div>
                );
            case 'performance': return <FuelConsumptionAnalysis calculatedFuelData={vehicleData.calculatedFuel} />;
            case 'maintenance':
                return (
                    <div className="space-y-6">
                        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-semibold text-white">Active Service Intervals</h3>
                                <button onClick={() => openModal('addInterval', handleAddServiceInterval)} className="text-xs font-bold text-blue-400 hover:text-white uppercase tracking-widest">+ Add Interval</button>
                            </div>
                            <div className="space-y-3">
                                {vehicleData.intervals.length > 0 ? vehicleData.intervals.map((interval: ServiceInterval) => {
                                    const status = vehicleData.statuses.find((s: ServiceStatus) => s.description === interval.description);
                                    const statusColor = status?.status === 'Overdue' ? 'text-red-400' : status?.status === 'Due Soon' ? 'text-yellow-400' : 'text-green-400';
                                    
                                    return (
                                        <div key={interval.id} className="bg-gray-700/30 p-3 rounded-lg flex items-center justify-between border border-gray-700/50">
                                            <div>
                                                <p className="font-bold text-white">{interval.description}</p>
                                                <p className="text-xs text-gray-500 mt-0.5">
                                                    Limit: {interval.distanceInterval ? `${interval.distanceInterval.toLocaleString()}km ` : ''} 
                                                    {interval.timeIntervalDays ? `${interval.timeIntervalDays} days ` : ''}
                                                    {interval.hoursInterval ? `${interval.hoursInterval} hrs` : ''}
                                                </p>
                                            </div>
                                            <div className="flex items-center space-x-4">
                                                <div className="text-right">
                                                    <p className={`text-xs font-black uppercase ${statusColor}`}>{status?.status || 'Active'}</p>
                                                    <p className="text-[10px] text-gray-400">{status?.details}</p>
                                                </div>
                                                <button onClick={() => handleDeleteServiceInterval(interval.id)} className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-all" title="Remove Interval">
                                                    <TrashIcon className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                }) : <p className="text-center text-gray-500 py-8 text-sm">No service intervals configured for this asset.</p>}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-gray-800 p-6 rounded-lg shadow-lg"><h3 className="text-xl font-semibold text-white mb-4">Open Job Cards</h3><div className="space-y-2 max-h-96 overflow-y-auto">{vehicleData.openJobs.map((job: any) => (<div key={job.id} className="bg-gray-700/50 p-3 rounded-md flex justify-between items-start"><div><p className="font-semibold text-white">{job.itemDescription}</p><p className="text-xs text-gray-400">{job.status} - {job.priority} Priority</p></div><button onClick={() => showModal('jobCardDetail', { jobCardId: job.id })} className="text-xs font-semibold text-blue-400"><EyeIcon className="h-5 w-5"/></button></div>)) || <p>No open jobs.</p>}</div></div>
                            <div className="bg-gray-800 p-6 rounded-lg shadow-lg"><h3 className="text-xl font-semibold text-white mb-4">Service History</h3><div className="space-y-2 max-h-96 overflow-y-auto">{vehicleData.services.map((s: any) => (<div key={s.id} className="bg-gray-700/50 p-2 rounded-md"><div className="flex justify-between text-sm"><p>{s.description}</p><p className="font-mono">{format(new Date(s.date), 'dd MMM yyyy')}</p></div><div className="flex justify-between text-xs text-gray-400"><p>Odo: {s.endOdometer.toLocaleString()} km</p><p>Cost: {formatCurrency(s.cost)}</p></div></div>)) || <p>No service history.</p>}</div></div>
                        </div>
                    </div>
                );
            case 'checklists':
                return (
                    <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                        <h3 className="text-xl font-semibold text-white mb-4">Checklist History</h3>
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                            {vehicleData.checklists.length > 0 ? vehicleData.checklists.map((sub: any) => (
                                <div key={sub.id} className="bg-gray-700/50 p-3 rounded-md">
                                    <div className="flex justify-between items-center">
                                        <p className="font-semibold text-white">{sub.templateName}</p>
                                        <p className="text-xs text-gray-400">{format(new Date(sub.date), 'dd MMM yyyy, HH:mm')}</p>
                                    </div>
                                    <p className="text-sm text-gray-300">Submitted by: {sub.userName}</p>
                                </div>
                            )) : <p className="text-gray-500 text-center py-8">No checklist history for this vehicle.</p>}
                        </div>
                    </div>
                );
            case 'operations':
                return (
                     <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                        <h3 className="text-xl font-semibold text-white mb-4">Operations Log</h3>
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                            {vehicleData.operations.length > 0 ? vehicleData.operations.map((lc: any) => (
                                <div key={lc.id} className="bg-gray-700/50 p-3 rounded-md">
                                    <div className="flex justify-between items-center">
                                        <p className="font-semibold text-white font-mono">{lc.loadConNumber}</p>
                                        <p className="text-xs text-gray-400">{format(new Date(lc.date), 'dd MMM yyyy')}</p>
                                    </div>
                                    <p className="text-sm text-gray-300">{lc.collectionPoint} to {lc.deliveryPoint}</p>
                                    <p className="text-xs text-gray-400">Client: {clientMap.get(lc.clientId)} | Status: {lc.status}</p>
                                </div>
                            )) : <p className="text-gray-500 text-center py-8">No operational history for this vehicle.</p>}
                        </div>
                    </div>
                );
            case 'ai':
                return (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <AIInsights vehicle={vehicle} calculatedFuelData={vehicleData.calculatedFuel} serviceEntries={vehicleData.services} recurringCosts={vehicleData.recurring} jobCards={vehicleData.jobs} />
                        <div className="bg-gray-800 p-6 rounded-lg shadow-lg"><VehicleChat messages={vehicleData.messages} currentUser={currentUser!} onSendMessage={handleSendMessageForVehicle} /></div>
                    </div>
                );
            case 'overview': default: return <OverviewTab />;
        }
    };

    return (
        <div className="space-y-6">
            {!isEmbedded && <button onClick={() => handleSelectVehicle(null)} className="flex items-center text-brand-secondary hover:text-blue-400 font-semibold mb-2"><BackIcon className="h-5 w-5 mr-2" /> Back to Fleet List</button>}
            
            <div className="flex items-center space-x-1 border-b border-gray-700 overflow-x-auto no-scrollbar">
                <TabButton tab="overview" label="Overview" icon={EyeIcon} />
                <TabButton tab="financials" label="Financials" icon={ChartBarIcon} />
                {!isTrailer && <TabButton tab="performance" label="Performance" icon={FuelIcon} />}
                <TabButton tab="maintenance" label="Maintenance" icon={WrenchIcon} />
                <TabButton tab="checklists" label="Checklists" icon={ClipboardDocumentListIcon} />
                <TabButton tab="operations" label="Operations Log" icon={RouteIcon} />
                <TabButton tab="ai" label="AI & Comms" icon={SparklesIcon} />
            </div>

            {renderTabContent()}
        </div>
    );
};

export default SingleVehicleDetailView;