import React, { useState, useMemo } from 'react';
import { Supplier } from '../../types';
import { PlusIcon } from '../icons/PlusIcon';
import { UploadIcon } from '../icons/UploadIcon';
import { useUIState, useOperations, useCommonData } from '../../contexts/AppContexts';

const SubcontractorManagementView: React.FC = () => {
    const { showModal, showToast } = useUIState();
    const { suppliers = [], handleBulkAddSuppliers, handleDeleteSupplier, handleConvertParty, handleUpdateSupplier } = useOperations() as any;
    // ★ Strategic Network Partner — same cross-cutting flag as on Clients.
    const togglePartner = async (s: any, e: React.MouseEvent) => {
        e.stopPropagation();
        const res = await handleUpdateSupplier?.(s.id, { networkPartner: !s.networkPartner });
        if (res && res.ok === false) showToast(`Could not update: ${res.error}`);
        else showToast(s.networkPartner ? `${s.name} removed from Network Partners.` : `★ ${s.name} marked a Network Partner.`);
    };
    const toClient = async (supplier: Supplier) => {
        if (!confirm(`Move ${supplier.name} to Clients? They become a client (you can market freight to them) and leave the Transporters list.`)) return;
        const res = await handleConvertParty(supplier.id, 'client');
        if (res?.ok === false) showToast(`Could not move: ${res.error}`); else showToast(`${supplier.name} moved to Clients.`);
    };
    const { users = [], handleAddUser } = useCommonData();
    const [q, setQ] = useState('');

    const subcontractors = useMemo(() => {
        const needle = q.trim().toLowerCase();
        return (suppliers || [])
            .filter((s: Supplier) => s.type === 'Transport' && s.isActive !== false)
            .filter((s: any) => !needle || `${s.name || ''} ${s.contactPerson || ''} ${s.contactEmail || ''} ${(s.contacts || []).map((x: any) => `${x.name} ${x.email}`).join(' ')}`.toLowerCase().includes(needle))
            .sort((a: any, b: any) => String(a.name || '').localeCompare(String(b.name || '')));
    }, [suppliers, q]);

    const handleDelete = async (supplier: Supplier) => {
        if (!confirm(`Remove ${supplier.name}? They'll be hidden from your list (past loads & history are kept).`)) return;
        const res = await handleDeleteSupplier(supplier.id);
        if (!res.ok) showToast(`Could not remove: ${res.error}`); else showToast(`${supplier.name} removed.`);
    };

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

    // Create a portal login for this subcontractor so they can see their loads,
    // confirm driver details and submit PODs.
    const hasLogin = (supplier: Supplier) => (users || []).some((u: any) => u.supplierId === supplier.id);
    const handleCreateLogin = async (supplier: Supplier) => {
        const email = supplier.contactEmail || supplier.contacts?.[0]?.email;
        if (!email) { showToast('Add a contact email for this subcontractor first (Edit), then create the login.'); return; }
        if (!confirm(`Create a portal login for ${supplier.name} (${email})?`)) return;
        const res = await handleAddUser({ name: supplier.contactPerson || supplier.name, email, role: 'Supplier', supplierId: supplier.id, assignedBranches: [] });
        if (!res.ok) { showToast(`Could not create login: ${res.error}`); return; }
        const portal = `${window.location.origin}${window.location.pathname}?portal=supplier`;
        alert(`Portal login created for ${supplier.name}.\n\nLogin page: ${portal}\nEmail: ${email}\nTemporary password: ${res.tempPassword}\n\nShare these with them — they can change the password after logging in.`);
    };

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                <div className="flex items-center gap-3">
                    <h3 className="text-xl font-bold text-white">Subcontractors</h3>
                    <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search subcontractors…" className="bg-gray-700 text-white p-2 rounded-md border border-gray-600 text-sm w-60" />
                </div>
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
                                <td className="p-2 font-semibold"><span className="flex items-center gap-1.5"><button onClick={e => togglePartner(supplier, e)} title={(supplier as any).networkPartner ? 'Network Partner — click to remove' : 'Mark as a ★ Network Partner'} className={`text-base leading-none ${(supplier as any).networkPartner ? 'text-amber-400' : 'text-gray-600 hover:text-amber-300'}`}>{(supplier as any).networkPartner ? '★' : '☆'}</button><button onClick={() => showModal('partnerDetail', { partner: supplier, kind: 'supplier' })} className="text-white hover:text-brand-secondary hover:underline text-left">{supplier.name}</button></span></td>
                                <td className="p-2">{supplier.contactPerson}</td>
                                <td className="p-2">{supplier.contactEmail} / {supplier.contactPhone}</td>
                                <td className="p-2 text-right space-x-2">
                                    {hasLogin(supplier)
                                        ? <span className="text-[11px] text-emerald-400 font-bold">Has login</span>
                                        : <button onClick={() => handleCreateLogin(supplier)} className="px-3 py-1 rounded bg-gray-700 hover:bg-emerald-600 text-white text-xs font-bold">Create login</button>}
                                    <button onClick={() => handleEdit(supplier)} className="px-3 py-1 rounded bg-gray-700 hover:bg-brand-secondary text-white text-xs font-bold">Edit</button>
                                    <button onClick={() => toClient(supplier)} title="This is actually a client — move it to Clients" className="px-3 py-1 rounded bg-gray-700 hover:bg-amber-600 text-white text-xs font-bold">→ Client</button>
                                    <button onClick={() => handleDelete(supplier)} className="px-3 py-1 rounded bg-gray-700 hover:bg-red-600 text-white text-xs font-bold">Delete</button>
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