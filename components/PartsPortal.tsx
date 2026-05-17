import React, { useState, useMemo } from 'react';
import { Part, Supplier, PurchaseRequest, JobCard, User, Vehicle, PurchaseOrder } from '../types';
import InventoryManagement from './InventoryManagement';
import PurchaseRequestList from './PurchaseRequestList';
import CreatePurchaseRequestModal from './CreatePurchaseRequestModal';
import Modal from './Modal';
import AssignPartModal from './AssignPartModal';
import { format } from 'date-fns';
import { useUIState } from '../contexts/AppContexts';
import AddPartForm from './AddPartForm';


const GoodsReceivingView: React.FC<{
    purchaseOrders: PurchaseOrder[];
    suppliers: Supplier[];
    onReceiveGoods: (order: PurchaseOrder) => void;
}> = ({ purchaseOrders, suppliers, onReceiveGoods }) => {
    
    const orderedPOs = useMemo(() => purchaseOrders.filter(po => po.status === 'Ordered'), [purchaseOrders]);
    const supplierMap = useMemo(() => new Map(suppliers.map(s => [s.id, s.name])), [suppliers]);

    return (
        <div>
            <h3 className="text-xl font-bold text-white mb-4">Awaiting Delivery</h3>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                {orderedPOs.length > 0 ? orderedPOs.map(po => (
                    <div key={po.id} className="bg-gray-700/50 p-4 rounded-lg">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="font-bold text-white font-mono">{po.poNumber}</p>
                                <p className="text-sm text-gray-400">Supplier: {supplierMap.get(po.supplierId || '') || 'N/A'}</p>
                                <p className="text-xs text-gray-500">Ordered: {format(new Date(po.orderDate), 'dd MMM yyyy')}</p>
                            </div>
                            <div className="text-right">
                                <p className="font-semibold font-mono text-lg">R {po.totalCost.toFixed(2)}</p>
                                <button
                                    onClick={() => onReceiveGoods(po)}
                                    className="mt-2 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg text-sm"
                                >
                                    Receive Goods
                                </button>
                            </div>
                        </div>
                    </div>
                )) : (
                    <p className="text-center text-gray-500 py-10">No outstanding purchase orders.</p>
                )}
            </div>
        </div>
    );
};


interface PartsPortalProps {
    parts: Part[];
    suppliers: Supplier[];
    purchaseRequests: PurchaseRequest[];
    purchaseOrders: PurchaseOrder[];
    jobCards: JobCard[];
    users: User[];
    vehicles: Vehicle[];
    onCreatePurchaseRequest: (request: Omit<PurchaseRequest, 'id' | 'requestedByUserId' | 'requestedDate' | 'status' | 'quotes'>) => void;
    onAssignPartToVehicle: (vehicleId: string, partId: string, quantity: number, jobCardId?: string) => void;
    onAddPart: (part: Omit<Part, 'id'>) => void;
    onReceiveGoods: (order: PurchaseOrder) => void;
}

const PartsPortal: React.FC<PartsPortalProps> = (props) => {
    const { showModal, hideModal } = useUIState();
    const [activeView, setActiveView] = useState<'inventory' | 'requests' | 'orders'>('inventory');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [assignModalPayload, setAssignModalPayload] = useState<{ part: Part } | null>(null);

    const TabButton = ({ view, label }: { view: 'inventory' | 'requests' | 'orders', label: string }) => (
        <button
            onClick={() => setActiveView(view)}
            className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${activeView === view ? 'bg-brand-primary text-white' : 'text-gray-300 hover:bg-gray-700'}`}
        >
            {label}
        </button>
    );

    const handleCreateRequest = (request: Omit<PurchaseRequest, 'id' | 'requestedByUserId' | 'requestedDate' | 'status' | 'quotes'>) => {
        props.onCreatePurchaseRequest(request);
        setIsCreateModalOpen(false);
    };

    const handleOpenAddPartModal = () => {
        showModal('addPart', {
            suppliers: props.suppliers,
            onSubmit: (partData: Omit<Part, 'id'>) => {
                props.onAddPart(partData);
                hideModal();
            },
            onCancel: hideModal,
        });
    };

    return (
        <>
            <div className="mb-6">
                <div className="bg-gray-900/50 p-1 rounded-lg flex space-x-1 max-w-md">
                    <TabButton view="inventory" label="Inventory" />
                    <TabButton view="requests" label="Purchase Requests" />
                    <TabButton view="orders" label="Purchase Orders" />
                </div>
            </div>
            {activeView === 'inventory' ? (
                <InventoryManagement 
                    parts={props.parts} 
                    suppliers={props.suppliers} 
                    onAddPart={handleOpenAddPartModal}
                    onOpenAssignModal={(part) => setAssignModalPayload({ part })}
                />
            ) : activeView === 'requests' ? (
                <PurchaseRequestList
                    purchaseRequests={props.purchaseRequests}
                    parts={props.parts}
                    users={props.users}
                    onOpenCreateModal={() => setIsCreateModalOpen(true)}
                />
            ) : (
                <GoodsReceivingView 
                    purchaseOrders={props.purchaseOrders}
                    suppliers={props.suppliers}
                    onReceiveGoods={props.onReceiveGoods}
                />
            )}
            {isCreateModalOpen && (
                <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)}>
                    <CreatePurchaseRequestModal
                        parts={props.parts}
                        jobCards={props.jobCards}
                        onSubmit={handleCreateRequest}
                        onCancel={() => setIsCreateModalOpen(false)}
                    />
                </Modal>
            )}
            {assignModalPayload && (
                 <Modal isOpen={!!assignModalPayload} onClose={() => setAssignModalPayload(null)}>
                   <AssignPartModal
                        part={assignModalPayload.part}
                        vehicles={props.vehicles}
                        jobCards={props.jobCards}
                        onSubmit={props.onAssignPartToVehicle}
                        onCancel={() => setAssignModalPayload(null)}
                   />
                </Modal>
            )}
        </>
    );
};

export default PartsPortal;
