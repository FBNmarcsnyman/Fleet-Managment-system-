import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Vehicle, LoadConfirmation, Quote, Client, Supplier } from '../../types';
import { CarIcon } from '../icons/CarIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { DocumentTextIcon } from '../icons/DocumentTextIcon';
import { SearchIcon } from '../icons/SearchIcon';
import { useUIState, useOperations, useVehicles } from '../../contexts/AppContexts';

// Universal search: loads (waybill/ref/PO/client/route/commodity/subbie/driver/reg/container),
// quotes, clients, subbies and vehicles. Tap a result to open it.
const GlobalSearch: React.FC = () => {
    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    const { vehicles = [], handleSelectVehicle } = useVehicles() as any;
    const { loadConfirmations = [], quotes = [], clients = [], suppliers = [] } = useOperations() as any;
    const { handleViewChange, showModal } = useUIState();

    useEffect(() => {
        const onClick = (e: MouseEvent) => { if (searchRef.current && !searchRef.current.contains(e.target as Node)) setIsOpen(false); };
        document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, []);

    const clientName = (id?: string) => (clients as Client[]).find(c => c.id === id)?.name || '';

    const results = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (q.length < 2) return { vehicles: [], loads: [], quotes: [], clients: [], subbies: [] };
        const has = (...vals: any[]) => vals.filter(Boolean).join(' ').toLowerCase().includes(q);

        return {
            vehicles: (vehicles as Vehicle[]).filter(v => has(v.name, v.registration, v.make, v.model, v.vin)).slice(0, 6),
            loads: (loadConfirmations as LoadConfirmation[]).filter((l: any) => has(
                l.loadConNumber, l.loadRefNo, l.customerOrderNumber, l.clientName, l.collectionPoint, l.deliveryPoint,
                l.route, l.commodity, l.subcontractorName, l.subcontractorDriverName, l.subcontractorDriverCell,
                l.subcontractorVehicleReg, l.containerNo, l.invoiceNumber,
            )).slice(0, 8),
            quotes: (quotes as Quote[]).filter((qt: any) => has(qt.quoteNumber, qt.commodity, clientName(qt.clientId), qt.customerOrderNumber)).slice(0, 6),
            clients: (clients as Client[]).filter((c: any) => has(c.name, c.contactPerson, c.contactEmail, c.contactPhone)).slice(0, 5),
            subbies: (suppliers as Supplier[]).filter((s: any) => s.type === 'Transport' && has(s.name, s.contactPerson, s.contactEmail, s.regions)).slice(0, 5),
        };
    }, [query, vehicles, loadConfirmations, quotes, clients, suppliers]);

    const hasResults = results.vehicles.length || results.loads.length || results.quotes.length || results.clients.length || results.subbies.length;

    const close = () => { setIsOpen(false); setQuery(''); };
    const openLoad = (l: LoadConfirmation) => { close(); showModal('loadDetail', { loadCon: l }); };
    const openQuote = (qt: Quote) => { close(); try { sessionStorage.setItem('fbn_pendingQuote', qt.id); } catch { /* ignore */ } handleViewChange('quotes'); };
    const openVehicle = (id: string) => { close(); handleViewChange('fleet'); handleSelectVehicle?.(id); };
    const openPartners = () => { close(); handleViewChange('partners'); };

    const Group: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
        <div className="border-b border-gray-700/50 last:border-0">
            <div className="px-4 py-2 text-[10px] font-black tracking-widest text-gray-500 uppercase bg-gray-900/40">{title}</div>
            {children}
        </div>
    );
    const Row: React.FC<{ onClick: () => void; accent: string; icon: React.ReactNode; title: string; sub?: string }> = ({ onClick, accent, icon, title, sub }) => (
        <div onClick={onClick} className="px-4 py-2.5 hover:bg-gray-700/40 cursor-pointer flex items-center group transition-all">
            <div className={`p-2 rounded-lg mr-3 ${accent}`}>{icon}</div>
            <div className="truncate min-w-0">
                <p className="text-sm font-bold text-gray-100 truncate">{title}</p>
                {sub && <p className="text-xs text-gray-500 truncate">{sub}</p>}
            </div>
        </div>
    );

    return (
        <div className="relative hidden md:block w-full max-w-md transition-all duration-300 focus-within:max-w-lg" ref={searchRef}>
            <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <SearchIcon className="h-4.5 w-4.5 text-gray-500 group-focus-within:text-blue-400 transition-colors" />
                </div>
                <input
                    type="text"
                    className="bg-gray-800/40 text-white text-sm rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:bg-gray-800 block w-full pl-11 p-2.5 border border-gray-700/50 focus:border-blue-500/50 placeholder-gray-500 transition-all duration-200"
                    placeholder="Search loads, quotes, reg, PO, client…"
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
                    onFocus={() => setIsOpen(true)}
                />
                {query && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer" onClick={close}>
                        <span className="text-[10px] font-bold bg-gray-700/50 px-1.5 py-0.5 rounded text-gray-400 hover:text-white transition-colors uppercase">Clear</span>
                    </div>
                )}
            </div>

            {isOpen && query.trim().length >= 2 && (
                <div className="absolute top-full mt-3 w-full bg-gray-800/98 backdrop-blur-2xl rounded-2xl shadow-2xl border border-gray-700/60 overflow-hidden z-50 max-h-[34rem] overflow-y-auto ring-1 ring-black/40">
                    {!hasResults && <div className="p-6 text-gray-400 text-sm text-center italic">No matching records found.</div>}

                    {results.loads.length > 0 && (
                        <Group title="Loads / Waybills">
                            {results.loads.map((l: any) => (
                                <Row key={l.id} onClick={() => openLoad(l)} accent="bg-emerald-900/20"
                                    icon={<DocumentTextIcon className="h-4 w-4 text-emerald-400" />}
                                    title={`${l.loadConNumber}${l.clientName ? ' · ' + l.clientName : ''}`}
                                    sub={`${l.collectionPoint || ''} → ${l.deliveryPoint || ''}${l.subcontractorName ? ' · ' + l.subcontractorName : ''}${l.customerOrderNumber ? ' · PO ' + l.customerOrderNumber : ''}`} />
                            ))}
                        </Group>
                    )}
                    {results.quotes.length > 0 && (
                        <Group title="Quotes">
                            {results.quotes.map((qt: any) => (
                                <Row key={qt.id} onClick={() => openQuote(qt)} accent="bg-amber-900/20"
                                    icon={<DocumentTextIcon className="h-4 w-4 text-amber-400" />}
                                    title={`${qt.quoteNumber} · ${clientName(qt.clientId) || 'Quote'}`}
                                    sub={`${qt.status}${qt.commodity ? ' · ' + qt.commodity : ''}${qt.totalAmount ? ' · R ' + Number(qt.totalAmount).toLocaleString() : ''}`} />
                            ))}
                        </Group>
                    )}
                    {results.vehicles.length > 0 && (
                        <Group title="Vehicles">
                            {results.vehicles.map((v: Vehicle) => (
                                <Row key={v.id} onClick={() => openVehicle(v.id)} accent="bg-blue-900/20"
                                    icon={<CarIcon className="h-4 w-4 text-blue-400" />} title={v.registration} sub={v.name} />
                            ))}
                        </Group>
                    )}
                    {results.clients.length > 0 && (
                        <Group title="Clients">
                            {results.clients.map((c: any) => (
                                <Row key={c.id} onClick={openPartners} accent="bg-indigo-900/20"
                                    icon={<UsersIcon className="h-4 w-4 text-indigo-400" />} title={c.name} sub={[c.contactPerson, c.contactEmail].filter(Boolean).join(' · ')} />
                            ))}
                        </Group>
                    )}
                    {results.subbies.length > 0 && (
                        <Group title="Subcontractors">
                            {results.subbies.map((s: any) => (
                                <Row key={s.id} onClick={openPartners} accent="bg-purple-900/20"
                                    icon={<UsersIcon className="h-4 w-4 text-purple-400" />} title={s.name} sub={[s.regions, s.contactEmail].filter(Boolean).join(' · ')} />
                            ))}
                        </Group>
                    )}
                </div>
            )}
        </div>
    );
};

export default GlobalSearch;
