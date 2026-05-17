
import React, { useState } from 'react';
import { LoadConfirmation } from '../../types';
import { format } from 'date-fns';
import Modal from '../Modal';

interface SupplierLoadListProps {
    loadConfirmations: LoadConfirmation[];
}

// Dummy modal for demonstration
const UpdateLoadModal: React.FC<{ loadCon: LoadConfirmation, onCancel: () => void }> = ({ loadCon, onCancel }) => {
    const [vehicleReg, setVehicleReg] = useState(loadCon.subcontractorVehicleReg || '');
    const [driverName, setDriverName] = useState(loadCon.subcontractorDriverName || '');
    const [driverCell, setDriverCell] = useState(loadCon.subcontractorDriverCell || '');
    
    return (
        <div>
            <h2 className="text-2xl font-bold mb-4 text-white">Update Load Details</h2>
            <p className="text-gray-400 mb-6 font-mono">{loadCon.loadConNumber}</p>
            <div className="space-y-4">
                <input value={vehicleReg} onChange={e => setVehicleReg(e.target.value)} placeholder="Vehicle Registration" className="w-full bg-gray-700 p-2 rounded-md"/>
                <input value={driverName} onChange={e => setDriverName(e.target.value)} placeholder="Driver Name" className="w-full bg-gray-700 p-2 rounded-md"/>
                <input value={driverCell} onChange={e => setDriverCell(e.target.value)} placeholder="Driver Cell" className="w-full bg-gray-700 p-2 rounded-md"/>
            </div>
            <div className="flex justify-end space-x-4 mt-8">
                <button onClick={onCancel} className="bg-gray-600 py-2 px-4 rounded-lg">Cancel</button>
                <button className="bg-blue-600 py-2 px-4 rounded-lg">Save</button>
            </div>
        </div>
    );
}

const SupplierLoadList: React.FC<SupplierLoadListProps> = ({ loadConfirmations }) => {
    const [selectedLoad, setSelectedLoad] = useState<LoadConfirmation | null>(null);

    return (
        <>
            <div className="space-y-4">
                {loadConfirmations.map(lc => (
                    <div key={lc.id} className="bg-gray-800 p-4 rounded-lg">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="font-bold text-white">{lc.collectionPoint} &rarr; {lc.deliveryPoint}</p>
                                <p className="text-sm text-gray-400 font-mono">{lc.loadConNumber}</p>
                            </div>
                            <div className="text-right">
                                <p className="font-mono text-lg text-green-400">R {lc.supplierRate?.toFixed(2)}</p>
                                <p className="text-xs text-gray-500">{lc.status}</p>
                            </div>
                        </div>
                         <div className="flex justify-end gap-2 mt-2">
                             <button onClick={() => alert('Printing load con...')} className="text-xs font-semibold bg-gray-600 text-white py-1 px-3 rounded-lg">Print LoadCon</button>
                            <button onClick={() => setSelectedLoad(lc)} className="text-xs font-semibold bg-blue-600 text-white py-1 px-3 rounded-lg">Update Details</button>
                            <button onClick={() => alert('Uploading POD...')} className="text-xs font-semibold bg-green-600 text-white py-1 px-3 rounded-lg">Submit POD</button>
                        </div>
                    </div>
                ))}
            </div>
            {selectedLoad && (
                <Modal isOpen={!!selectedLoad} onClose={() => setSelectedLoad(null)}>
                    <UpdateLoadModal loadCon={selectedLoad} onCancel={() => setSelectedLoad(null)} />
                </Modal>
            )}
        </>
    );
};

export default SupplierLoadList;
