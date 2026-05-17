
import React from 'react';
import { useUIState, useAuth, useWorkshop } from '../contexts/AppContexts';
import Dashboard from './Dashboard';
import Reporting from './Reporting';
import CostAnalysis from './CostAnalysis';
import ClientPortalAccessView from './ClientPortalAccessView';
import SubcontractorControlCenter from './management/SubcontractorControlCenter';
import IssueTracker from './IssueTracker';

const ManagementPortal: React.FC = () => {
    const { managementSubView, handleManagementSubViewChange } = useUIState();
    const { setViewClientAsAdmin } = useAuth();
    const { users } = useWorkshop();
    
    const navItems = [
        { view: 'dashboard', label: 'Dashboard' },
        { view: 'issues', label: 'Issue Tracker' },
        { view: 'reporting', label: 'Reporting' },
        { view: 'costAnalysis', label: 'Cost Analysis' },
        { view: 'subcontractors', label: 'Subcontractors' },
        { view: 'clientPortalAccess', label: 'Client Portal Access' },
    ];

    const renderView = () => {
        switch (managementSubView) {
            case 'reporting': return <Reporting />;
            case 'costAnalysis': return <CostAnalysis />;
            case 'subcontractors': return <SubcontractorControlCenter />;
            case 'clientPortalAccess': return <ClientPortalAccessView users={users} onViewPortal={setViewClientAsAdmin} />;
            case 'issues': return <IssueTracker />;
            case 'dashboard':
            default: return <Dashboard />;
        }
    };
    
    return (
        <div>
            <div className="flex items-center space-x-2 mb-6">
                {navItems.map(item => (
                     <button key={item.view} onClick={() => handleManagementSubViewChange(item.view as any)}
                        className={`px-4 py-2 text-sm font-semibold rounded-md ${managementSubView === item.view ? 'bg-brand-primary text-white' : 'text-gray-300 hover:bg-gray-700'}`}>
                        {item.label}
                    </button>
                ))}
            </div>
            {renderView()}
        </div>
    );
};

export default ManagementPortal;
