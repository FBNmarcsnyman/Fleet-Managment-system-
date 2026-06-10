import React, { useState } from 'react';
import { useVehicles, useUIState } from '../../contexts/AppContexts';
import { Vehicle } from '../../types';

const BulkAssignDriversModal: React.FC = () => {
    const { vehicles = [], handleAssignDriverToVehicle } = useVehicles();
    const { hideModal } = useUIState();
    const [report, setReport] = useState<string | null>(null);

    const parseCsv = (text: string) => {
        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        const rows = lines.map(l => l.split(',').map(c => c.trim()));
        return rows;
    };

    const handleFile = async (f: File | null) => {
        if (!f) return;
        const txt = await f.text();
        const rows = parseCsv(txt);
        // Expect header: registration,driverEmail  OR vehicleId,driverEmail
        const header = rows[0].map(h => h.toLowerCase());
        const dataRows = rows.slice(1);
        const unmatched: string[] = [];
        let assignedCount = 0;

        for (const r of dataRows) {
            if (r.length < 2) continue;
            const key = r[0];
            const driver = r[1];
            let vehicle: Vehicle | undefined = undefined;
            // try match by id
            vehicle = (vehicles as Vehicle[]).find(v => v.id === key || (v.registration && v.registration.toUpperCase().replace(/[^A-Z0-9]/g, '') === key.toUpperCase().replace(/[^A-Z0-9]/g, '')) || v.registration === key || v.name === key);
            if (!vehicle) {
                unmatched.push(key + ' → ' + driver);
                continue;
            }
            await handleAssignDriverToVehicle(vehicle.id, driver || null);
            assignedCount++;
        }

        setReport(`Assigned: ${assignedCount}. Unmatched rows: ${unmatched.length}\n${unmatched.slice(0,50).join('\n')}`);
    };

    return (
        <div>
            <h2 className="text-2xl font-bold mb-4 text-white">Bulk Assign Drivers</h2>
            <p className="text-gray-400 mb-4">Upload a CSV with header: <strong>registration,driverEmail</strong> (or vehicle id).</p>
            <input type="file" accept="text/csv,text/plain" onChange={e => handleFile(e.target.files?.[0] ?? null)} />
            {report && (
                <pre className="mt-4 bg-gray-900 p-3 rounded text-sm whitespace-pre-wrap">{report}</pre>
            )}
            <div className="flex justify-end mt-6">
                <button onClick={() => hideModal()} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded">Close</button>
            </div>
        </div>
    );
};

export default BulkAssignDriversModal;
