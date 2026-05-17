
import React from 'react';
import * as XLSX from 'xlsx';
import { Vehicle, Branch } from '../../types';
import { UploadIcon } from '../icons/UploadIcon';
import { BRANCHES } from '../../constants';

interface BulkImportAssetsModalProps {
    onImport: (vehicles: Omit<Vehicle, 'id'>[]) => void;
    onClose: () => void;
}

const BulkImportAssetsModal: React.FC<BulkImportAssetsModalProps> = ({ onImport, onClose }) => {

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

                const newVehicles: Omit<Vehicle, 'id'>[] = json.map((row, index) => {
                    const registration = row['Registration'] || row['Reg'];
                    const name = row['Name'] || row['Asset Code'];
                    
                    if (!registration || !name) {
                        throw new Error(`Row ${index + 2}: 'Registration' and 'Name' are required.`);
                    }

                    return {
                        name: name.toString(),
                        registration: registration.toString(),
                        make: (row['Make'] || 'Unknown').toString(),
                        model: (row['Model'] || 'Unknown').toString(),
                        year: parseInt(row['Year']) || new Date().getFullYear(),
                        vin: (row['VIN'] || 'N/A').toString(),
                        branch: (BRANCHES.includes(row['Branch']) ? row['Branch'] : BRANCHES[0]) as Branch,
                        weightCategory: (row['Category'] || 'Horse').toString(),
                        status: 'On the road',
                        purchasePrice: parseFloat(row['Purchase Price']) || 0,
                        currentValue: parseFloat(row['Purchase Price']) || 0,
                    };
                });

                if (newVehicles.length > 0) {
                    onImport(newVehicles);
                    onClose();
                } else {
                    alert('No valid asset records found in the file.');
                }
            } catch (error) {
                alert(`Error processing file: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        };
        reader.readAsArrayBuffer(file);
        event.target.value = '';
    };

    const REQUIRED_HEADERS = ['Name', 'Registration', 'Make', 'Model', 'Year', 'VIN', 'Branch', 'Category', 'Purchase Price'];

    return (
        <div className="p-2">
            <h2 className="text-2xl font-bold mb-4 text-white">Bulk Import Assets</h2>
            <p className="text-gray-400 mb-6 text-sm">
                Upload an Excel (.xlsx, .xls) or CSV file containing your fleet data. Ensure your file has the correct column headers.
            </p>

            <div className="mb-6 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Required Template Headers</h4>
                <div className="flex flex-wrap gap-2">
                    {REQUIRED_HEADERS.map(h => (
                        <span key={h} className="px-2 py-1 bg-gray-700 text-gray-300 text-[10px] font-mono rounded border border-gray-600">{h}</span>
                    ))}
                </div>
            </div>

            <label className="flex flex-col items-center justify-center w-full h-48 bg-gray-700 rounded-xl border-2 border-dashed border-gray-600 cursor-pointer hover:border-blue-500 hover:bg-gray-600/50 transition-all group">
                <UploadIcon className="h-12 w-12 text-gray-500 mb-3 group-hover:text-blue-400 group-hover:scale-110 transition-all" />
                <span className="text-gray-300 font-semibold">Click to browse or drag & drop</span>
                <span className="text-xs text-gray-500 mt-1">Excel or CSV files supported</span>
                <input type="file" onChange={handleFileChange} className="hidden" accept=".xlsx, .xls, .csv" />
            </label>

            <div className="flex justify-end mt-8">
                <button type="button" onClick={onClose} className="px-6 py-2 text-gray-400 hover:text-white font-semibold">Cancel</button>
            </div>
        </div>
    );
};

export default BulkImportAssetsModal;
