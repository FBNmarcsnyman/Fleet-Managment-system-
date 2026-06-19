import React, { useState } from 'react';
import { useUIState } from '../../contexts/AppContexts';
import { usePickOptions, addPickOption, removePickOption } from '../../hooks/usePickOptions';

// Manage the editable dropdown lists (Commodity / Packaging). Add or delete
// options — fix a mis-spelled entry by deleting it and adding the correct one.
const CATEGORIES: { key: string; label: string }[] = [
    { key: 'commodity', label: 'Commodity' },
    { key: 'packaging', label: 'Packaging' },
];

const PickListManager: React.FC = () => {
    const { hideModal } = useUIState();
    const [cat, setCat] = useState('commodity');
    const [val, setVal] = useState('');
    const options = usePickOptions(cat);

    const add = async () => { if (!val.trim()) return; await addPickOption(cat, val); setVal(''); };

    const inp = 'bg-gray-700 text-white p-2 rounded-md border border-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-brand-secondary';

    return (
        <div>
            <h2 className="text-xl font-black text-white mb-1">Manage lists</h2>
            <p className="text-xs text-gray-400 mb-4">Add or remove dropdown options. Delete a mis-spelled one and add it correctly.</p>
            <div className="flex gap-1 bg-gray-900/50 p-1 rounded-lg w-fit mb-3">
                {CATEGORIES.map(c => (
                    <button key={c.key} onClick={() => setCat(c.key)} className={`px-4 py-1.5 text-sm font-bold rounded-md ${cat === c.key ? 'bg-brand-primary text-white' : 'text-gray-400 hover:text-white'}`}>{c.label}</button>
                ))}
            </div>
            <div className="flex gap-2 mb-3">
                <input value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add(); }} placeholder={`Add a ${cat}…`} className={`${inp} flex-1`} />
                <button onClick={add} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 rounded-md text-sm">Add</button>
            </div>
            <div className="max-h-72 overflow-y-auto flex flex-wrap gap-2">
                {options.length === 0 && <p className="text-gray-500 text-sm">No options yet.</p>}
                {options.map(o => (
                    <span key={o} className="inline-flex items-center gap-2 bg-gray-700 text-gray-100 text-sm px-3 py-1.5 rounded-full">
                        {o}
                        <button onClick={() => removePickOption(cat, o)} title="Delete" className="text-gray-400 hover:text-red-400 font-bold">×</button>
                    </span>
                ))}
            </div>
            <div className="flex justify-end mt-6">
                <button onClick={hideModal} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-5 rounded-lg">Done</button>
            </div>
        </div>
    );
};

export default PickListManager;
