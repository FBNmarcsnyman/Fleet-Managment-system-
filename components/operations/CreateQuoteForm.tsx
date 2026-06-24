
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
    // Pre-fill a brand-new quote from an inbound quote request ("Quote It").
    prefill?: any;
}

const generateId = () => `id_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

// Suggest the load specification from the cargo specs: a full-vehicle load type
// or a heavy/high-cube shipment is Dedicated; everything else starts Consolidated
// (Marc's rule: default Consolidated until the cargo says otherwise).
const suggestSpec = (rd: any, packaging?: string): string => {
    const lt = `${rd?.load_type || ''} ${packaging || ''}`.toLowerCase();
    if (/superlink|12m|6m|abnormal|full load|\bftl\b|\btruck\b/.test(lt)) return 'Dedicated';
    const w = Number(rd?.total_weight) || 0;
    const cube = Number(rd?.total_cube) || 0;
    if (w >= 8000 || cube >= 25) return 'Dedicated';
    return 'Consolidated';
};

const getInitialState = (quoteData?: Quote, commodities?: string[], packagingTypes?: string[], prefill?: any) => {
    if (quoteData) {
        // Editing an existing quote (incl. "Quote It" on an inbound request, which
        // keeps the SAME quote number). If the request has no line item / route yet,
        // seed them from the request payload so the pricer isn't staring at a blank.
        const rdq: any = quoteData.requestData || {};
        const commodityE = quoteData.commodity || rdq.commodity || commodities?.[0] || 'General Cargo';
        const packagingE = quoteData.packaging || rdq.load_type || rdq.packaging || packagingTypes?.[0] || 'Pallets';
        const dimsE = rdq.dimensions;
        const dimQtyE = Array.isArray(dimsE) ? dimsE.reduce((s: number, d: any) => s + (Number(d.qty) || 0), 0) : 0;
        const pkgQtyE = parseInt(String(rdq.packages || '').replace(/[^0-9]/g, ''), 10) || 0;
        const qtyE = dimQtyE || pkgQtyE || 1;
        const needItems = !quoteData.items || quoteData.items.length === 0;
        const needLegs = !quoteData.legs || quoteData.legs.length === 0;
        return {
            ...quoteData,
            date: format(new Date(quoteData.date), 'yyyy-MM-dd'),
            expiryDate: quoteData.expiryDate ? format(new Date(quoteData.expiryDate), 'yyyy-MM-dd') : format(addDays(new Date(), 7), 'yyyy-MM-dd'),
            commodity: commodityE,
            packaging: packagingE,
            loadSpec: quoteData.loadSpec || suggestSpec(rdq, packagingE),
            items: needItems ? [{ id: generateId(), description: commodityE, packagingType: packagingE, quantity: qtyE, rate: 0, total: 0 }] : quoteData.items,
            legs: needLegs ? [{ id: generateId(), collectionPoint: rdq.collect_from || rdq.collection_area || '', deliveryPoint: rdq.deliver_to || rdq.delivery_area || '', movementType: 'Internal' }] : quoteData.legs,
            subcontractorQuotes: quoteData.subcontractorQuotes || [],
            requestData: { ...rdq },
        };
    }
    const rd = prefill?.requestData || {};
    const commodity = prefill?.commodity || rd.commodity || commodities?.[0] || 'General Cargo';
    // The client states cargo type as "Load Type" on the request (e.g. Cartons),
    // so honour that before falling back to the default packaging.
    const packaging = prefill?.packaging || rd.load_type || rd.packaging || packagingTypes?.[0] || 'Pallets';
    // Pull the quantity through: prefer the sum of parcel quantities, else the
    // number in the "packages" field (e.g. "10 pallets" → 10), else 1.
    const dimSource = prefill?.requestMoreInfo?.dimensions || rd.dimensions;
    const dimQty = Array.isArray(dimSource) ? dimSource.reduce((s: number, d: any) => s + (Number(d.qty) || 0), 0) : 0;
    const pkgQty = parseInt(String(rd.packages || '').replace(/[^0-9]/g, ''), 10) || 0;
    const initialQty = dimQty || pkgQty || 1;
    return {
        clientId: prefill?.clientId || '',
        date: format(new Date(), 'yyyy-MM-dd'),
        expiryDate: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
        items: [{ id: generateId(), description: commodity, packagingType: packaging, quantity: initialQty, rate: 0, total: 0 }],
        legs: [{ id: generateId(), collectionPoint: rd.collect_from || rd.collection_area || '', deliveryPoint: rd.deliver_to || rd.delivery_area || '', movementType: 'Internal' }],
        totalAmount: 0,
        sentToClient: false,
        commodity,
        packaging,
        // Auto-stipulate from the cargo specs (full/heavy → Dedicated, else Consolidated).
        loadSpec: (prefill?.loadSpec || suggestSpec(rd, packaging)) as any,
        subcontractorQuotes: [] as SubcontractorQuote[],
        notes: prefill?.notes || undefined,
        // Carry the cargo request payload (weight / cubes / areas) so it can be
        // edited here and saved with the quote. Seed cubes from the "more info"
        // dimensions if the client supplied them.
        requestData: {
            ...(prefill?.requestData || {}),
            ...(prefill?.requestMoreInfo?.total_cube ? { total_cube: prefill.requestMoreInfo.total_cube } : {}),
            ...(Array.isArray(prefill?.requestMoreInfo?.dimensions) && prefill.requestMoreInfo.dimensions.length
                ? { dimensions: prefill.requestMoreInfo.dimensions }
                : (Array.isArray(prefill?.requestData?.dimensions) ? { dimensions: prefill.requestData.dimensions } : {})),
        },
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
    // Once the user picks a load spec manually we stop auto-suggesting. Existing
    // quotes that already carry a spec start "touched" so we never override them.
    const [specTouched, setSpecTouched] = useState(!!quoteData?.loadSpec);

    const transportSuppliers = suppliers.filter(s => s.type === 'Transport');

    // What the client actually asked us to move — surfaced read-only at the top
    // so the pricer can see weight / cubes / load type while keying the rate.
    const reqSummary = prefill?.requestData || quoteData?.requestData || {};
    const moreInfo = prefill?.requestMoreInfo || quoteData?.requestMoreInfo || {};
    const cubes = moreInfo.total_cube
        || (Array.isArray(moreInfo.dimensions) && moreInfo.dimensions.length
            ? moreInfo.dimensions.reduce((s: number, d: any) => s + ((d.length_cm * d.width_cm * d.height_cm * (d.qty || 1)) / 1000000), 0).toFixed(2)
            : null);
    const hasSummary = !!(reqSummary.total_weight || reqSummary.packages || reqSummary.load_type || cubes || reqSummary.collection_area);

    // Rate scope / terms shown on the client quote. Default to "transport only"
    // unless the client actually asked for labour / crane / forklift / tail-lift.
    const TRANSPORT_ONLY = 'Rate is for TRANSPORT ONLY. Client to arrange loading & offloading (no labour, crane, forklift or tail-lift included).';
    const equip = moreInfo.equipment || {};
    const labourRequested = ['crane_truck', 'forklift', 'labour', 'driver_hire', 'taillift_collection', 'taillift_delivery'].some(k => equip[k]);

    useEffect(() => {
        // The sell rate is the price for the whole shipment, so the line total is
        // the rate itself (NOT rate × qty — qty is just how many units there are).
        const total: number = (quote.items as QuoteItem[]).reduce(
            (sum: number, item: QuoteItem) => sum + (Number(item.rate) || 0),
            0,
        );
        if (total !== quote.totalAmount) {
            setQuote((prev: any) => ({ ...prev, totalAmount: total }));
        }
    }, [quote.items, quote.totalAmount]);

    // Auto-stipulate Consolidated/Dedicated as the cargo specs change, until the
    // user overrides the dropdown.
    useEffect(() => {
        if (specTouched) return;
        const s = suggestSpec(quote.requestData, quote.packaging);
        if (s !== quote.loadSpec) setQuote((prev: any) => ({ ...prev, loadSpec: s }));
    }, [quote.requestData?.total_weight, quote.requestData?.total_cube, quote.requestData?.load_type, quote.packaging, specTouched]);

    const handleFieldChange = (field: keyof Quote, value: any) => {
        setQuote(prev => ({ ...prev, [field]: value }));
    };

    // New quotes: pre-fill the transport-only term when no loading equipment was
    // requested (the common case). Never override an existing/edited quote.
    useEffect(() => {
        if (quoteData) return;
        if ((quote.specialRequirements || '').trim()) return;
        if (!labourRequested) setQuote(prev => (prev.specialRequirements ? prev : { ...prev, specialRequirements: TRANSPORT_ONLY }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Edit a value inside the cargo request payload (weight / cubes).
    const handleReqChange = (key: string, value: any) => {
        setQuote(prev => ({ ...prev, requestData: { ...(prev.requestData || {}), [key]: value } }));
    };

    // --- Parcel dimensions → cubes ------------------------------------------
    const dims: any[] = quote.requestData?.dimensions || [];
    const rowCbm = (d: any) =>
        ((Number(d.length_cm) || 0) * (Number(d.width_cm) || 0) * (Number(d.height_cm) || 0) * (Number(d.qty) || 1)) / 1000000;
    const setDims = (newDims: any[]) =>
        setQuote(prev => ({ ...prev, requestData: { ...(prev.requestData || {}), dimensions: newDims } }));
    const addDim = () => setDims([...dims, { length_cm: '', width_cm: '', height_cm: '', qty: 1 }]);
    const handleDimChange = (i: number, field: string, value: any) => {
        const nd = dims.map((d, x) => (x === i ? { ...d, [field]: value } : d));
        setDims(nd);
    };
    const removeDim = (i: number) => setDims(dims.filter((_, x) => x !== i));

    // When parcel dimensions exist, keep Total Cubes in sync with their sum.
    useEffect(() => {
        if (!Array.isArray(dims) || dims.length === 0) return;
        const total = dims.reduce((s, d) => s + rowCbm(d), 0);
        const rounded = total ? total.toFixed(3) : '';
        if (String(quote.requestData?.total_cube ?? '') !== rounded) {
            setQuote(prev => ({ ...prev, requestData: { ...(prev.requestData || {}), total_cube: rounded } }));
        }
    }, [JSON.stringify(dims)]);

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
        // Line total = the sell rate (full-shipment price); quantity is informational.
        item.total = Number(item.rate) || 0;
        setQuote(prev => ({ ...prev, items: newItems }));
    };
    const addItem = () => setQuote(prev => ({ ...prev, items: [...prev.items, { id: generateId(), description: '', packagingType: (packagingTypes?.[0] || 'Pallets'), quantity: 1, rate: 0, total: 0 }] }));
    const removeItem = (index: number) => setQuote(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Persist any newly-typed commodity / packaging so they appear in the
        // pick-lists next time. Wrapped so a pick-list hiccup can never block the
        // actual quote from being created.
        try {
            const commodityVal = (quote.commodity || '').trim();
            if (commodityVal && !commodities.includes(commodityVal) && typeof handleAddCommodity === 'function') handleAddCommodity(commodityVal);
            const packagingVal = (quote.packaging || '').trim();
            if (packagingVal && !packagingTypes.includes(packagingVal) && typeof handleAddPackagingType === 'function') handleAddPackagingType(packagingVal);
        } catch (err) { console.error('[quote] add commodity/packaging failed (continuing):', err); }
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
                {/* What you're pricing — read-only summary from the client request */}
                {hasSummary && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
                        <h3 className="text-xs font-black text-amber-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                            📦 What you're pricing
                            {reqSummary.hazardous && <span className="bg-red-600 text-white text-[10px] px-2 py-0.5 rounded-full">HAZARDOUS</span>}
                            {reqSummary.cross_border && <span className="bg-purple-600 text-white text-[10px] px-2 py-0.5 rounded-full">CROSS-BORDER</span>}
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div><div className={labelClasses}>Total Weight</div><div className="text-lg font-bold text-white">{reqSummary.total_weight ? `${reqSummary.total_weight} kg` : '—'}</div></div>
                            <div><div className={labelClasses}>Cubes</div><div className="text-lg font-bold text-white">{cubes ? `${cubes} m³` : '—'}</div></div>
                            <div><div className={labelClasses}>Packages</div><div className="text-lg font-bold text-white">{reqSummary.packages || '—'}</div></div>
                            <div><div className={labelClasses}>Load Type</div><div className="text-lg font-bold text-white">{reqSummary.load_type || '—'}</div></div>
                        </div>
                        {(reqSummary.collection_area || reqSummary.delivery_area) && (
                            <div className="mt-3 pt-3 border-t border-amber-500/20 text-sm text-gray-300">
                                <span className="font-bold text-white">{reqSummary.collection_area || '—'}</span>
                                <span className="mx-2 text-amber-400">→</span>
                                <span className="font-bold text-white">{reqSummary.delivery_area || '—'}</span>
                                {reqSummary.commodity && <span className="ml-3 text-gray-400">· {reqSummary.commodity}</span>}
                            </div>
                        )}
                    </div>
                )}

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
                        <select value={quote.loadSpec} onChange={e => { setSpecTouched(true); handleFieldChange('loadSpec', e.target.value); }} className={inputClasses}>
                            {LOAD_SPECS.map(spec => <option key={spec} value={spec}>{spec}</option>)}
                        </select>
                    </div>
                </div>

                {/* Section 2: Commodity & Packaging — type to search, new names are saved */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-800/40 p-4 rounded-xl border border-gray-700">
                        <label className={labelClasses}>Commodity Type</label>
                        <input
                            list="commodity-options"
                            value={quote.commodity || ''}
                            onChange={e => handleFieldChange('commodity', e.target.value)}
                            className={inputClasses}
                            placeholder="Type to search or add…"
                            autoComplete="off"
                        />
                        <datalist id="commodity-options">
                            {commodities.map(c => <option key={c} value={c} />)}
                        </datalist>
                        <p className="text-[10px] text-gray-500 mt-1">Start typing — pick a match or add a new one (saved for next time).</p>
                    </div>
                    <div className="bg-gray-800/40 p-4 rounded-xl border border-gray-700">
                        <label className={labelClasses}>Packaging Type</label>
                        <input
                            list="packaging-options"
                            value={quote.packaging || ''}
                            onChange={e => handleFieldChange('packaging', e.target.value)}
                            className={inputClasses}
                            placeholder="Type to search or add…"
                            autoComplete="off"
                        />
                        <datalist id="packaging-options">
                            {packagingTypes.map(p => <option key={p} value={p} />)}
                        </datalist>
                        <p className="text-[10px] text-gray-500 mt-1">Start typing — pick a match or add a new one (saved for next time).</p>
                    </div>
                </div>

                {/* Section 2b: Cargo measurements you're pricing on */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-800/40 p-4 rounded-xl border border-gray-700">
                        <label className={labelClasses}>Total Weight (kg)</label>
                        <input type="number" min="0" value={quote.requestData?.total_weight ?? ''} onChange={e => handleReqChange('total_weight', e.target.value)} className={inputClasses} placeholder="e.g. 8000" />
                    </div>
                    <div className="bg-gray-800/40 p-4 rounded-xl border border-gray-700">
                        <label className={labelClasses}>Total Cubes (m³)</label>
                        <input
                            type="number" min="0" step="0.001"
                            value={quote.requestData?.total_cube ?? ''}
                            onChange={e => handleReqChange('total_cube', e.target.value)}
                            readOnly={dims.length > 0}
                            className={inputClasses + (dims.length > 0 ? ' opacity-70 cursor-not-allowed' : '')}
                            placeholder="e.g. 12.5"
                        />
                        {dims.length > 0
                            ? <p className="text-[10px] text-green-500 mt-1">Auto-calculated from parcel dimensions below.</p>
                            : <p className="text-[10px] text-gray-500 mt-1">Type a total, or add parcel dimensions below to calculate it.</p>}
                    </div>
                </div>

                {/* Section 2c: Parcel dimensions → cubes */}
                <div>
                    <h3 className="text-sm font-black text-gray-500 uppercase tracking-tighter mb-3 ml-1">
                        Parcel Dimensions <span className="normal-case text-[10px] text-gray-600 font-normal">— auto-calculates the cube</span>
                    </h3>
                    <div className="space-y-3">
                        {dims.map((d: any, index: number) => (
                            <div key={index} className="grid grid-cols-12 gap-x-3 items-end bg-gray-900/40 p-4 rounded-xl border border-gray-800">
                                <div className="col-span-2"><label className={labelClasses}>Length (cm)</label><input type="number" min="0" value={d.length_cm ?? ''} onChange={e => handleDimChange(index, 'length_cm', e.target.value)} className={inputClasses} /></div>
                                <div className="col-span-2"><label className={labelClasses}>Width (cm)</label><input type="number" min="0" value={d.width_cm ?? ''} onChange={e => handleDimChange(index, 'width_cm', e.target.value)} className={inputClasses} /></div>
                                <div className="col-span-2"><label className={labelClasses}>Height (cm)</label><input type="number" min="0" value={d.height_cm ?? ''} onChange={e => handleDimChange(index, 'height_cm', e.target.value)} className={inputClasses} /></div>
                                <div className="col-span-2"><label className={labelClasses}>Qty</label><input type="number" min="1" value={d.qty ?? 1} onChange={e => handleDimChange(index, 'qty', e.target.value)} className={inputClasses} /></div>
                                <div className="col-span-3"><label className={labelClasses}>CBM</label><div className="p-2 bg-gray-800 rounded-md border border-gray-700 text-sm font-mono text-green-400">{rowCbm(d).toFixed(3)} m³</div></div>
                                <div className="col-span-1 flex justify-end"><button type="button" onClick={() => removeDim(index)} className="p-2 text-red-400/50 hover:text-red-400"><TrashIcon className="h-4 w-4" /></button></div>
                            </div>
                        ))}
                        {dims.length > 0 && (
                            <div className="flex justify-end pr-2">
                                <span className="text-sm font-bold text-white">Total Cube: <span className="text-green-400 font-mono">{dims.reduce((s: number, d: any) => s + rowCbm(d), 0).toFixed(3)} m³</span></span>
                            </div>
                        )}
                        <button type="button" onClick={addDim} className="text-xs font-bold text-gray-400 hover:text-white uppercase tracking-widest flex items-center px-4 py-2 border border-gray-700 rounded-lg transition-all"><PlusIcon className="h-4 w-4 mr-2" />Add Parcel</button>
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

                {/* Section 4b: Rate scope / terms — shown on the client quote */}
                <div>
                    <h3 className="text-sm font-black text-gray-500 uppercase tracking-tighter mb-3 ml-1">Rate Scope / Terms <span className="text-gray-600 font-bold normal-case tracking-normal">(appears on the client quote)</span></h3>
                    <label className="flex items-center gap-2 text-sm text-gray-300 mb-2 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={(quote.specialRequirements || '').includes('TRANSPORT ONLY')}
                            onChange={e => handleFieldChange('specialRequirements' as any, e.target.checked ? TRANSPORT_ONLY : '')}
                            className="h-4 w-4 rounded border-gray-600 bg-gray-700"
                        />
                        Rate is for <strong>transport only</strong> — client to arrange loading &amp; offloading
                    </label>
                    <textarea
                        value={quote.specialRequirements || ''}
                        onChange={e => handleFieldChange('specialRequirements' as any, e.target.value)}
                        rows={2}
                        placeholder="e.g. Rate excludes loading/offloading, standby & after-hours. Crane/labour quoted separately on request."
                        className={inputClasses}
                    />
                    {labourRequested && (
                        <p className="text-[11px] text-amber-400 mt-1">⚠ The client requested labour/crane/forklift — make sure the rate and wording reflect whether that's included.</p>
                    )}
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
                                <div className="col-span-1"><label className={labelClasses}>Qty</label><input type="number" min="0" value={item.quantity || ''} onChange={e => handleItemChange(index, 'quantity', Number(e.target.value))} className={inputClasses} /></div>
                                <div className="col-span-2"><label className={labelClasses}>Sell Rate (R)</label><input type="number" min="0" step="0.01" placeholder="0.00" value={item.rate || ''} onChange={e => handleItemChange(index, 'rate', Number(e.target.value))} className={inputClasses} /></div>
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
                    {Number(quote.requestData?.total_weight) > 0 && (
                        <div>
                            <p className={labelClasses}>Rate / kg</p>
                            <p className="text-xl font-bold text-green-400">R {(quote.totalAmount / Number(quote.requestData.total_weight)).toFixed(2)}</p>
                        </div>
                    )}
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