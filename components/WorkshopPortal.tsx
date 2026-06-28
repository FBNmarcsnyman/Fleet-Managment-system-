import React, { useState, useMemo } from 'react';
import { useWorkshop, useUIState, useAuth, useVehicles, useOperations } from '../contexts/AppContexts';
import JobCardPortal from './JobCardPortal';
import ServicePlanner from './workshop/ServicePlanner';
import ChecklistReview from './workshop/ChecklistReview';
import TireManagement from './TireManagement';
import PartsPortal from './PartsPortal';
import { PlusIcon } from './icons/PlusIcon';
import { Part, ChecklistTemplate, ChecklistSubmission } from '../types';
import WorkshopSupplierManagementView from './workshop/WorkshopSupplierManagementView';
import ChecklistManagement from './ChecklistManagement';

type WorkshopView = 'jobCards' | 'servicePlanner' | 'checklistReview' | 'checklistManagement' | 'tireManagement' | 'parts' | 'suppliers';

const WorkshopPortal: React.FC = () => {
    const { currentUser } = useAuth();
    const { workshopSubView, handleWorkshopSubViewChange, showModal, hideModal } = useUIState();
    const { 
        users = [], 
        jobCards = [], 
        checklistTemplates = [], 
        checklistSubmissions = [], 
        parts = [], 
        purchaseRequests = [], 
        tires = [], 
        tireInspections = [], 
        hrCases = [], 
        handleUpdateJobCard, 
        handleCreateJobCard, 
        handleAddPart, 
        handleCreatePurchaseRequest, 
        handleUpdateTire, 
        handleAddTireInspection, 
        handleAssignPartToJob, 
        handleAddHRCase, 
        purchaseOrders = [], 
        handleReceiveGoods, 
        handleClockInOut, 
        handleAssignPartFromInventory, 
        handleAddChecklistTemplate,
        handleUpdateChecklistTemplate,
        handleDeleteChecklistTemplate,
        handleUpdateChecklistSubmission,
        handleSetPurchaseRequestStatus,
        handleCreatePurchaseOrder,
        handleAddTire,
        handleMountTire,
        handleDismountTire,
        handleScrapTire,
        handleSendForRetread,
        handleReceiveRetread
    } = useWorkshop();
    const { serviceStatuses, vehicles = [], serviceIntervals = [], handleUpdateVehicleStatus } = useVehicles();
    const { suppliers = [] } = useOperations();
    
    const navItems: { view: WorkshopView, label: string }[] = [
        { view: 'jobCards', label: 'Job Cards' },
        { view: 'servicePlanner', label: 'Service Planner' },
        { view: 'checklistReview', label: 'Checklist Review' },
        { view: 'checklistManagement', label: 'Checklist Management' },
        { view: 'tireManagement', label: 'Tire Management' },
        { view: 'parts', label: 'Parts & Inventory' },
        { view: 'suppliers', label: 'Suppliers' },
    ];

    const openCreateJobCardModal = () => {
        showModal('createJobCard', {
            onSubmit: (jobCardData: any) => {
                handleCreateJobCard(jobCardData);
                hideModal();
            },
            onCancel: hideModal,
        });
    };
    
    const handleActualAddPart = (partData: Omit<Part, 'id'>) => {
        handleAddPart(partData);
    };

    const handlePreviewTemplate = (template: ChecklistTemplate) => {
        if (!vehicles || vehicles.length === 0) return;
        showModal('performChecklist', {
            vehicle: vehicles[0], // Use a dummy vehicle for preview
            currentUser: currentUser,
            templates: [template],
            onSubmit: () => hideModal(),
            onCancel: () => hideModal(),
            isPreview: true,
        });
    };

    const usedTemplateIds = useMemo(() => new Set<string>(
        (checklistSubmissions || []).map((s: ChecklistSubmission) => s.templateId),
    ), [checklistSubmissions]);

    const workshopSuppliers = (suppliers || []).filter((s: any) => s.type === 'Workshop');

    const renderView = () => {
        switch (workshopSubView) {
            case 'servicePlanner':
                return <ServicePlanner vehicles={vehicles} serviceStatuses={serviceStatuses} serviceIntervals={serviceIntervals} jobCards={jobCards} onCreateJobCard={handleCreateJobCard} />;
            case 'checklistReview':
                return <ChecklistReview currentUser={currentUser!} submissions={checklistSubmissions} jobCards={jobCards} vehicles={vehicles} onUpdateSubmission={(s: any) => handleUpdateChecklistSubmission?.(s.id, { status: s.status, reviewedBy: currentUser?.id })} onCreateJobCard={handleCreateJobCard} />;
            case 'checklistManagement':
                return <ChecklistManagement 
                            templates={checklistTemplates}
                            usedTemplateIds={usedTemplateIds}
                            checklistSubmissions={checklistSubmissions}
                            users={users}
                            vehicles={vehicles}
                            onAddTemplate={handleAddChecklistTemplate}
                            onUpdateTemplate={handleUpdateChecklistTemplate}
                            onDeleteTemplate={handleDeleteChecklistTemplate}
                            onPreviewTemplate={handlePreviewTemplate}
                        />;
            case 'tireManagement': {
                const tireById = (id: string) => (tires || []).find((t: any) => t.id === id);
                return <TireManagement
                    tires={tires}
                    tireInspections={tireInspections}
                    vehicles={vehicles}
                    users={users}
                    hrCases={hrCases}
                    onAddTire={() => showModal('addTire', { onSubmit: async (t: any) => { await handleAddTire?.(t); hideModal(); }, onCancel: hideModal })}
                    onUpdateTire={handleUpdateTire}
                    onAddInspection={(tireId: string) => showModal('addTireInspection', { tireId, onSubmit: async (insp: any) => { await handleAddTireInspection?.(tireId, insp); hideModal(); }, onCancel: hideModal })}
                    onOpenMountTireModal={(tireId: string) => showModal('mountTire', { tire: tireById(tireId), vehicles, onMount: async (tId: string, vId: string, pos: string, odo: number) => { await handleMountTire?.(tId, vId, pos, odo); hideModal(); }, onCancel: hideModal })}
                    onOpenReceiveRetreadModal={(tireId: string) => showModal('receiveRetread', { tire: tireById(tireId), onReceive: async (tId: string) => { await handleReceiveRetread?.(tId); hideModal(); }, onCancel: hideModal })}
                    onOpenScrapTireModal={(tireId: string) => showModal('scrapTire', { tire: tireById(tireId), onScrap: async (tId: string, reason: string, cost: number) => { await handleScrapTire?.(tId, reason, cost); hideModal(); }, onCancel: hideModal })}
                    onOpenSendForRetreadModal={(tireId: string) => showModal('sendForRetread', { tire: tireById(tireId), onSend: async (tId: string, vendor: string, ret: string) => { await handleSendForRetread?.(tId, vendor, ret); hideModal(); }, onCancel: hideModal })}
                />;
            }
            case 'parts':
                return <PartsPortal 
                    parts={parts} 
                    suppliers={workshopSuppliers} 
                    purchaseRequests={purchaseRequests}
                    purchaseOrders={purchaseOrders}
                    jobCards={jobCards}
                    users={users}
                    vehicles={vehicles}
                    onCreatePurchaseRequest={handleCreatePurchaseRequest}
                    onAssignPartToVehicle={handleAssignPartFromInventory}
                    onAddPart={handleActualAddPart}
                    onReceiveGoods={handleReceiveGoods}
                    currentUser={currentUser!}
                    onApprove={(id: string) => handleSetPurchaseRequestStatus?.(id, 'Approved')}
                    onReject={(id: string) => handleSetPurchaseRequestStatus?.(id, 'Rejected')}
                    onRaisePo={(req: any) => handleCreatePurchaseOrder?.(req)}
                />;
            case 'suppliers':
                return <WorkshopSupplierManagementView />;
            case 'jobCards':
            default:
                return <JobCardPortal 
                    currentUser={currentUser!} 
                    jobCards={jobCards} 
                    vehicles={vehicles}
                    users={users}
                    parts={parts}
                    checklistSubmissions={checklistSubmissions}
                    onUpdateJobCard={handleUpdateJobCard}
                    clearInitialFilters={() => {}}
                    onPlanService={() => {}}
                    onStartSpotCheck={() => {}}
                    onAssignPartToJob={handleAssignPartToJob}
                    onClockInOut={handleClockInOut}
                />;
        }
    };
    
    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center space-x-2 overflow-x-auto">
                    {navItems.map(item => (
                        <button 
                            key={item.view} 
                            onClick={() => handleWorkshopSubViewChange(item.view)}
                            className={`px-4 py-2 text-sm font-semibold rounded-md whitespace-nowrap ${workshopSubView === item.view ? 'bg-brand-primary text-white' : 'text-gray-300 hover:bg-gray-700'}`}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
                <button onClick={openCreateJobCardModal} className="flex items-center font-bold py-2 px-4 rounded-lg bg-green-600 hover:bg-green-700 text-white whitespace-nowrap">
                    <PlusIcon className="h-5 w-5 mr-2" /> Create Job Card
                </button>
            </div>
            {renderView()}
        </div>
    );
};

export default WorkshopPortal;