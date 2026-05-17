
import React from 'react';
import * as XLSX from 'xlsx';
import { OtherCost, Vehicle } from '../../types';
import { UploadIcon } from '../icons/UploadIcon';
import { DEFAULT_COST_CATEGORIES } from '../../constants';

interface BulkImportCostsModalProps {
    vehicles: Vehicle[];
    onImport: (costs: Omit<OtherCost, 'id'>[]) => void;
    onClose: () => void;
}

const BulkImportCostsModal: React.FC<BulkImportCostsModalProps> = ({ vehicles, onImport, onClose }) => {

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json<any>(worksheet);

                const newCosts: Omit<OtherCost, 'id'>[] = json.map((row, index) => {
                    const reg = row['Vehicle Registration'] || row['Reg'];
                    const vehicle = vehicles.find(v => v.registration.replace(/\s/g, '').toUpperCase() === reg.toString().replace(/\s/g, '').toUpperCase());
                    
                    if (!vehicle) {
                        throw new Error(`Row ${index + 2}: Vehicle with registration '${reg}' not found.`);
                    }

                    return {
                        vehicleId: vehicle.id,
                        date: (row['Date'] || new Date().toISOString().slice(0, 7)).toString(),
                        category: (row['Category'] || 'Other').toString(),
                        amount: parseFloat(row['Amount']) || 0,
                    };
                });

                if (newCosts.length > 0) {
                    onImport(newCosts);
                    onClose();
                } else {
                    alert('No valid cost records found in the file.');
                }
            } catch (error) {
                alert(`Error processing file: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        };
        reader.readAsArrayBuffer(file);
        event.target.value = '';
    };

    const REQUIRED_HEADERS = ['Vehicle Registration', 'Date', 'Category', 'Amount'];

    return (
        <div className="p-2">
            <h2 className="text-2xl font-bold mb-4 text-white">Bulk Import Fleet Costs</h2>
            <p className="text-gray-400 mb-6 text-sm">
                Import expenses like tolls, permits, or fines. Ensure your file matches the required registration numbers.
            </p>

            <div className="mb-6 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Required Headers</h4>
                <div className="flex flex-wrap gap-2">
                    {REQUIRED_HEADERS.map(h => (
                        <span key={h} className="px-2 py-1 bg-gray-700 text-gray-300 text-[10px] font-mono rounded border border-gray-600">{h}</span>
                    ))}
                </div>
            </div>

            <label className="flex flex-col items-center justify-center w-full h-48 bg-gray-700 rounded-xl border-2 border-dashed border-gray-600 cursor-pointer hover:border-blue-500 hover:bg-gray-600/50 transition-all group">
                <UploadIcon className="h-12 w-12 text-gray-500 mb-3 group-hover:text-blue-400 group-hover:scale-110 transition-all" />
                <span className="text-gray-300 font-semibold">Click to upload spreadsheet</span>
                <span className="text-xs text-gray-500 mt-1">Excel or CSV supported</span>
                <input type="file" onChange={handleFileChange} className="hidden" accept=".xlsx, .xls, .csv" />
            </label>

            <div className="mt-6">
                <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Standard Categories</h4>
                <div className="flex flex-wrap gap-1.5">
                    {DEFAULT_COST_CATEGORIES.map(c => (
                        <span key={c} className="px-2 py-0.5 bg-gray-800 text-gray-400 text-[10px] rounded">{c}</span>
                    ))}
                </div>
            </div>

            <div className="flex justify-end mt-8">
                <button type="button" onClick={onClose} className="px-6 py-2 text-gray-400 hover:text-white font-semibold">Cancel</button>
            </div>
        </div>
    );
};

export default BulkImportCostsModal;
