
import React, { useState, useEffect } from 'react';
import { Quote, Client, Supplier, QuoteItem, QuoteLeg, SubcontractorQuote } from '../../types';
import { addDays, format } from 'date-fns';
import { PlusIcon } from '../icons/PlusIcon';
import { TrashIcon } from '../icons/TrashIcon';
import AddressAutocompleteInput from './AddressAutocompleteInput';
import { useUIState, useFleetData } from '../../contexts/AppContexts';
import { LOAD_SPECS } from '../../constants';
import { MapPinIcon } from '../icons/MapPinIcon';

interface CreateQuoteFormProps {
    clients: Client[];
    suppliers: Supplier[];
    onSubmit: (quote: Omit<Quote, 'id' | 'quoteNumber' | 'status'> | Quote) => void;
    quoteData?: Quote;
    prefill?: Partial<Quote>;
}

const generateId = () => `id_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

const getInitialState = (quoteData?: Quote, commodities?: string[], packagingTypes?: string[], prefill?: Partial<Quote>) => {
    if (quoteData) {
        return {
            ...quoteData,
            date: format(new Date(quoteData.date), 'yyyy-MM-dd'),
            expiryDate: format(new Date(quoteData.expiryDate), 'yyyy-MM-dd'),
        };
    }
    return {
        clientId: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        expiryDate: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
        items: [{ id: generateId(), description: '', packagingType: (packagingTypes?.[0] || 'Pallets'), quantity: 1, rate: 0, total: 0 }],
        legs: [{ id: generateId(), collectionPoint: '', deliveryPoint: '', movementType: 'Internal' }],
        totalAmount: 0,
        sentToClient: false,
        commodity: commodities?.[0] || 'General Cargo',
        packaging: packagingTypes?.[0] || 'Pallets',
        loadSpec: LOAD_SPECS[0] as any,
        subcontractorQuotes: [] as SubcontractorQuote[],
        ...(prefill || {}),
    };
};

const CreateQuoteForm: React.FC<CreateQuoteFormProps> = ({ clients, suppliers, onSubmit, quoteData, prefill }) => {
    const { hideModal } = useUIState();
    const { commodities, packagingTypes, handleAddCommodity, handleAddPackagingType } = useFleetData();
    // Form state is the union of "new quote literal" and "loaded existing Quote".
    // Typed as `any` here because CreateQuoteForm uses many internal `as any`
    // casts and a fully typed shape requires a rewrite that's out of scope for
    // the typing-cleanup push.
    const [quote, setQuote] = useState<any>(() => getInitialState(quoteData, commodities, packagingTypes, prefill));
    
    const [showNewCommodityInput, setShowNewCommodityInput] = useState(false);
    const [newCommodity, setNewCommodity] = useState('');
    
    const [showNewPackagingInput, setShowNewPackagingInput] = useState(false);
    const [newPackaging, setNewPackaging] = useState('');

    const transportSuppliers = suppliers.filter(s => s.type === 'Transport');

    useEffect(() => {
        const total: number = (quote.items as QuoteItem[]).reduce(
            (sum: number, item: QuoteItem) => sum + (item.quantity * item.rate),
            0,
        );
        if (total !== quote.totalAmount) {
            setQuote((prev: any) => ({ ...prev, totalAmount: total }));
        }
    }, [quote.items, quote.totalAmount]);

    const handleFieldChange = (field: keyof Quote, value: any) => {
        setQuote(prev => ({ ...prev, [field]: value }));
    };

    const handleAddCustomCommodity = () => {
        if (newCommodity.trim()) {
            handleAddCommodity(newCommodity.trim());
            handleFieldChange('commodity', newCommodity.trim());
            setNewCommodity('');
            setShowNewCommodityInput(false);
        }
    };

    const handleAddCustomPackaging = () => {
        if (newPackaging.trim()) {
            handleAddPackagingType(newPackaging.trim());
            handleFieldChange('packaging', newPackaging.trim());
            setNewPackaging('');
            setShowNewPackagingInput(false);
        }
    };

    const handleSubQuoteChange = (index: number, field: keyof SubcontractorQuote, value: any) => {
        const newSubQuotes = [...quote.subcontractorQuotes];
        (newSubQuotes[index] as any)[field] = value;
        setQuote(prev => ({ ...prev, subcontractorQuotes: newSubQuotes }));
    };

    const addSubQuote = () => setQuote(prev => ({ 
        ...prev, 
        subcontractorQuotes: [...prev.subcontractorQuotes, { id: generateId(), supplierId: '', rate: 0, timestamp: new Date().toISOString() }] 
    }));

    const removeSubQuote = (index: number) => setQuote(prev => ({ 
        ...prev, 
        subcontractorQuotes: prev.subcontractorQuotes.filter((_, i) => i !== index) 
    }));

    // Leg Handlers
    const handleLegChange = (index: number, field: keyof QuoteLeg, value: any) => {
        const newLegs = [...quote.legs];
        (newLegs[index] as any)[field] = value;
        setQuote(prev => ({ ...prev, legs: newLegs }));
    };
    const addLeg = () => setQuote(prev => ({ ...prev, legs: [...prev.legs, { id: generateId(), collectionPoint: '', deliveryPoint: '', movementType: 'Internal' }] }));
    const removeLeg = (index: number) => setQuote(prev => ({ ...prev, legs: prev.legs.filter((_, i) => i !== index) }));

    // Item Handlers
    const handleItemChange = (index: number, field: keyof QuoteItem, value: any) => {
        const newItems = [...quote.items];
        const item = newItems[index];
        (item as any)[field] = value;
        if (field === 'quantity' || field === 'rate') {
            item.total = item.quantity * item.rate;
        }
        setQuote(prev => ({ ...prev, items: newItems }));
    };
    const addItem = () => setQuote(prev => ({ ...prev, items: [...prev.items, { id: generateId(), description: '', packagingType: (packagingTypes?.[0] || 'Pallets'), quantity: 1, rate: 0, total: 0 }] }));
    const removeItem = (index: number) => setQuote(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(quote);
        hideModal();
    };

    const openGoogleMaps = (address: string) => {
        if (!address) return;
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
    };

    const inputClasses = "w-full bg-gray-700 text-white p-2 rounded-md border border-gray-600 focus:ring-1 focus:ring-blue-500";
    const labelClasses = "block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1";

    return (
        <form onSubmit={handleSubmit} className="p-2">
            <h2 className="text-2xl font-black text-white mb-6 flex items-center">
                <span className="w-2 h-8 bg-blue-600 rounded mr-3"></span>
                {quoteData ? 'Edit Quote' : 'New Client Quotation'}
            </h2>

            <div className="space-y-8 max-h-[75vh] overflow-y-auto pr-4 custom-scrollbar">
                {/* Section 1: Core Details */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-gray-800/40 p-4 rounded-xl border border-gray-700">
                    <div>
                        <label className={labelClasses}>Client</label>
                        <select value={quote.clientId} onChange={e => handleFieldChange('clientId', e.target.value)} required className={inputClasses}>
                            <option value="" disabled>-- Select Client --</option>
                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div><label className={labelClasses}>Quote Date</label><input type="date" value={quote.date} onChange={e => handleFieldChange('date', e.target.value)} className={inputClasses} /></div>
                    <div><label className={labelClasses}>Expiry Date</label><input type="date" value={quote.expiryDate} onChange={e => handleFieldChange('expiryDate', e.target.value)} className={inputClasses} /></div>
                    <div>
                        <label className={labelClasses}>Load Specification</label>
                        <select value={quote.loadSpec} onChange={e => handleFieldChange('loadSpec', e.target.value)} className={inputClasses}>
                            {LOAD_SPECS.map(spec => <option key={spec} value={spec}>{spec}</option>)}
                        </select>
                    </div>
                </div>

                {/* Section 2: Commodity & Packaging */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-800/40 p-4 rounded-xl border border-gray-700">
                        <div className="flex justify-between items-center mb-1">
                            <label className={labelClasses}>Commodity Type</label>
                            <button type="button" onClick={() => setShowNewCommodityInput(!showNewCommodityInput)} className="text-[10px] text-blue-400 font-bold hover:underline">
                                {showNewCommodityInput ? 'Cancel' : '+ Add New'}
                            </button>
                        </div>
                        {showNewCommodityInput ? (
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    value={newCommodity} 
                                    onChange={e => setNewCommodity(e.target.value)} 
                                    className={inputClasses} 
                                    placeholder="Enter commodity..."
                                />
                                <button type="button" onClick={handleAddCustomCommodity} className="bg-blue-600 px-3 py-2 rounded-md text-sm font-bold">Add</button>
                            </div>
                        ) : (
                            <select value={quote.commodity} onChange={e => handleFieldChange('commodity', e.target.value)} className={inputClasses}>
                                {commodities.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        )}
                    </div>
                    <div className="bg-gray-800/40 p-4 rounded-xl border border-gray-700">
                        <div className="flex justify-between items-center mb-1">
                            <label className={labelClasses}>Packaging Type</label>
                             <button type="button" onClick={() => setShowNewPackagingInput(!showNewPackagingInput)} className="text-[10px] text-blue-400 font-bold hover:underline">
                                {showNewPackagingInput ? 'Cancel' : '+ Add New'}
                            </button>
                        </div>
                         {showNewPackagingInput ? (
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    value={newPackaging} 
                                    onChange={e => setNewPackaging(e.target.value)} 
                                    className={inputClasses} 
                                    placeholder="Enter packaging..."
                                />
                                <button type="button" onClick={handleAddCustomPackaging} className="bg-blue-600 px-3 py-2 rounded-md text-sm font-bold">Add</button>
                            </div>
                        ) : (
                            <select value={quote.packaging} onChange={e => handleFieldChange('packaging', e.target.value)} className={inputClasses}>
                                {packagingTypes.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        )}
                    </div>
                </div>

                {/* Section 3: Route Legs */}
                <div>
                    <h3 className="text-sm font-black text-gray-500 uppercase tracking-tighter mb-3 ml-1">Route & Locations</h3>
                    <div className="space-y-3">
                        {quote.legs.map((leg, index) => (
                            <div key={leg.id} className="grid grid-cols-12 gap-x-3 items-end bg-gray-900/50 p-4 rounded-xl border border-gray-800">
                                <div className="col-span-5 relative">
                                    <label className={labelClasses}>Collection Address</label>
                                    <AddressAutocompleteInput value={leg.collectionPoint} onChange={val => handleLegChange(index, 'collectionPoint', val)} placeholder="Search address..." className={inputClasses} />
                                    <button 
                                        type="button" 
                                        onClick={() => openGoogleMaps(leg.collectionPoint)}
                                        className="absolute right-2 top-8 text-gray-500 hover:text-blue-400"
                                        title="View on Maps"
                                    >
                                        <MapPinIcon className="h-5 w-5" />
                                    </button>
                                </div>
                                <div className="col-span-5 relative">
                                    <label className={labelClasses}>Delivery Address</label>
                                    <AddressAutocompleteInput value={leg.deliveryPoint} onChange={val => handleLegChange(index, 'deliveryPoint', val)} placeholder="Search address..." className={inputClasses} />
                                    <button 
                                        type="button" 
                                        onClick={() => openGoogleMaps(leg.deliveryPoint)}
                                        className="absolute right-2 top-8 text-gray-500 hover:text-blue-400"
                                        title="View on Maps"
                                    >
                                        <MapPinIcon className="h-5 w-5" />
                                    </button>
                                </div>
                                <div className="col-span-2 flex justify-end">
                                    <button type="button" onClick={() => removeLeg(index)} disabled={quote.legs.length === 1} className="p-2.5 text-red-400 hover:bg-red-500/10 rounded-lg disabled:opacity-30"><TrashIcon className="h-5 w-5"/></button>
                                </div>
                            </div>
                        ))}
                        <button type="button" onClick={addLeg} className="text-xs font-bold text-blue-400 hover:text-white uppercase tracking-widest flex items-center px-4 py-2 border border-blue-500/20 rounded-lg hover:bg-blue-600/10 transition-all"><PlusIcon className="h-4 w-4 mr-2"/>Add Leg</button>
                    </div>
                </div>

                {/* Section 4: Subcontractor Quotes (Internal Only) */}
                <div className="bg-blue-900/10 border border-blue-500/20 p-6 rounded-2xl">
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h3 className="text-sm font-black text-blue-400 uppercase tracking-widest">Internal: Subcontractor Quotes</h3>
                            <p className="text-[10px] text-blue-500">These rates are for internal use and will NOT appear on the client quote. Up to 3 suggested.</p>
                        </div>
                        <button type="button" onClick={addSubQuote} className="text-[10px] font-black bg-blue-600 text-white px-3 py-1.5 rounded-lg uppercase tracking-wider">Add Sub Rate</button>
                    </div>
                    <div className="space-y-3">
                        {quote.subcontractorQuotes.map((sq, index) => (
                            <div key={sq.id} className="grid grid-cols-12 gap-3 items-end">
                                <div className="col-span-6">
                                    <label className={labelClasses}>Carrier Name</label>
                                    <select value={sq.supplierId} onChange={e => handleSubQuoteChange(index, 'supplierId', e.target.value)} className={inputClasses}>
                                        <option value="">-- Choose Subbie --</option>
                                        {transportSuppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                                <div className="col-span-4">
                                    <label className={labelClasses}>Buy Rate (R)</label>
                                    <input type="number" value={sq.rate} onChange={e => handleSubQuoteChange(index, 'rate', parseFloat(e.target.value))} className={inputClasses} />
                                </div>
                                <div className="col-span-2 flex justify-end">
                                    <button type="button" onClick={() => removeSubQuote(index)} className="p-2 text-gray-500 hover:text-red-400"><TrashIcon className="h-4 w-4"/></button>
                                </div>
                            </div>
                        ))}
                        {quote.subcontractorQuotes.length === 0 && <p className="text-center text-xs text-gray-600 italic py-4">No subcontractor rates recorded yet.</p>}
                    </div>
                </div>

                {/* Section 5: Cargo Items */}
                <div>
                    <h3 className="text-sm font-black text-gray-500 uppercase tracking-tighter mb-3 ml-1">Line Items (Client Billing)</h3>
                    <div className="space-y-3">
                         {quote.items.map((item, index) => (
                             <div key={item.id} className="grid grid-cols-12 gap-x-3 items-end bg-gray-900/40 p-4 rounded-xl border border-gray-800">
                                <div className="col-span-4"><label className={labelClasses}>Description</label><input type="text" value={item.description} onChange={e => handleItemChange(index, 'description', e.target.value)} className={inputClasses} /></div>
                                <div className="col-span-2">
                                    <label className={labelClasses}>Packaging</label>
                                    <select value={item.packagingType} onChange={e => handleItemChange(index, 'packagingType', e.target.value)} className={inputClasses}>
                                        {packagingTypes.map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                </div>
                                <div className="col-span-1"><label className={labelClasses}>Qty</label><input type="number" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', Number(e.target.value))} className={inputClasses} /></div>
                                <div className="col-span-2"><label className={labelClasses}>Sell Rate (R)</label><input type="number" value={item.rate} onChange={e => handleItemChange(index, 'rate', Number(e.target.value))} className={inputClasses} /></div>
                                <div className="col-span-2"><label className={labelClasses}>Total</label><div className="p-2 bg-gray-800 rounded-md border border-gray-700 text-sm font-mono text-green-400">R {item.total.toFixed(2)}</div></div>
                                <div className="col-span-1 flex justify-end">
                                    <button type="button" onClick={() => removeItem(index)} disabled={quote.items.length === 1} className="p-2 text-red-400/50 hover:text-red-400"><TrashIcon className="h-4 w-4"/></button>
                                </div>
                            </div>
                         ))}
                         <button type="button" onClick={addItem} className="text-xs font-bold text-gray-400 hover:text-white uppercase tracking-widest flex items-center px-4 py-2 border border-gray-700 rounded-lg transition-all"><PlusIcon className="h-4 w-4 mr-2"/>Add Line Item</button>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-700">
                <div className="flex items-center space-x-10">
                    <div>
                        <p className={labelClasses}>Total Sell</p>
                        <p className="text-3xl font-black text-white">R {quote.totalAmount.toLocaleString()}</p>
                    </div>
                    {quote.subcontractorQuotes.length > 0 && (
                        <div>
                             <p className={labelClasses}>Best Buy Rate</p>
                             <p className="text-xl font-bold text-blue-400">R {Math.min(...quote.subcontractorQuotes.map(q => q.rate)).toLocaleString()}</p>
                        </div>
                    )}
                </div>
                <div className="flex space-x-3">
                    <button type="button" onClick={hideModal} className="px-6 py-2.5 text-sm font-bold text-gray-400 hover:text-white transition-colors">Cancel</button>
                    <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white font-black py-2.5 px-8 rounded-xl shadow-lg shadow-blue-900/30 transition-all active:scale-95 uppercase tracking-wider">
                        {quoteData ? 'Update Quote' : 'Generate Quote'}
                    </button>
                </div>
            </div>
        </form>
    );
};

export default CreateQuoteForm;