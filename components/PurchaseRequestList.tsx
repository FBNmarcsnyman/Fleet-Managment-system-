import React, { useState, useMemo } from 'react';
import { PurchaseRequest, Part, User } from '../types';
import { PlusIcon } from './icons/PlusIcon';
import { format } from 'date-fns';

const ITEMS_PER_PAGE = 15;
const MANAGER_ROLES = ['Super Admin', 'Admin', 'Manager', 'Workshop Manager'];

interface PurchaseRequestListProps {
    purchaseRequests: PurchaseRequest[];
    parts: Part[];
    users: User[];
    currentUser?: User;
    onOpenCreateModal: () => void;
    onApprove?: (id: string) => void;
    onReject?: (id: string) => void;
    onRaisePo?: (req: PurchaseRequest) => void;
}

const statusChip: Record<string, string> = {
    Pending: 'bg-amber-100 text-amber-700',
    'Awaiting Quotes': 'bg-blue-100 text-blue-700',
    'Awaiting Approval': 'bg-violet-100 text-violet-700',
    Approved: 'bg-emerald-100 text-emerald-700',
    Rejected: 'bg-red-100 text-red-700',
    Ordered: 'bg-teal-100 text-teal-700',
    Completed: 'bg-slate-100 text-slate-500',
};

const PurchaseRequestList: React.FC<PurchaseRequestListProps> = ({ purchaseRequests, parts, users, currentUser, onOpenCreateModal, onApprove, onReject, onRaisePo }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const partMap = useMemo(() => new Map(parts.map(p => [p.id, p.name])), [parts]);
    const userMap = useMemo(() => new Map(users.map(u => [u.email, u.name])), [users]);
    const isManager = !!currentUser && MANAGER_ROLES.includes(currentUser.role);

    const paginated = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return purchaseRequests.slice(start, start + ITEMS_PER_PAGE);
    }, [purchaseRequests, currentPage]);
    const totalPages = Math.ceil(purchaseRequests.length / ITEMS_PER_PAGE);

    const needsAuth = (s: string) => s === 'Pending' || s === 'Awaiting Approval' || s === 'Awaiting Quotes';

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-black text-[#13294b]">Purchase Requests</h3>
                <button onClick={onOpenCreateModal} className="flex items-center font-bold py-2 px-4 rounded-lg bg-[#13294b] hover:bg-[#1d3a66] text-white">
                    <PlusIcon className="h-5 w-5 mr-2" /> Create Request
                </button>
            </div>
            {!isManager && <p className="text-xs text-slate-400 mb-2">Only a manager can authorise requests.</p>}
            <div className="overflow-x-auto max-h-[60vh] border border-slate-200 rounded-xl">
                <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-slate-50">
                        <tr className="border-b border-slate-200 text-slate-500">
                            <th className="p-3 font-bold">Part</th>
                            <th className="p-3 font-bold text-center">Qty</th>
                            <th className="p-3 font-bold">Date</th>
                            <th className="p-3 font-bold">Requested by</th>
                            <th className="p-3 font-bold text-center">Status</th>
                            <th className="p-3 font-bold text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginated.map(req => (
                            <tr key={req.id} className="border-b border-slate-100">
                                <td className="p-3 font-bold text-slate-800">{partMap.get(req.partId) || 'Unknown part'}{req.isUrgent && <span className="ml-2 text-[10px] font-bold text-red-600">URGENT</span>}</td>
                                <td className="p-3 text-center font-mono">{req.quantity}</td>
                                <td className="p-3 text-slate-600">{format(new Date(req.requestedDate), 'dd MMM yyyy')}</td>
                                <td className="p-3 text-slate-600">{userMap.get(req.requestedByUserId) || req.requestedByUserId}</td>
                                <td className="p-3 text-center"><span className={`px-2 py-1 rounded-full text-xs font-bold ${statusChip[req.status] || 'bg-slate-100 text-slate-600'}`}>{req.status}</span></td>
                                <td className="p-3 text-right whitespace-nowrap">
                                    {isManager && needsAuth(req.status) && (
                                        <>
                                            <button onClick={() => onApprove?.(req.id)} className="text-xs font-bold bg-emerald-600 text-white py-1.5 px-3 rounded-lg mr-1">Authorise</button>
                                            <button onClick={() => onReject?.(req.id)} className="text-xs font-bold bg-white border border-red-300 text-red-600 py-1.5 px-3 rounded-lg">Reject</button>
                                        </>
                                    )}
                                    {isManager && req.status === 'Approved' && (
                                        <button onClick={() => onRaisePo?.(req)} className="text-xs font-bold bg-[#13294b] text-white py-1.5 px-3 rounded-lg">Raise PO</button>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {paginated.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-400">No purchase requests.</td></tr>}
                    </tbody>
                </table>
            </div>
            {totalPages > 1 && (
                <div className="flex justify-center items-center space-x-2 mt-4">
                    <button onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1} className="px-3 py-1 rounded-md bg-slate-100 disabled:opacity-50">&laquo;</button>
                    <span className="text-sm text-slate-500">Page {currentPage} of {totalPages}</span>
                    <button onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages} className="px-3 py-1 rounded-md bg-slate-100 disabled:opacity-50">&raquo;</button>
                </div>
            )}
        </div>
    );
};

export default PurchaseRequestList;
