import React from 'react';
import { Supplier } from '../../types';
import { PlusIcon } from '../icons/PlusIcon';
import { UploadIcon } from '../icons/UploadIcon';
import { useUIState, useOperations } from '../../contexts/AppContexts';

const SubcontractorManagementView: React.FC = () => {
    const { showModal } = useUIState();
    const { suppliers = [], handleBulkAddSuppliers } = useOperations();

    const subcontractors = (suppliers || []).filter((s: Supplier) => s.type === 'Transport');

    const handleOpenBulkImport = () => {
        showModal('bulkImportSuppliers', {
            onImport: handleBulkAddSuppliers,
            onClose: () => showModal('hide'),
            type: 'Transport',
        });
    };
    
    const handleOpenAddModal = () => {
        showModal('addSupplier', { defaultType: 'Transport' });
    };

    const handleEdit = (supplier: Supplier) => {
        showModal('addSupplier', { supplier });
    };

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-white">Subcontractors</h3>
                <div className="flex items-center space-x-2">
                     <button onClick={handleOpenBulkImport} className="flex items-center font-bold py-2 px-4 rounded-lg bg-gray-600 hover:bg-gray-700 text-white">
                        <UploadIcon className="h-5 w-5 mr-2" /> Bulk Import
                    </button>
                    <button onClick={handleOpenAddModal} className="flex items-center font-bold py-2 px-4 rounded-lg bg-brand-primary hover:bg-brand-secondary text-white">
                        <PlusIcon className="h-5 w-5 mr-2" /> Add Subcontractor
                    </button>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead>
                         <tr className="border-b border-gray-700">
                            <th className="p-2 text-gray-400">Company Name</th>
                            <th className="p-2 text-gray-400">Contact Person</th>
                            <th className="p-2 text-gray-400">Contact Details</th>
                            <th className="p-2 text-gray-400 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {subcontractors.map((supplier: Supplier) => (
                            <tr key={supplier.id} className="border-b border-gray-700/50">
                                <td className="p-2 font-semibold text-white">{supplier.name}</td>
                                <td className="p-2">{supplier.contactPerson}</td>
                                <td className="p-2">{supplier.contactEmail} / {supplier.contactPhone}</td>
                                <td className="p-2 text-right">
                                    <button onClick={() => handleEdit(supplier)} className="px-3 py-1 rounded bg-gray-700 hover:bg-brand-secondary text-white text-xs font-bold">Edit</button>
                                </td>
                            </tr>
                        ))}
                        {subcontractors.length === 0 && (
                            <tr><td colSpan={4} className="p-6 text-center text-gray-500">No subcontractors yet. They're added automatically when you create a Transport Order, or add one manually.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default SubcontractorManagementView;