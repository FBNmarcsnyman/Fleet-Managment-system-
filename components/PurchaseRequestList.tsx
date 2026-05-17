import React, { useState, useMemo } from 'react';
import { PurchaseRequest, Part, User } from '../types';
import { PlusIcon } from './icons/PlusIcon';
import { format } from 'date-fns';

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

interface PurchaseRequestListProps {
    purchaseRequests: PurchaseRequest[];
    parts: Part[];
    users: User[];
    onOpenCreateModal: () => void;
}

const PurchaseRequestList: React.FC<PurchaseRequestListProps> = ({ purchaseRequests, parts, users, onOpenCreateModal }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const partMap = new Map(parts.map(p => [p.id, p.name]));
    const userMap = new Map(users.map(u => [u.email, u.name]));

    const paginatedRequests = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return purchaseRequests.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [purchaseRequests, currentPage]);

    const totalPages = Math.ceil(purchaseRequests.length / ITEMS_PER_PAGE);

    const getStatusColor = (status: PurchaseRequest['status']) => {
        const colors: { [key in PurchaseRequest['status']]: string } = {
            'Pending': 'bg-yellow-900/50 text-yellow-300',
            'Awaiting Quotes': 'bg-blue-900/50 text-blue-300',
            'Awaiting Approval': 'bg-purple-900/50 text-purple-300',
            'Approved': 'bg-green-900/50 text-green-300',
            'Rejected': 'bg-red-900/50 text-red-300',
            'Ordered': 'bg-teal-900/50 text-teal-300',
            'Completed': 'bg-gray-700 text-gray-400',
        };
        return colors[status] || 'bg-gray-700';
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-white">Purchase Requests</h3>
                <button onClick={onOpenCreateModal} className="flex items-center font-bold py-2 px-4 rounded-lg bg-brand-primary hover:bg-brand-secondary text-white">
                    <PlusIcon className="h-5 w-5 mr-2" /> Create Request
                </button>
            </div>
            <div className="overflow-x-auto max-h-[60vh]">
                <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-gray-800">
                        <tr className="border-b border-gray-700">
                            <th className="p-2 text-gray-400">Part</th>
                            <th className="p-2 text-gray-400 text-center">Qty</th>
                            <th className="p-2 text-gray-400">Date</th>
                            <th className="p-2 text-gray-400">Requested By</th>
                            <th className="p-2 text-gray-400 text-center">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedRequests.map(req => (
                            <tr key={req.id} className="border-b border-gray-700/50">
                                <td className="p-2 font-semibold text-white">{partMap.get(req.partId) || 'Unknown Part'}</td>
                                <td className="p-2 text-center font-mono">{req.quantity}</td>
                                <td className="p-2">{format(new Date(req.requestedDate), 'dd MMM yyyy')}</td>
                                <td className="p-2">{userMap.get(req.requestedByUserId) || req.requestedByUserId}</td>
                                <td className="p-2 text-center">
                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(req.status)}`}>
                                        {req.status}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
             <PaginationControls currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </div>
    );
};

export default PurchaseRequestList;