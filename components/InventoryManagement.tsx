import React, { useState, useMemo } from 'react';
import { Part, Supplier } from '../types';
import { PlusIcon } from './icons/PlusIcon';
import { ExclamationTriangleIcon } from './icons/ExclamationTriangleIcon';

const ITEMS_PER_PAGE = 15;

const PaginationControls: React.FC<{ currentPage: number; totalPages: number; onPageChange: (page: number) => void; }> = ({ currentPage, totalPages, onPageChange }) => {
    if (totalPages <= 1) return null;
    return (
        <div className="flex justify-center items-center space-x-2 mt-4">
            <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className="px-3 py-1 rounded-md bg-gray-700 disabled:opacity-50">&laquo;</button>
            <span className="text-sm text-gray-400">Page {currentPage} of {totalPages}</span>
            <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} className="px-3 py-1 rounded-md bg-gray-700 disabled:opacity-50">&raquo;</button>
        </div>
    );
};

interface InventoryManagementProps {
    parts: Part[];
    suppliers: Supplier[];
    onAddPart: () => void;
    onOpenAssignModal: (part: Part) => void;
}

const InventoryManagement: React.FC<InventoryManagementProps> = ({ parts, suppliers, onAddPart, onOpenAssignModal }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const supplierMap = new Map(suppliers.map(s => [s.id, s.name]));

    const formatCurrency = (value: number) => `R ${value.toFixed(2)}`;

    const paginatedParts = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return parts.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [parts, currentPage]);

    const totalPages = Math.ceil(parts.length / ITEMS_PER_PAGE);

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-white">Current Stock</h3>
                <button onClick={onAddPart} className="flex items-center font-bold py-2 px-4 rounded-lg bg-green-600 hover:bg-green-700 text-white">
                    <PlusIcon className="h-5 w-5 mr-2" /> Add New Part
                </button>
            </div>
            <div className="overflow-x-auto max-h-[60vh]">
                <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-gray-800">
                        <tr className="border-b border-gray-700">
                            <th className="p-2 text-gray-400">Part Name</th>
                            <th className="p-2 text-gray-400">Supplier</th>
                            <th className="p-2 text-gray-400 text-right">Last Cost</th>
                            <th className="p-2 text-gray-400 text-center">In Stock</th>
                            <th className="p-2 text-gray-400 text-center">Reorder Pt.</th>
                            <th className="p-2 text-gray-400 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedParts.map(part => {
                            const isLowStock = part.quantityInStock <= part.minStockLevel;
                            return (
                                <tr key={part.id} className={`border-b border-gray-700/50 ${isLowStock ? 'bg-red-900/30' : ''}`}>
                                    <td className="p-2">
                                        <p className="font-semibold text-white">{part.name}</p>
                                        <p className="font-mono text-xs text-gray-400">{part.partNumber || 'N/A'}</p>
                                    </td>
                                    <td className="p-2 text-gray-300">{supplierMap.get(part.supplierId || '') || 'N/A'}</td>
                                    <td className="p-2 text-right font-mono text-gray-300">{formatCurrency(part.cost)}</td>
                                    <td className={`p-2 text-center font-mono ${isLowStock ? 'text-red-400 font-bold' : ''}`}>
                                        <div className="flex items-center justify-center">
                                            {isLowStock && <div title="Stock is at or below reorder point"><ExclamationTriangleIcon className="h-4 w-4 mr-2 text-red-400" /></div>}
                                            {part.quantityInStock}
                                        </div>
                                    </td>
                                    <td className="p-2 text-center font-mono">{part.minStockLevel}</td>
                                    <td className="p-2 text-right">
                                        <button 
                                            onClick={() => onOpenAssignModal(part)} 
                                            disabled={part.quantityInStock <= 0}
                                            className="text-xs font-semibold py-1 px-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
                                        >
                                            Assign
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <PaginationControls currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </div>
    );
};

export default InventoryManagement;