import React, { useState } from 'react';
import ClientManagementView from './ClientManagementView';
import ClientCommsView from './ClientCommsView';
import MarketingContactsView from './MarketingContactsView';
import { useAuth } from '../../contexts/AppContexts';

// Clients — their own screen: the CRM (with the built-in leads / pending-approval
// / COD vetting flow), Marketing Contacts (the audience + opt-in/out), and Comms
// & Marketing (bulk send). Transporters live on their own screen.
// Sub-tabs are controllable per role/branch via Users → Tab Access (accounts:*).
type ClientsTab = 'crm' | 'contacts' | 'comms';

const ClientsPortal: React.FC = () => {
    const { myHiddenTabs, currentUser } = useAuth();
    const isAdminRole = ['Admin', 'Super Admin'].includes(currentUser?.role as string);
    const hidden = (v: string) => !isAdminRole && (myHiddenTabs || []).includes(`accounts:${v}`);
    const showCrm = !hidden('clients');
    const showContacts = !hidden('contacts');
    const showComms = !hidden('comms');
    const [tab, setTab] = useState<ClientsTab>(showCrm ? 'crm' : showContacts ? 'contacts' : 'comms');
    const chip = (active: boolean) => `px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${active ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`;
    return (
        <div className="space-y-4">
            <div className="bg-slate-100 p-1 rounded-xl flex flex-wrap gap-1 w-fit">
                {showCrm && <button onClick={() => setTab('crm')} className={chip(tab === 'crm')}>Clients CRM</button>}
                {showContacts && <button onClick={() => setTab('contacts')} className={chip(tab === 'contacts')}>Marketing Contacts</button>}
                {showComms && <button onClick={() => setTab('comms')} className={chip(tab === 'comms')}>Comms &amp; Marketing</button>}
            </div>
            {tab === 'contacts' && showContacts ? <MarketingContactsView />
                : tab === 'comms' && showComms ? <ClientCommsView />
                : <ClientManagementView />}
        </div>
    );
};

export default ClientsPortal;
