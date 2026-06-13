import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Vehicle, LoadConfirmation, JobCard, User } from '../../types';
import { CarIcon } from '../icons/CarIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { WorkshopIcon } from '../icons/WorkshopIcon';
import { DocumentTextIcon } from '../icons/DocumentTextIcon';
import { SearchIcon } from '../icons/SearchIcon';
import { useUIState, useOperations, useVehicles, useWorkshop } from '../../contexts/AppContexts';

const GlobalSearch: React.FC = () => {
    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    const { vehicles = [], handleSelectVehicle } = useVehicles();
    const { loadConfirmations = [] } = useOperations();
    const { jobCards = [], users = [] } = useWorkshop();
    const { handleViewChange, showModal } = useUIState();

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const results = useMemo(() => {
        if (!query || query.length < 2) return { vehicles: [], loads: [], jobs: [], users: [] };
        const q = query.toLowerCase();

        return {
            vehicles: (vehicles || []).filter((v: Vehicle) => v.name.toLowerCase().includes(q) || v.registration.toLowerCase().includes(q)).slice(0, 3),
            loads: (loadConfirmations || []).filter((l: LoadConfirmation) => l.loadConNumber.toLowerCase().includes(q) || l.collectionPoint.toLowerCase().includes(q) || l.deliveryPoint.toLowerCase().includes(q)).slice(0, 3),
            jobs: (jobCards || []).filter((j: JobCard) => j.itemDescription.toLowerCase().includes(q) || j.id.toLowerCase().includes(q)).slice(0, 3),
            users: (users || []).filter((u: User) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)).slice(0, 3),
        };
    }, [query, vehicles, loadConfirmations, jobCards, users]);

    const hasResults = results.vehicles.length > 0 || results.loads.length > 0 || results.jobs.length > 0 || results.users.length > 0;

    const handleNavigate = (type: 'vehicle' | 'load' | 'job' | 'user', id: string) => {
        setIsOpen(false);
        setQuery('');

        switch (type) {
            case 'vehicle':
                handleViewChange('fleet');
                handleSelectVehicle(id);
                break;
            case 'load':
                handleViewChange('operations');
                break;
            case 'job':
                handleViewChange('workshop');
                showModal('jobCardDetail', { jobCardId: id });
                break;
            case 'user':
                handleViewChange('userManagement');
                break;
        }
    };

    return (
        <div className="relative hidden md:block w-full max-w-md transition-all duration-300 focus-within:max-w-lg" ref={searchRef}>
            <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <SearchIcon className="h-4.5 w-4.5 text-gray-500 group-focus-within:text-blue-400 transition-colors" />
                </div>
                <input
                    type="text"
                    className="bg-gray-800/40 text-white text-sm rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:bg-gray-800 block w-full pl-11 p-2.5 border border-gray-700/50 focus:border-blue-500/50 placeholder-gray-500 transition-all duration-200"
                    placeholder="Search anything..."
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
                    onFocus={() => setIsOpen(true)}
                />
                {query && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer" onClick={() => { setQuery(''); setIsOpen(false); }}>
                        <span className="text-[10px] font-bold bg-gray-700/50 px-1.5 py-0.5 rounded text-gray-400 hover:text-white transition-colors uppercase">Clear</span>
                    </div>
                )}
            </div>

            {isOpen && query && (
                <div className="absolute top-full mt-3 w-full bg-gray-800/98 backdrop-blur-2xl rounded-2xl shadow-2xl border border-gray-700/60 overflow-hidden z-50 max-h-[32rem] overflow-y-auto ring-1 ring-black/40 animate-fade-in-down">
                    {!hasResults && <div className="p-6 text-gray-400 text-sm text-center italic">No matching records found.</div>}

                    {results.vehicles.length > 0 && (
                        <div className="border-b border-gray-700/50 last:border-0">
                            <div className="px-4 py-2.5 text-[10px] font-black tracking-widest text-gray-500 uppercase bg-gray-900/40">Vehicles</div>
                            {results.vehicles.map(v => (
                                <div key={v.id} onClick={() => handleNavigate('vehicle', v.id)} className="px-4 py-3 hover:bg-blue-600/10 cursor-pointer flex items-center group transition-all">
                                    <div className="p-2 bg-blue-900/20 rounded-lg mr-3.5 group-hover:bg-blue-600/20 transition-colors">
                                        <CarIcon className="h-4 w-4 text-blue-400" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-100 group-hover:text-blue-400 transition-colors">{v.registration}</p>
                                        <p className="text-xs text-gray-500 group-hover:text-gray-400">{v.name}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {results.loads.length > 0 && (
                        <div className="border-b border-gray-700/50 last:border-0">
                            <div className="px-4 py-2.5 text-[10px] font-black tracking-widest text-gray-500 uppercase bg-gray-900/40">Loads</div>
                            {results.loads.map(l => (
                                <div key={l.id} onClick={() => handleNavigate('load', l.id)} className="px-4 py-3 hover:bg-emerald-600/10 cursor-pointer flex items-center group transition-all">
                                    <div className="p-2 bg-emerald-900/20 rounded-lg mr-3.5 group-hover:bg-emerald-600/20 transition-colors">
                                        <DocumentTextIcon className="h-4 w-4 text-emerald-400" />
                                    </div>
                                    <div className="truncate min-w-0">
                                        <p className="text-sm font-bold text-gray-100 group-hover:text-emerald-400 transition-colors">{l.loadConNumber}</p>
                                        <p className="text-xs text-gray-500 truncate">{l.collectionPoint} &rarr; {l.deliveryPoint}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {results.jobs.length > 0 && (
                        <div className="border-b border-gray-700/50 last:border-0">
                            <div className="px-4 py-2.5 text-[10px] font-black tracking-widest text-gray-500 uppercase bg-gray-900/40">Work Orders</div>
                            {results.jobs.map(j => (
                                <div key={j.id} onClick={() => handleNavigate('job', j.id)} className="px-4 py-3 hover:bg-orange-600/10 cursor-pointer flex items-center group transition-all">
                                    <div className="p-2 bg-orange-900/20 rounded-lg mr-3.5 group-hover:bg-orange-600/20 transition-colors">
                                        <WorkshopIcon className="h-4 w-4 text-orange-400" />
                                    </div>
                                    <div className="truncate min-w-0">
                                        <p className="text-sm font-bold text-gray-100 group-hover:text-orange-400 transition-colors truncate">{j.itemDescription}</p>
                                        <p className="text-xs text-gray-500">{j.status} • {j.priority} Priority</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {results.users.length > 0 && (
                        <div className="border-b border-gray-700/50 last:border-0">
                            <div className="px-4 py-2.5 text-[10px] font-black tracking-widest text-gray-500 uppercase bg-gray-900/40">Personnel</div>
                            {results.users.map(u => (
                                <div key={u.email} onClick={() => handleNavigate('user', u.email)} className="px-4 py-3 hover:bg-purple-600/10 cursor-pointer flex items-center group transition-all">
                                    <div className="p-2 bg-purple-900/20 rounded-lg mr-3.5 group-hover:bg-purple-600/20 transition-colors">
                                        <UsersIcon className="h-4 w-4 text-purple-400" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-100 group-hover:text-purple-400 transition-colors">{u.name}</p>
                                        <p className="text-xs text-gray-500">{u.role}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default GlobalSearch;
