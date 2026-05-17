import React, { useState } from 'react';
import { LoadConfirmation, Client, Quote } from '../../types';
import { useUIState, useFleetData } from '../../contexts/AppContexts';
import AddressAutocompleteInput from './AddressAutocompleteInput';
import { LOAD_SPECS } from '../../constants';

interface CreateBookingFormProps {
    clients: Client[];
    onSubmit: (data: Omit<LoadConfirmation, 'id' | 'loadConNumber' | 'status' | 'date'>) => void;
    quoteData?: Quote;
}

const CreateBookingForm: React.FC<CreateBookingFormProps> = ({ clients, onSubmit, quoteData }) => {
    const { hideModal } = useUIState();
    const { commodities, packagingTypes, handleAddCommodity, handleAddPackagingType } = useFleetData();

    const [clientId, setClientId] = useState(quoteData?.clientId || '');
    const [collectionPoint, setCollectionPoint] = useState(quoteData?.legs[0]?.collectionPoint || '');
    const [deliveryPoint, setDeliveryPoint] = useState(quoteData?.legs[0]?.deliveryPoint || '');
    const [collectionDate, setCollectionDate] = useState(quoteData?.collectionDate?.split('T')[0] || new Date().toISOString().split('T')[0]);
    const [customerOrderNumber, setCustomerOrderNumber] = useState(quoteData?.customerOrderNumber || '');
    const [description, setDescription] = useState(quoteData?.items.map(i => `${i.quantity}x ${i.description}`).join(', ') || '');
    const [totalAmount, setTotalAmount] = useState(quoteData?.totalAmount.toString() || '');
    const [priority, setPriority] = useState<'Medium' | 'Low' | 'High'>(quoteData?.status === 'Accepted' ? 'High' : 'Medium');
    
    // New fields
    const [commodity, setCommodity] = useState(quoteData?.commodity || commodities[0]);
    const [packaging, setPackaging] = useState(quoteData?.packaging || packagingTypes[0]);
    const [loadSpec, setLoadSpec] = useState(quoteData?.loadSpec || LOAD_SPECS[0]);
    
    const [showNewCommodity, setShowNewCommodity] = useState(false);
    const [newCommodity, setNewCommodity] = useState('');
    const [showNewPackaging, setShowNewPackaging] = useState(false);
    const [newPackaging, setNewPackaging] = useState('');

    const handleAddNewCommodity = () => {
        if (newCommodity.trim()) {
            handleAddCommodity(newCommodity.trim());
            setCommodity(newCommodity.trim());
            setNewCommodity('');
            setShowNewCommodity(false);
        }
    };

    const handleAddNewPackaging = () => {
        if (newPackaging.trim()) {
            handleAddPackagingType(newPackaging.trim());
            setPackaging(newPackaging.trim());
            setNewPackaging('');
            setShowNewPackaging(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!clientId || !collectionPoint || !deliveryPoint || !description || !totalAmount) {
            alert('Please fill all required fields.');
            return;
        }

        const client = clients.find(c => c.id === clientId);
        if (!client) return;

        const bookingData: Omit<LoadConfirmation, 'id' | 'loadConNumber' | 'status' | 'date'> = {
            quoteId: quoteData?.id,
            clientId,
            items: quoteData?.items || [{
                id: 'item-1',
                description,
                packagingType: packaging,
                quantity: 1,
                rate: parseFloat(totalAmount),
                total: parseFloat(totalAmount)
            }],
            legs: quoteData?.legs || [{ id: 'leg-1', collectionPoint, deliveryPoint, movementType: 'Internal' }],
            totalAmount: parseFloat(totalAmount),
            collectionBranch: 'FBN JHB', 
            destinationBranch: 'FBN DBN',
            priority,
            collectionPoint,
            deliveryPoint,
            collectionDate,
            customerOrderNumber: customerOrderNumber || undefined,
            commodity,
            packaging,
            loadSpec,
        };

        onSubmit(bookingData);
        hideModal();
    };

    const inputClasses = "w-full bg-gray-700 text-white p-3 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-secondary text-sm";
    const labelClasses = "block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1";

    return (
        <form onSubmit={handleSubmit} className="p-2">
            <h2 className="text-2xl font-black text-white mb-6 flex items-center">
                <span className="w-2 h-8 bg-green-500 rounded mr-3"></span>
                {quoteData ? 'Confirm System Booking' : 'New Collection Booking'}
            </h2>
            
            <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-4 custom-scrollbar">
                {/* Client & Date Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className={labelClasses}>Bill-to Client</label>
                        <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={inputClasses} required disabled={!!quoteData}>
                            <option value="" disabled>-- Select Client --</option>
                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className={labelClasses}>Requested Collection Date</label>
                        <input type="date" value={collectionDate} onChange={e => setCollectionDate(e.target.value)} className={inputClasses} required />
                    </div>
                </div>

                {/* Route Section */}
                <div className="bg-gray-800/40 p-4 rounded-xl border border-gray-700/50">
                    <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-4">Route Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className={labelClasses}>Collection Address</label>
                            <AddressAutocompleteInput value={collectionPoint} onChange={setCollectionPoint} placeholder="Search address..." className={inputClasses} required />
                        </div>
                        <div>
                            <label className={labelClasses}>Delivery Address</label>
                            <AddressAutocompleteInput value={deliveryPoint} onChange={setDeliveryPoint} placeholder="Search address..." className={inputClasses} required />
                        </div>
                    </div>
                </div>

                {/* Cargo Specs Section */}
                <div className="bg-gray-800/40 p-4 rounded-xl border border-gray-700/50">
                    <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-4">Cargo Specifications</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <div className="flex justify-between items-center mb-1.5">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Commodity</label>
                                <button type="button" onClick={() => setShowNewCommodity(!showNewCommodity)} className="text-[10px] text-blue-400 font-bold hover:underline">
                                    {showNewCommodity ? 'Cancel' : '+ New'}
                                </button>
                            </div>
                            {showNewCommodity ? (
                                <div className="flex gap-2">
                                    <input type="text" value={newCommodity} onChange={e => setNewCommodity(e.target.value)} className={inputClasses} placeholder="..." />
                                    <button type="button" onClick={handleAddNewCommodity} className="bg-blue-600 px-3 rounded-md text-xs font-bold">Add</button>
                                </div>
                            ) : (
                                <select value={commodity} onChange={e => setCommodity(e.target.value)} className={inputClasses}>
                                    {commodities.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            )}
                        </div>
                        <div>
                             <div className="flex justify-between items-center mb-1.5">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Packaging</label>
                                <button type="button" onClick={() => setShowNewPackaging(!showNewPackaging)} className="text-[10px] text-blue-400 font-bold hover:underline">
                                    {showNewPackaging ? 'Cancel' : '+ New'}
                                </button>
                            </div>
                            {showNewPackaging ? (
                                <div className="flex gap-2">
                                    <input type="text" value={newPackaging} onChange={e => setNewPackaging(e.target.value)} className={inputClasses} placeholder="..." />
                                    <button type="button" onClick={handleAddNewPackaging} className="bg-blue-600 px-3 rounded-md text-xs font-bold">Add</button>
                                </div>
                            ) : (
                                <select value={packaging} onChange={e => setPackaging(e.target.value)} className={inputClasses}>
                                    {/* Fix: Resolved syntax error by changing 'key(p)' to 'key={p}' */}
                                    {packagingTypes.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            )}
                        </div>
                        <div>
                            <label className={labelClasses}>Vehicle Spec</label>
                            <select value={loadSpec} onChange={e => setLoadSpec(e.target.value as any)} className={inputClasses}>
                                {LOAD_SPECS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Financial & Priority */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="col-span-1">
                        <label className={labelClasses}>Agreed Rate (Excl. VAT)</label>
                        <div className="relative">
                            <span className="absolute left-3 top-3 text-gray-500 font-mono text-xs">R</span>
                            <input type="number" value={totalAmount} onChange={e => setTotalAmount(e.target.value)} className={`${inputClasses} pl-7`} required placeholder="0.00" />
                        </div>
                    </div>
                    <div>
                        <label className={labelClasses}>Customer PO #</label>
                        <input type="text" value={customerOrderNumber} onChange={e => setCustomerOrderNumber(e.target.value)} className={inputClasses} placeholder="Optional Ref" />
                    </div>
                    <div>
                        <label className={labelClasses}>Load Priority</label>
                        <select value={priority} onChange={e => setPriority(e.target.value as any)} className={inputClasses}>
                            <option value="Low">Low Priority</option>
                            <option value="Medium">Medium Priority</option>
                            <option value="High">High Priority</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label className={labelClasses}>Cargo Description / Handling Notes</label>
                    <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className={inputClasses} required placeholder="Detailed manifest description..." />
                </div>
            </div>

            <div className="flex justify-end space-x-3 mt-8 pt-6 border-t border-gray-700">
                <button type="button" onClick={hideModal} className="px-6 py-2.5 text-sm font-bold text-gray-400 hover:text-white transition-colors">Cancel</button>
                <button type="submit" className="bg-green-600 hover:bg-green-700 text-white font-black py-2.5 px-10 rounded-xl shadow-lg shadow-green-900/20 transition-all active:scale-95 uppercase tracking-wider">
                    Confirm & Book Load
                </button>
            </div>
        </form>
    );
};

export default CreateBookingForm;