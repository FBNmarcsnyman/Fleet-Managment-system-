import React from 'react';
import { useVehicles, useWorkshop, useOperations } from '../../contexts/AppContexts';
import { ServiceStatus } from '../../types';

const ActionCenterWidget: React.FC = () => {
    const { serviceStatuses } = useVehicles();
    const { jobCards = [] } = useWorkshop();
    const { unassignedJobCount = 0 } = useOperations();

    const overdueServicesCount = serviceStatuses 
        ? Array.from(serviceStatuses.values())
            .flat()
            .filter((s: any) => s.status === 'Overdue').length
        : 0;

    const criticalJobsCount = (jobCards || []).filter(
        jc => jc.priority === 'Critical' && jc.status !== 'Resolved'
    ).length;

    const approvalsNeededCount = (jobCards || []).filter(
        jc => jc.status === 'Pending Scheduling'
    ).length;

    const ActionItem: React.FC<{ count: number, label: string, color: string }> = ({ count, label, color }) => (
        <div className="flex justify-between items-center bg-gray-700/50 p-3 rounded-md">
            <span className="font-semibold text-gray-300">{label}</span>
            <span className={`text-2xl font-bold ${color}`}>{count}</span>
        </div>
    );

    return (
        <div className="space-y-3">
            <ActionItem count={approvalsNeededCount} label="Scheduling Approvals" color="text-blue-400" />
            <ActionItem count={overdueServicesCount} label="Overdue Services" color="text-red-400" />
            <ActionItem count={criticalJobsCount} label="Critical Open Jobs" color="text-orange-400" />
            <ActionItem count={unassignedJobCount} label="Unassigned Operations Jobs" color="text-yellow-400" />
        </div>
    );
};

export default ActionCenterWidget;