import React, { useRef, useState } from 'react';
import { LoadConfirmation } from '../../types';
import Modal from '../Modal';
import { useOperations, useUIState } from '../../contexts/AppContexts';
import { uploadFile } from '../../lib/supabase';

interface SupplierLoadListProps {
    loadConfirmations: LoadConfirmation[];
}

const rand = (n?: number) => `R ${(n || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Lets the subcontractor confirm their driver/vehicle details for a load.
const UpdateLoadModal: React.FC<{ loadCon: LoadConfirmation; onClose: () => void }> = ({ loadCon, onClose }) => {
    const { handleUpdateLoadConfirmation } = useOperations();
    const { showToast } = useUIState();
    const [vehicleReg, setVehicleReg] = useState(loadCon.subcontractorVehicleReg || '');
    const [driverName, setDriverName] = useState(loadCon.subcontractorDriverName || '');
    const [driverCell, setDriverCell] = useState(loadCon.subcontractorDriverCell || '');
    const [saving, setSaving] = useState(false);

    const save = async () => {
        if (saving) return;
        setSaving(true);
        const res = await handleUpdateLoadConfirmation(loadCon.id, {
            subcontractorVehicleReg: vehicleReg, subcontractorDriverName: driverName, subcontractorDriverCell: driverCell,
        });
        setSaving(false);
        if (res && res.ok === false) { showToast(`Could not save: ${res.error}`); return; }
        showToast('Details updated.');
        onClose();
    };

    const cls = "w-full bg-gray-700 text-white p-2.5 rounded-md border border-gray-600";
    return (
        <div>
            <h2 className="text-2xl font-bold mb-1 text-white">Update Load Details</h2>
            <p className="text-gray-400 mb-6 font-mono">{loadCon.loadConNumber}</p>
            <div className="space-y-3">
                <input value={vehicleReg} onChange={e => setVehicleReg(e.target.value)} placeholder="Vehicle Registration" className={cls} />
                <input value={driverName} onChange={e => setDriverName(e.target.value)} placeholder="Driver Name" className={cls} />
                <input value={driverCell} onChange={e => setDriverCell(e.target.value)} placeholder="Driver Cell" className={cls} />
            </div>
            <div className="flex justify-end space-x-3 mt-8">
                <button onClick={onClose} className="bg-gray-600 py-2 px-4 rounded-lg text-white">Cancel</button>
                <button onClick={save} disabled={saving} className="bg-blue-600 py-2 px-4 rounded-lg text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
            </div>
        </div>
    );
};

const SupplierLoadList: React.FC<SupplierLoadListProps> = ({ loadConfirmations }) => {
    const { handleUpdateLoadConfirmation } = useOperations();
    const { showToast } = useUIState();
    const [selectedLoad, setSelectedLoad] = useState<LoadConfirmation | null>(null);
    const [uploadingId, setUploadingId] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const podForId = useRef<string | null>(null);

    const startPodUpload = (id: string) => { podForId.current = id; fileRef.current?.click(); };

    const onPodFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        const id = podForId.current;
        e.target.value = '';
        if (!file || !id) return;
        setUploadingId(id);
        try {
            const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            const up = await uploadFile('driver-docs', `pods/${id}_${Date.now()}_${safe}`, file);
            if (up.error || !up.url) { showToast(`POD upload failed: ${up.error || 'unknown error'}`); return; }
            const res = await handleUpdateLoadConfirmation(id, {
                podPhoto: { name: file.name, type: file.type, data: up.url },
                status: 'POD Submitted', paymentStatus: 'Awaiting Review',
            });
            if (res && res.ok === false) { showToast(`Could not save POD: ${res.error}`); return; }
            showToast('POD submitted — thank you!');
        } catch (err) {
            showToast(`POD upload failed: ${err instanceof Error ? err.message : 'unknown error'}`);
        } finally {
            setUploadingId(null);
            podForId.current = null;
        }
    };

    const sorted = [...loadConfirmations].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return (
        <>
            <h1 className="text-2xl font-black text-white mb-1">My Loads</h1>
            <p className="text-gray-400 text-sm mb-5">Confirm your driver details and submit the POD once delivered.</p>
            <input ref={fileRef} type="file" accept="image/*,application/pdf" capture="environment" className="hidden" onChange={onPodFile} />
            <div className="space-y-4">
                {sorted.map(lc => (
                    <div key={lc.id} className="bg-gray-800 p-4 rounded-lg">
                        <div className="flex justify-between items-start">
                            <div className="min-w-0">
                                <p className="font-bold text-white truncate">{lc.collectionPoint} &rarr; {lc.deliveryPoint}</p>
                                <p className="text-sm text-gray-400 font-mono">{lc.loadConNumber}</p>
                                {lc.collectionDate && <p className="text-xs text-gray-500 mt-0.5">Collect: {new Date(lc.collectionDate).toLocaleDateString('en-ZA')}</p>}
                            </div>
                            <div className="text-right shrink-0 ml-3">
                                <p className="font-mono text-lg text-green-400">{rand(lc.supplierRate)}</p>
                                <p className="text-xs text-gray-500">{lc.status}</p>
                                {lc.podPhoto && <p className="text-[11px] text-emerald-400 font-bold mt-0.5">POD received ✓</p>}
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-3">
                            <button onClick={() => setSelectedLoad(lc)} className="text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white py-1.5 px-3 rounded-lg">Update Details</button>
                            {lc.podPhoto ? (
                                <a href={lc.podPhoto.data} target="_blank" rel="noreferrer" className="text-xs font-semibold bg-gray-600 hover:bg-gray-500 text-white py-1.5 px-3 rounded-lg">View POD</a>
                            ) : (
                                <button onClick={() => startPodUpload(lc.id)} disabled={uploadingId === lc.id} className="text-xs font-semibold bg-green-600 hover:bg-green-700 text-white py-1.5 px-3 rounded-lg disabled:opacity-50">
                                    {uploadingId === lc.id ? 'Uploading…' : 'Submit POD'}
                                </button>
                            )}
                        </div>
                    </div>
                ))}
                {sorted.length === 0 && <p className="text-center text-gray-500 py-16">No loads assigned to you yet.</p>}
            </div>
            {selectedLoad && (
                <Modal isOpen={!!selectedLoad} onClose={() => setSelectedLoad(null)}>
                    <UpdateLoadModal loadCon={selectedLoad} onClose={() => setSelectedLoad(null)} />
                </Modal>
            )}
        </>
    );
};

export default SupplierLoadList;
