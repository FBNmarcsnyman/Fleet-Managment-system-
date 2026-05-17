
import React from 'react';
import * as XLSX from 'xlsx';
import { Supplier } from '../../types';
import { UploadIcon } from '../icons/UploadIcon';

interface BulkImportSuppliersModalProps {
    onImport: (suppliers: Omit<Supplier, 'id'>[]) => void;
    onClose: () => void;
    type: 'Transport' | 'Workshop';
}

const BulkImportSuppliersModal: React.FC<BulkImportSuppliersModalProps> = ({ onImport, onClose, type }) => {

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

                const newSuppliers: Omit<Supplier, 'id'>[] = json.map((row, index) => {
                    const name = row['Supplier Name'];
                    if (!name) {
                        throw new Error(`Row ${index + 2}: Missing required header 'Supplier Name'.`);
                    }
                    return {
                        name: name,
                        type: type,
                        contactPerson: row['Contact Person'] || '',
                        contactEmail: row['Email'] || '',
                        contactPhone: row['Phone'] || '',
                        address: row['Address'] || '',
                        complianceStatus: 'Pending',
                        complianceDocs: [],
                        rateCards: []
                    };
                });

                if (newSuppliers.length > 0) {
                    onImport(newSuppliers);
                    alert(`Successfully imported ${newSuppliers.length} ${type === 'Transport' ? 'subcontractors' : 'suppliers'}.`);
                    onClose();
                } else {
                    alert('No suppliers found in the file.');
                }
            } catch (error) {
                alert(`Error processing file: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        };
        reader.readAsArrayBuffer(file);
        event.target.value = ''; // Reset file input
    };
    
    const headers = ['Supplier Name', 'Contact Person', 'Email', 'Phone', 'Address'];

    return (
        <div>
            <h2 className="text-2xl font-bold mb-4 text-white">Bulk Import {type === 'Transport' ? 'Subcontractors' : 'Suppliers'}</h2>
            <p className="text-gray-400 mb-6">
                Upload a CSV or Excel file to import multiple {type === 'Transport' ? 'subcontractors' : 'suppliers'} at once.
            </p>

            <label className="flex flex-col items-center justify-center w-full px-4 py-10 bg-gray-700 rounded-lg border-2 border-dashed border-gray-600 cursor-pointer hover:border-brand-secondary hover:bg-gray-600/50 transition-colors">
                <UploadIcon className="h-12 w-12 text-gray-400 mb-2" />
                <span className="text-lg font-semibold text-gray-300">Click to upload a file</span>
                <span className="text-sm text-gray-500">(.xlsx, .xls, .csv)</span>
                <input type="file" onChange={handleFileChange} className="hidden" accept=".xlsx, .xls, .csv" />
            </label>

            <div className="text-sm p-4 bg-gray-900/50 rounded-lg text-gray-300 mt-6">
                <h4 className="font-semibold text-white mb-2">File Format Instructions:</h4>
                <p className="mb-2">Your file must contain the following headers in the first row:</p>
                <div className="flex flex-wrap gap-2">
                    {headers.map(header => (
                        <code key={header} className="text-xs bg-gray-700 p-1 rounded whitespace-nowrap">{header}</code>
                    ))}
                </div>
                 <p className="mt-2 text-xs text-gray-400">'Supplier Name' is required for each row.</p>
            </div>

            <div className="flex justify-end space-x-4 mt-8">
                <button type="button" onClick={onClose} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg">Close</button>
            </div>
        </div>
    );
};

export default BulkImportSuppliersModal;
