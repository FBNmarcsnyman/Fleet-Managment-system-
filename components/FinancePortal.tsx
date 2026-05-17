import React from 'react';
import { useUIState, useOperations, useWorkshop, useVehicles } from '../contexts/AppContexts';
import CostAnalysis from './CostAnalysis';
import CreditorsView from './finance/CreditorsView';
import DebtorsView from './finance/DebtorsView';
import PurchaseApprovalView from './PurchaseApprovalView';
import BudgetingView from './finance/BudgetingView';

const FinancePortal: React.FC = () => {
    const { financeSubView, handleFinanceSubViewChange } = useUIState();
    const { loadConfirmations, suppliers, clients } = useOperations();
    const { purchaseRequests, handleCreatePurchaseOrder } = useWorkshop();
    
    const navItems = [
        { view: 'costAnalysis', label: 'Cost Analysis' },
        { view: 'creditors', label: 'Creditors' },
        { view: 'debtors', label: 'Debtors' },
        { view: 'purchaseApprovals', label: 'Purchase Approvals' },
        { view: 'budgeting', label: 'Budgeting & Forecasting' },
    ];
    
    const renderView = () => {
        switch (financeSubView) {
            case 'creditors': return <CreditorsView loadConfirmations={loadConfirmations} suppliers={suppliers} />;
            case 'debtors': return <DebtorsView loadConfirmations={loadConfirmations} clients={clients} />;
            case 'purchaseApprovals': return <PurchaseApprovalView purchaseRequests={purchaseRequests} onCreatePo={handleCreatePurchaseOrder}/>;
            case 'budgeting': return <BudgetingView />;
            case 'costAnalysis':
            default: return <CostAnalysis />;
        }
    };

    return (
        <div>
            <div className="flex items-center space-x-2 mb-6">
                {navItems.map(item => (
                    <button key={item.view} onClick={() => handleFinanceSubViewChange(item.view as any)}
                        className={`px-4 py-2 text-sm font-semibold rounded-md ${financeSubView === item.view ? 'bg-brand-primary text-white' : 'text-gray-300 hover:bg-gray-700'}`}>
                        {item.label}
                    </button>
                ))}
            </div>
            {renderView()}
        </div>
    );
};

export default FinancePortal;