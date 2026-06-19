import React, { useState, useMemo } from 'react';
import { Client } from '../../types';
import { PlusIcon } from '../icons/PlusIcon';
import { UploadIcon } from '../icons/UploadIcon';
import { useUIState, useOperations } from '../../contexts/AppContexts';
import * as XLSX from 'xlsx';

const ClientManagementView: React.FC = () => {
    const { showModal, showToast } = useUIState();
    const { clients, handleBulkAddClients, handleDeleteClient } = useOperations();
    const [q, setQ] = useState('');

    const rows = useMemo(() => {
        const needle = q.trim().toLowerCase();
        return (clients as any[])
            .filter(c => c.isActive !== false)
            .filter(c => !needle || `${c.name || ''} ${c.contactPerson || ''} ${c.contactEmail || ''} ${(c.contacts || []).map((x: any) => `${x.name} ${x.email}`).join(' ')}`.toLowerCase().includes(needle))
            .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    }, [clients, q]);

    const handleDelete = async (client: any) => {
        if (!confirm(`Remove ${client.name}? They'll be hidden from your list (past loads & history are kept).`)) return;
        const res = await handleDeleteClient(client.id);
        if (!res.ok) showToast(`Could not remove: ${res.error}`); else showToast(`${client.name} removed.`);
    };

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

                const newClients: Omit<Client, 'id'>[] = json.map(row => ({
                    name: row['Company Name'],
                    contactPerson: row['Contact Person'],
                    contactEmail: row['Email'],
                    contactPhone: row['Phone'],
                    address: row['Address'],
                }));

                handleBulkAddClients(newClients);
                alert(`Successfully imported ${newClients.length} clients.`);
            } catch (error) {
                alert(`Error processing file: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        };
        reader.readAsArrayBuffer(file);
        event.target.value = '';
    };

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                <div className="flex items-center gap-3">
                    <h3 className="text-xl font-bold text-white">Clients</h3>
                    <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search clients…" className="bg-gray-700 text-white p-2 rounded-md border border-gray-600 text-sm w-56" />
                </div>
                <div className="flex items-center space-x-2">
                     <label htmlFor="bulk-upload" className="flex items-center font-bold py-2 px-4 rounded-lg bg-gray-600 hover:bg-gray-700 text-white cursor-pointer">
                        <UploadIcon className="h-5 w-5 mr-2" /> Bulk Import
                    </label>
                    <input id="bulk-upload" type="file" onChange={handleFileChange} className="hidden" accept=".xlsx, .xls"/>
                    <button onClick={() => showModal('addClient')} className="flex items-center font-bold py-2 px-4 rounded-lg bg-brand-primary hover:bg-brand-secondary text-white">
                        <PlusIcon className="h-5 w-5 mr-2" /> Add Client
                    </button>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead>
                         <tr className="border-b border-gray-700">
                            <th className="p-2 text-gray-400">Company Name</th>
                            <th className="p-2 text-gray-400">Contacts</th>
                            <th className="p-2 text-gray-400">Primary Email</th>
                            <th className="p-2 text-gray-400 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(client => {
                            const contacts = client.contacts || [];
                            const primary = contacts[0];
                            return (
                            <tr key={client.id} className="border-b border-gray-700/50">
                                <td className="p-2 font-semibold text-white">{client.name}</td>
                                <td className="p-2">
                                    {contacts.length > 0
                                        ? <span>{primary?.name}{contacts.length > 1 && <span className="text-gray-500"> +{contacts.length - 1} more</span>}</span>
                                        : <span className="text-gray-500">{client.contactPerson || '—'}</span>}
                                </td>
                                <td className="p-2 text-gray-400">{primary?.email || client.contactEmail || '—'}</td>
                                <td className="p-2 text-right space-x-2">
                                    <button onClick={() => showModal('addClient', { client })} className="px-3 py-1 rounded bg-gray-700 hover:bg-brand-secondary text-white text-xs font-bold">Edit</button>
                                    <button onClick={() => handleDelete(client)} className="px-3 py-1 rounded bg-gray-700 hover:bg-red-600 text-white text-xs font-bold">Delete</button>
                                </td>
                            </tr>
                        );})}
                        {clients.length === 0 && (
                            <tr><td colSpan={4} className="p-6 text-center text-gray-500">No clients yet. They're added automatically when you create a Transport Order, or add one manually.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ClientManagementView;