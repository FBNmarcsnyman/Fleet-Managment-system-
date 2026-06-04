
import React, { useState, useEffect, useMemo } from 'react';
import { Vehicle, Branch, VehicleStatus } from '../types';
import { BRANCHES } from '../constants';
import { useVehicles } from '../contexts/AppContexts';

// --- Linked-vehicle helpers --------------------------------------------------
// Strip whitespace and non-alphanumerics, uppercase. Compares two regs as if
// you'd written them without the spacing/province quirks.
const normReg = (s: string): string => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

// Hamming-like distance for same-length normalised regs. Returns Infinity for
// unequal lengths (too different) and exits early when diffs exceed 2. Lower
// number = more similar. 0 = identical, 1 = one character apart (typical
// consecutive-number trailer pair, e.g. ABC123GP / ABC124GP).
const regSimilarityScore = (a: string, b: string): number => {
    if (a.length !== b.length) return Infinity;
    let diffs = 0;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
            diffs++;
            if (diffs > 2) return Infinity;
        }
    }
    return diffs;
};

// Find the most similar vehicle (by normalised registration) among the
// candidates, excluding the vehicle being edited. Only returns a match when
// the registrations differ by 1 or 2 characters (anything more is too noisy).
const findSimilarRegPartner = (
    targetReg: string,
    candidates: Vehicle[],
    excludeId?: string,
): Vehicle | null => {
    const target = normReg(targetReg);
    if (!target) return null;
    let best: { v: Vehicle; score: number } | null = null;
    for (const c of candidates) {
        if (c.id === excludeId) continue;
        const score = regSimilarityScore(target, normReg(c.registration));
        if (score >= 1 && (!best || score < best.score)) {
            best = { v: c, score };
            if (score === 1) break; // one-char-diff is the best practical match
        }
    }
    return best?.v ?? null;
};

interface AddVehicleFormProps {
    vehicleData?: Vehicle;
    onSubmit: (vehicle: Omit<Vehicle, 'id' | 'currentValue'>) => void;
    onCancel: () => void;
}

const VEHICLE_CATEGORIES = [
    'Horse',
    'Standard Trailer',
    'Superlink Trailer',
    '8 TONNER',
    '12 TONNER',
    '15 TONNER',
    '1 TONNER',
    '2 TONNER',
    'BAKKIE',
    'Forklift',
    'Other'
];

const VEHICLE_STATUSES: VehicleStatus[] = ['On the road', 'In for service', 'Off the road', 'Sold'];

const AddVehicleForm: React.FC<AddVehicleFormProps> = ({ vehicleData, onSubmit, onCancel }) => {
    const { vehicles = [] } = useVehicles();
    const [name, setName] = useState(vehicleData?.name || '');
    const [make, setMake] = useState(vehicleData?.make || '');
    const [model, setModel] = useState(vehicleData?.model || '');
    const [year, setYear] = useState(vehicleData?.year || new Date().getFullYear());
    const [registration, setRegistration] = useState(vehicleData?.registration || '');
    const [vin, setVin] = useState(vehicleData?.vin || '');
    const [branch, setBranch] = useState<Branch>(vehicleData?.branch || BRANCHES[0]);
    const [weightCategory, setWeightCategory] = useState(vehicleData?.weightCategory || VEHICLE_CATEGORIES[0]);
    const [purchasePrice, setPurchasePrice] = useState(vehicleData?.purchasePrice || 0);
    const [status, setStatus] = useState<VehicleStatus>(vehicleData?.status || 'On the road');
    const [linkedVehicleId, setLinkedVehicleId] = useState<string>(vehicleData?.linkedVehicleId || '');
    const [submitting, setSubmitting] = useState(false);

    // Eligible link candidates: only vehicles in the same category as the
    // one being edited (so a trailer's picker isn't padded with every horse
    // in the fleet). Plus the currently-linked vehicle if it's a different
    // category — otherwise the dropdown would "lose" the existing link.
    // For 1000-vehicle fleets this is the difference between a snappy modal
    // and a freezing one, since `<select>` with thousands of options re-renders
    // on every submit cycle.
    const linkCandidates = useMemo(() => {
        const all = vehicles as Vehicle[];
        const sameCategory = all
            .filter(v => v.id !== vehicleData?.id && v.weightCategory === weightCategory)
            .sort((a, b) => a.registration.localeCompare(b.registration));
        // Keep the currently-set partner visible even if it's a different
        // category (legacy or intentional cross-category links).
        if (linkedVehicleId && !sameCategory.find(v => v.id === linkedVehicleId)) {
            const current = all.find(v => v.id === linkedVehicleId);
            if (current) return [current, ...sameCategory];
        }
        return sameCategory;
    }, [vehicles, vehicleData?.id, weightCategory, linkedVehicleId]);

    // Suggest a pair when the registration is close to another vehicle's.
    // Searches across ALL vehicles (not just same-category candidates) so
    // suggestions can cross categories if that's what the regs imply.
    const suggestedPartner = useMemo(
        () => findSimilarRegPartner(
            registration,
            (vehicles as Vehicle[]).filter(v => v.id !== vehicleData?.id),
            vehicleData?.id,
        ),
        [registration, vehicles, vehicleData?.id],
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (submitting) return;
        setSubmitting(true);
        try {
            await onSubmit({
                name,
                make,
                model,
                year,
                registration,
                vin,
                branch,
                weightCategory,
                status,
                purchasePrice,
                currentHours: vehicleData?.currentHours,
                assignedDriverId: vehicleData?.assignedDriverId,
                linkedVehicleId: linkedVehicleId || undefined,
            });
        } finally {
            setSubmitting(false);
        }
    };

    const inputClasses = "w-full bg-gray-700 text-white p-3 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-secondary transition-all";
    const labelClasses = "block text-sm font-medium text-gray-400 mb-1 ml-1";

    return (
        <form onSubmit={handleSubmit}>
            <h2 className="text-2xl font-bold mb-6 text-white">{vehicleData ? `Edit ${vehicleData.registration}` : 'Add New Asset'}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                <div className="col-span-2 md:col-span-1">
                    <label className={labelClasses}>Asset Name / Code</label>
                    <input type="text" placeholder="e.g. JHB-TRUCK-42" value={name} onChange={e => setName(e.target.value)} required className={inputClasses} />
                </div>
                <div className="col-span-2 md:col-span-1">
                    <label className={labelClasses}>Registration Number</label>
                    <input type="text" placeholder="e.g. JHB 123 GP" value={registration} onChange={e => setRegistration(e.target.value)} required className={inputClasses} />
                </div>
                <div>
                    <label className={labelClasses}>Make</label>
                    <input type="text" placeholder="e.g. Scania" value={make} onChange={e => setMake(e.target.value)} required className={inputClasses} />
                </div>
                <div>
                    <label className={labelClasses}>Model</label>
                    <input type="text" placeholder="e.g. R460" value={model} onChange={e => setModel(e.target.value)} required className={inputClasses} />
                </div>
                <div>
                    <label className={labelClasses}>Year</label>
                    <input type="number" value={year} onChange={e => setYear(parseInt(e.target.value))} required className={inputClasses} />
                </div>
                <div>
                    <label className={labelClasses}>VIN Number</label>
                    <input type="text" placeholder="Full VIN" value={vin} onChange={e => setVin(e.target.value)} required className={inputClasses} />
                </div>
                <div>
                    <label className={labelClasses}>Operating Branch</label>
                    <select value={branch} onChange={e => setBranch(e.target.value as any)} className={inputClasses}>
                        {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                </div>
                <div>
                    <label className={labelClasses}>Asset Category</label>
                    <select value={weightCategory} onChange={e => setWeightCategory(e.target.value)} className={inputClasses}>
                        {VEHICLE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div>
                    <label className={labelClasses}>Current Status</label>
                    <select value={status} onChange={e => setStatus(e.target.value as VehicleStatus)} className={inputClasses}>
                        {VEHICLE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                <div>
                    <label className={labelClasses}>Purchase Price (R)</label>
                    <input type="number" placeholder="0" value={purchasePrice} onChange={e => setPurchasePrice(parseFloat(e.target.value))} required className={inputClasses} />
                </div>
                {/* Pair / Superlink link — show for any vehicle. Trailers benefit
                    most (6m + 12m), but it's optional for everything. */}
                <div className="col-span-2">
                    <label className={labelClasses}>Linked Vehicle (Pair / Superlink Partner)</label>
                    <select
                        value={linkedVehicleId}
                        onChange={e => setLinkedVehicleId(e.target.value)}
                        className={inputClasses}
                    >
                        <option value="">— None —</option>
                        {linkCandidates.map(v => (
                            <option key={v.id} value={v.id}>
                                {v.name} ({v.registration}){v.id === suggestedPartner?.id ? '  ★ similar reg' : ''}
                            </option>
                        ))}
                    </select>
                    {suggestedPartner && suggestedPartner.id !== linkedVehicleId && (
                        <button
                            type="button"
                            onClick={() => setLinkedVehicleId(suggestedPartner.id)}
                            className="mt-2 text-xs text-blue-400 hover:text-blue-300 underline"
                        >
                            Use suggested pair: {suggestedPartner.name} ({suggestedPartner.registration})
                        </button>
                    )}
                </div>
            </div>
            <div className="flex justify-end space-x-4 mt-8 pt-4 border-t border-gray-700">
                <button type="button" onClick={onCancel} disabled={submitting} className="px-6 py-2 text-gray-400 hover:text-white font-semibold disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={submitting} className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2.5 px-8 rounded-lg shadow-lg transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed">
                    {submitting ? (vehicleData ? 'Updating…' : 'Saving…') : (vehicleData ? 'Update Asset' : 'Register Asset')}
                </button>
            </div>
        </form>
    );
};

export default AddVehicleForm;
