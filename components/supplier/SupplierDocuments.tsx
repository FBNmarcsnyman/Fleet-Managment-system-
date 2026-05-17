
import React from 'react';
import { Supplier } from '../../types';
import { UploadIcon } from '../icons/UploadIcon';

interface SupplierDocumentsProps {
    supplier: Supplier;
}

const SupplierDocuments: React.FC<SupplierDocumentsProps> = ({ supplier }) => {
    const requiredDocs = [
        'Company Registration',
        'Tax Clearance Certificate',
        'Letter of Good Standing',
        'Public Liability Insurance',
    ];

    return (
        <div className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-2xl font-bold text-white mb-6">Compliance Documents</h2>
            <div className="space-y-4">
                {requiredDocs.map(doc => (
                    <div key={doc} className="bg-gray-700/50 p-3 rounded-md flex justify-between items-center">
                        <span className="font-semibold text-white">{doc}</span>
                        {/* A real app would check if the doc exists */}
                        <label className="cursor-pointer text-sm font-semibold text-blue-400 flex items-center">
                            <UploadIcon className="h-4 w-4 mr-2"/> Upload
                            <input type="file" className="hidden" />
                        </label>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SupplierDocuments;
