import React, { useState } from 'react';
import { LoadConfirmation, Client, Branch } from '../../types';
import { useUIState, useOperations, useAuth } from '../../contexts/AppContexts';

interface TransportOrderFormProps {
    // The portal passes the create handler through the modal payload.
    onSubmit: (data: Omit<LoadConfirmation, 'id' | 'loadConNumber' | 'status' | 'date'>) => Promise<any> | void;
}

const ARRANGING_BRANCHES = ['FBNDBN', 'FBNJHB', 'FBN KZN', 'FBN CPT', 'FBN PE', 'FBN EL'];
const ROUTES = ['DBN - JHB', 'JHB - DBN', 'DBN - EL - DBN', 'DBN - PE - DBN', 'DBN - CPT - DBN', 'JHB - CPT - JHB', 'JHB - PE - JHB', 'JHB - EL - JHB'];
const LOAD_TYPES = ['LCL', 'PART LOAD', '6M', '12M', 'TRI AXLE', 'LINK', '6M CONTAINER', '12M CONTAINER'];
const PACKAGING = ['PALLETS', 'CARTONS', 'CASES', 'COILS', 'DRUMS', 'BAGS', 'BUNDLES', 'LOOSE', 'LENGTHS', 'FULL LOAD', '6M CONTAINER', 'BULK'];
const EQUIPMENT = ['Straps', 'Corner Plates', 'Tarps', 'Nets', 'Chains', 'Rubber Mats', 'Dunnage', 'Container Locks', 'Labour'];

const arrangingToBranch = (a: string): Branch =>
    a === 'FBNJHB' ? 'FBN JHB' : a === 'FBN CPT' ? 'FBN CPT' : 'FBN DBN';

const TransportOrderForm: React.FC<TransportOrderFormProps> = ({ onSubmit }) => {
    const { hideModal } = useUIState();
    const { clients = [] } = useOperations() as { clients: Client[] };
    const { currentUser } = useAuth();

    const today = new Date().toISOString().split('T')[0];
    const [saving, setSaving] = useState(false);

    // Order
    const [arrangingBranch, setArrangingBranch] = useState(ARRANGING_BRANCHES[0]);
    const [loadRefNo, setLoadRefNo] = useState('');
    const [fbnRepresentative, setFbnRepresentative] = useState(currentUser?.name || '');
    const [route, setRoute] = useState('');
    const [priority, setPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');

    // Client side
    const [existingClientId, setExistingClientId] = useState('');
    const [clientName, setClientName] = useState('');
    const [clientEmail, setClientEmail] = useState('');
    const [customerOrderNumber, setCustomerOrderNumber] = useState('');
    const [clientRate, setClientRate] = useState('');

    // Collection
    const [collectionPoint, setCollectionPoint] = useState('');
    const [collectionContact, setCollectionContact] = useState('');
    const [collectionTelephone, setCollectionTelephone] = useState('');
    const [collectionDate, setCollectionDate] = useState(today);
    const [loadingTime, setLoadingTime] = useState('');

    // Delivery
    const [deliveryPoint, setDeliveryPoint] = useState('');
    const [deliveryContact, setDeliveryContact] = useState('');
    const [deliveryTelephone, setDeliveryTelephone] = useState('');
    const [deliveryDate, setDeliveryDate] = useState('');
    const [offloadingTime, setOffloadingTime] = useState('');

    // Cargo
    const [loadType, setLoadType] = useState('');
    const [quantity, setQuantity] = useState('');
    const [commodity, setCommodity] = useState('');
    const [packaging, setPackaging] = useState('');
    const [weightKg, setWeightKg] = useState('');
    const [volume, setVolume] = useState('');
    const [cargoValue, setCargoValue] = useState('');
    const [equipmentRequired, setEquipmentRequired] = useState<string[]>([]);
    const [specialInstructions, setSpecialInstructions] = useState('');

    // Container (optional)
    const [containerNo, setContainerNo] = useState('');
    const [containerOperator, setContainerOperator] = useState('');
    const [containerSealNo, setContainerSealNo] = useState('');
    const [containerTurnInAddress, setContainerTurnInAddress] = useState('');

    // Subcontractor side
    const [subcontractorName, setSubcontractorName] = useState('');
    const [forAttention, setForAttention] = useState('');
    const [subcontractorEmail, setSubcontractorEmail] = useState('');
    const [podEmail, setPodEmail] = useState('');
    const [ccEmail, setCcEmail] = useState('');
    const [subcontractorDriverName, setSubcontractorDriverName] = useState('');
    const [subcontractorDriverCell, setSubcontractorDriverCell] = useState('');
    const [transportRate, setTransportRate] = useState('');

    const toggleEquipment = (e: string) =>
        setEquipmentRequired(prev => prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e]);

    const onPickClient = (id: string) => {
        setExistingClientId(id);
        const c = clients.find(c => c.id === id);
        if (c) { setClientName(c.name); }
    };

    const input = "w-full bg-gray-900/60 text-white p-2.5 rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-secondary focus:border-transparent text-sm transition";
    const label = "block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1";

    const Section: React.FC<{ title: string; accent?: string; children: React.ReactNode }> = ({ title, accent = 'bg-gray-600', children }) => (
        <div className="bg-gray-800/50 rounded-2xl border border-gray-700/60 p-5">
            <h3 className="flex items-center text-xs font-black text-gray-300 uppercase tracking-[0.18em] mb-4">
                <span className={`w-1.5 h-4 rounded-full mr-2.5 ${accent}`} />{title}
            </h3>
            {children}
        </div>
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!clientName || !subcontractorName || !collectionPoint || !deliveryPoint || !clientRate || !transportRate) {
            alert('Please fill the required fields: client, subcontractor, collection & delivery addresses, and both rates.');
            return;
        }
        const data: Omit<LoadConfirmation, 'id' | 'loadConNumber' | 'status' | 'date'> = {
            clientId: existingClientId || '',
            items: [],
            legs: [{ id: 'leg-1', collectionPoint, deliveryPoint, movementType: 'Subcontracted' }],
            totalAmount: parseFloat(clientRate) || 0,
            supplierRate: parseFloat(transportRate) || 0,
            collectionBranch: arrangingToBranch(arrangingBranch),
            destinationBranch: arrangingToBranch(arrangingBranch),
            priority,
            collectionPoint,
            deliveryPoint,
            collectionDate,
            deliveryDate: deliveryDate || undefined,
            customerOrderNumber: customerOrderNumber || undefined,
            commodity: commodity || undefined,
            packaging: packaging || undefined,
            // Transport Order fields
            arrangingBranch,
            loadRefNo: loadRefNo || undefined,
            clientName,
            clientEmail: clientEmail || undefined,
            route: route || undefined,
            fbnRepresentative: fbnRepresentative || undefined,
            loadingTime: loadingTime || undefined,
            offloadingTime: offloadingTime || undefined,
            collectionContact: collectionContact || undefined,
            collectionTelephone: collectionTelephone || undefined,
            deliveryContact: deliveryContact || undefined,
            deliveryTelephone: deliveryTelephone || undefined,
            loadType: loadType || undefined,
            quantity: quantity || undefined,
            weightKg: weightKg || undefined,
            volume: volume || undefined,
            cargoValue: cargoValue || undefined,
            equipmentRequired: equipmentRequired.length ? equipmentRequired : undefined,
            containerNo: containerNo || undefined,
            containerTurnInAddress: containerTurnInAddress || undefined,
            containerOperator: containerOperator || undefined,
            containerSealNo: containerSealNo || undefined,
            specialInstructions: specialInstructions || undefined,
            subcontractorName,
            forAttention: forAttention || undefined,
            subcontractorEmail: subcontractorEmail || undefined,
            podEmail: podEmail || undefined,
            ccEmail: ccEmail || undefined,
            subcontractorDriverName: subcontractorDriverName || undefined,
            subcontractorDriverCell: subcontractorDriverCell || undefined,
        };
        setSaving(true);
        const res = await onSubmit(data);
        setSaving(false);
        if (res && res.ok === false) { alert(`Could not create the Transport Order: ${res.error || 'unknown error'}`); return; }
        hideModal();
    };

    return (
        <form onSubmit={handleSubmit} className="p-1">
            <div className="flex items-center justify-between mb-5">
                <h2 className="text-2xl font-black text-white flex items-center">
                    <span className="w-2 h-8 bg-brand-secondary rounded mr-3" />New Transport Order
                </h2>
                <span className="text-[11px] text-gray-500 font-semibold hidden sm:block">Client rate & subbie rate stay private to each side</span>
            </div>

            <div className="space-y-5 max-h-[74vh] overflow-y-auto pr-3 custom-scrollbar">
                <Section title="Order Details" accent="bg-brand-secondary">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div><label className={label}>Arranging Branch</label>
                            <select value={arrangingBranch} onChange={e => setArrangingBranch(e.target.value)} className={input}>
                                {ARRANGING_BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                            </select></div>
                        <div><label className={label}>Load Ref No (FBN DI / Manifest)</label>
                            <input value={loadRefNo} onChange={e => setLoadRefNo(e.target.value)} className={input} placeholder="e.g. DI12345" /></div>
                        <div><label className={label}>FBN Representative</label>
                            <input value={fbnRepresentative} onChange={e => setFbnRepresentative(e.target.value)} className={input} /></div>
                        <div><label className={label}>Route</label>
                            <select value={route} onChange={e => setRoute(e.target.value)} className={input}>
                                <option value="">-- Select --</option>{ROUTES.map(r => <option key={r} value={r}>{r}</option>)}
                            </select></div>
                        <div><label className={label}>Priority</label>
                            <select value={priority} onChange={e => setPriority(e.target.value as any)} className={input}>
                                <option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option>
                            </select></div>
                    </div>
                </Section>

                <Section title="Client  ·  goes on the Client Order only" accent="bg-blue-500">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label className={label}>Link existing client (optional)</label>
                            <select value={existingClientId} onChange={e => onPickClient(e.target.value)} className={input}>
                                <option value="">-- New / free text --</option>
                                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select></div>
                        <div><label className={label}>Client Name *</label>
                            <input value={clientName} onChange={e => setClientName(e.target.value)} className={input} required /></div>
                        <div><label className={label}>Client Email</label>
                            <input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} className={input} placeholder="for the client order" /></div>
                        <div><label className={label}>Customer Order No</label>
                            <input value={customerOrderNumber} onChange={e => setCustomerOrderNumber(e.target.value)} className={input} /></div>
                        <div><label className={label}>Client Rate (excl VAT) *</label>
                            <div className="relative"><span className="absolute left-3 top-2.5 text-blue-400 font-mono text-xs">R</span>
                                <input type="number" step="0.01" value={clientRate} onChange={e => setClientRate(e.target.value)} className={`${input} pl-7`} required /></div></div>
                    </div>
                </Section>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    <Section title="Collection">
                        <div className="space-y-3">
                            <div><label className={label}>Collection Address *</label>
                                <input value={collectionPoint} onChange={e => setCollectionPoint(e.target.value)} className={input} required /></div>
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className={label}>Contact</label><input value={collectionContact} onChange={e => setCollectionContact(e.target.value)} className={input} /></div>
                                <div><label className={label}>Telephone</label><input value={collectionTelephone} onChange={e => setCollectionTelephone(e.target.value)} className={input} /></div>
                                <div><label className={label}>Loading Date</label><input type="date" value={collectionDate} onChange={e => setCollectionDate(e.target.value)} className={input} /></div>
                                <div><label className={label}>Loading Time</label><input type="time" value={loadingTime} onChange={e => setLoadingTime(e.target.value)} className={input} /></div>
                            </div>
                        </div>
                    </Section>
                    <Section title="Delivery">
                        <div className="space-y-3">
                            <div><label className={label}>Delivery Address *</label>
                                <input value={deliveryPoint} onChange={e => setDeliveryPoint(e.target.value)} className={input} required /></div>
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className={label}>Contact</label><input value={deliveryContact} onChange={e => setDeliveryContact(e.target.value)} className={input} /></div>
                                <div><label className={label}>Telephone</label><input value={deliveryTelephone} onChange={e => setDeliveryTelephone(e.target.value)} className={input} /></div>
                                <div><label className={label}>Offloading Date</label><input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} className={input} /></div>
                                <div><label className={label}>Offloading Time</label><input type="time" value={offloadingTime} onChange={e => setOffloadingTime(e.target.value)} className={input} /></div>
                            </div>
                        </div>
                    </Section>
                </div>

                <Section title="Cargo">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div><label className={label}>Load Type</label>
                            <select value={loadType} onChange={e => setLoadType(e.target.value)} className={input}><option value="">--</option>{LOAD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                        <div><label className={label}>Quantity</label><input value={quantity} onChange={e => setQuantity(e.target.value)} className={input} /></div>
                        <div><label className={label}>Commodity</label><input value={commodity} onChange={e => setCommodity(e.target.value)} className={input} /></div>
                        <div><label className={label}>Packaging</label>
                            <select value={packaging} onChange={e => setPackaging(e.target.value)} className={input}><option value="">--</option>{PACKAGING.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
                        <div><label className={label}>Weight (kg)</label><input value={weightKg} onChange={e => setWeightKg(e.target.value)} className={input} /></div>
                        <div><label className={label}>Volume / Cubes</label><input value={volume} onChange={e => setVolume(e.target.value)} className={input} /></div>
                        <div className="col-span-2"><label className={label}>Cargo Value (GIT)</label>
                            <div className="relative"><span className="absolute left-3 top-2.5 text-gray-500 font-mono text-xs">R</span>
                                <input type="number" value={cargoValue} onChange={e => setCargoValue(e.target.value)} className={`${input} pl-7`} /></div></div>
                    </div>
                    <div className="mt-4">
                        <label className={label}>Equipment Required</label>
                        <div className="flex flex-wrap gap-2">
                            {EQUIPMENT.map(e => (
                                <button type="button" key={e} onClick={() => toggleEquipment(e)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${equipmentRequired.includes(e) ? 'bg-brand-secondary text-white border-brand-secondary' : 'bg-gray-900/40 text-gray-300 border-gray-700 hover:border-gray-500'}`}>
                                    {e}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="mt-4"><label className={label}>Special Instructions</label>
                        <textarea value={specialInstructions} onChange={e => setSpecialInstructions(e.target.value)} rows={2} className={input} /></div>
                    <details className="mt-4">
                        <summary className="text-xs font-bold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white">Container details (if applicable)</summary>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                            <div><label className={label}>Container No</label><input value={containerNo} onChange={e => setContainerNo(e.target.value)} className={input} /></div>
                            <div><label className={label}>Operator</label><input value={containerOperator} onChange={e => setContainerOperator(e.target.value)} className={input} /></div>
                            <div><label className={label}>Seal No</label><input value={containerSealNo} onChange={e => setContainerSealNo(e.target.value)} className={input} /></div>
                            <div><label className={label}>Turn-in Address</label><input value={containerTurnInAddress} onChange={e => setContainerTurnInAddress(e.target.value)} className={input} /></div>
                        </div>
                    </details>
                </Section>

                <Section title="Subcontractor  ·  goes on the LoadCon only" accent="bg-amber-500">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div><label className={label}>Subcontractor *</label><input value={subcontractorName} onChange={e => setSubcontractorName(e.target.value)} className={input} required /></div>
                        <div><label className={label}>For Attention</label><input value={forAttention} onChange={e => setForAttention(e.target.value)} className={input} /></div>
                        <div><label className={label}>Subcontractor Email</label><input type="email" value={subcontractorEmail} onChange={e => setSubcontractorEmail(e.target.value)} className={input} placeholder="loadcon goes here" /></div>
                        <div><label className={label}>Reg + Driver Name</label><input value={subcontractorDriverName} onChange={e => setSubcontractorDriverName(e.target.value)} className={input} /></div>
                        <div><label className={label}>Driver Cell</label><input value={subcontractorDriverCell} onChange={e => setSubcontractorDriverCell(e.target.value)} className={input} /></div>
                        <div><label className={label}>Transport Rate (excl VAT) *</label>
                            <div className="relative"><span className="absolute left-3 top-2.5 text-amber-400 font-mono text-xs">R</span>
                                <input type="number" step="0.01" value={transportRate} onChange={e => setTransportRate(e.target.value)} className={`${input} pl-7`} required /></div></div>
                        <div><label className={label}>POD Email</label><input type="email" value={podEmail} onChange={e => setPodEmail(e.target.value)} className={input} /></div>
                        <div><label className={label}>Copy Email (CC)</label><input type="email" value={ccEmail} onChange={e => setCcEmail(e.target.value)} className={input} /></div>
                    </div>
                </Section>
            </div>

            <div className="flex justify-end items-center gap-3 mt-6 pt-5 border-t border-gray-700/60">
                <button type="button" onClick={hideModal} className="px-6 py-2.5 text-sm font-bold text-gray-400 hover:text-white transition">Cancel</button>
                <button type="submit" disabled={saving} className="bg-brand-primary hover:bg-brand-secondary text-white font-black py-2.5 px-10 rounded-xl shadow-lg transition active:scale-95 uppercase tracking-wider disabled:opacity-60">
                    {saving ? 'Creating…' : 'Create Transport Order'}
                </button>
            </div>
        </form>
    );
};

export default TransportOrderForm;
