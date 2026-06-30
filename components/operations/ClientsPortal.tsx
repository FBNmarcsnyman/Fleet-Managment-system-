import React, { useState } from 'react';
import ClientManagementView from './ClientManagementView';
import ClientCommsView from './ClientCommsView';

// Clients — their own screen: the CRM (with the built-in leads / pending-approval
// / COD vetting flow) plus Comms & Marketing. Transporters live on their own
// screen (TransportersPortal) so the two relationships never get mixed up.
type ClientsTab = 'crm' | 'comms';

const ClientsPortal: React.FC = () => {
    const [tab, setTab] = useState<ClientsTab>('crm');
    const chip = (active: boolean) => `px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${active ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`;
    return (
        <div className="space-y-4">
            <div className="bg-slate-100 p-1 rounded-xl flex flex-wrap gap-1 w-fit">
                <button onClick={() => setTab('crm')} className={chip(tab === 'crm')}>Clients CRM</button>
                <button onClick={() => setTab('comms')} className={chip(tab === 'comms')}>Comms &amp; Marketing</button>
            </div>
            {tab === 'crm' ? <ClientManagementView /> : <ClientCommsView />}
        </div>
    );
};

export default ClientsPortal;
