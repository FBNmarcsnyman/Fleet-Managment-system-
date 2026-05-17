import React, { useMemo } from 'react';
import { useVehicles, useWorkshop, useOperations } from '../contexts/AppContexts';
import { AlertCircle, Clock, Fuel, UserPlus, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

const IssueTracker: React.FC = () => {
    const { vehicles = [], serviceStatuses = new Map(), bowsers = [] } = useVehicles();
    const { jobCards = [] } = useWorkshop();
    const { supplierApplications = [] } = useOperations();

    const issues = useMemo(() => {
        const list: any[] = [];

        // 1. Overdue Services
        vehicles.forEach(v => {
            const statuses = serviceStatuses.get(v.id) || [];
            statuses.filter((s: any) => s.status === 'Overdue').forEach((s: any) => {
                list.push({
                    id: `service-${v.id}-${s.type}`,
                    type: 'Maintenance',
                    severity: 'High',
                    title: `Overdue ${s.type} - ${v.registration}`,
                    description: `Vehicle is overdue for ${s.type} service. Current: ${v.currentOdometer?.toLocaleString() || 0}km.`,
                    icon: Clock,
                    color: 'text-red-400',
                    bgColor: 'bg-red-400/10',
                });
            });
        });

        // 2. High Priority Job Cards
        jobCards.filter(jc => jc.status !== 'Resolved' && (jc.priority === 'Critical' || jc.priority === 'High')).forEach(jc => {
            const vehicle = vehicles.find(v => v.id === jc.vehicleId);
            list.push({
                id: `job-${jc.id}`,
                type: 'Workshop',
                severity: jc.priority === 'Critical' ? 'Critical' : 'High',
                title: `${jc.priority} Priority Job: ${jc.title}`,
                description: `Vehicle: ${vehicle?.registration || 'Unknown'}. Status: ${jc.status}.`,
                icon: AlertCircle,
                color: jc.priority === 'Critical' ? 'text-red-500' : 'text-orange-400',
                bgColor: jc.priority === 'Critical' ? 'bg-red-500/10' : 'bg-orange-400/10',
            });
        });

        // 3. Low Fuel Levels (Bowsers)
        bowsers.filter(b => b.currentStock < b.capacity * 0.2).forEach(b => {
            list.push({
                id: `bowser-${b.id}`,
                type: 'Fuel',
                severity: 'Medium',
                title: `Low Fuel: ${b.name}`,
                description: `Current stock: ${b.currentStock.toLocaleString()}L (${((b.currentStock / b.capacity) * 100).toFixed(1)}%).`,
                icon: Fuel,
                color: 'text-yellow-400',
                bgColor: 'bg-yellow-400/10',
            });
        });

        // 4. Pending Supplier Applications
        supplierApplications.filter(sa => sa.status === 'Pending').forEach(sa => {
            list.push({
                id: `supp-app-${sa.id}`,
                type: 'Operations',
                severity: 'Low',
                title: `Pending Supplier: ${sa.companyName}`,
                description: `Submitted on ${format(new Date(sa.submittedDate), 'MMM dd, yyyy')}.`,
                icon: UserPlus,
                color: 'text-blue-400',
                bgColor: 'bg-blue-400/10',
            });
        });

        return list.sort((a, b) => {
            const severityOrder: Record<string, number> = { 'Critical': 0, 'High': 1, 'Medium': 2, 'Low': 3 };
            return severityOrder[a.severity] - severityOrder[b.severity];
        });
    }, [vehicles, serviceStatuses, jobCards, bowsers, supplierApplications]);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold text-white">Issue Tracker</h2>
                <div className="text-sm text-gray-400">
                    Showing {issues.length} active issues
                </div>
            </div>

            <div className="grid gap-4">
                {issues.length === 0 ? (
                    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-12 text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 text-green-500 mb-4">
                            <AlertCircle className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">All Clear!</h3>
                        <p className="text-gray-400">No critical issues or overdue tasks detected at this time.</p>
                    </div>
                ) : (
                    issues.map(issue => (
                        <div key={issue.id} className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 hover:border-gray-600 transition-all group cursor-pointer">
                            <div className="flex items-start space-x-4">
                                <div className={`p-3 rounded-lg ${issue.bgColor} ${issue.color}`}>
                                    <issue.icon className="w-6 h-6" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className={`text-xs font-bold uppercase tracking-wider ${issue.color}`}>
                                            {issue.type} • {issue.severity}
                                        </span>
                                        <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-gray-400 transition-colors" />
                                    </div>
                                    <h3 className="text-lg font-bold text-white mb-1 truncate">
                                        {issue.title}
                                    </h3>
                                    <p className="text-gray-400 text-sm">
                                        {issue.description}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default IssueTracker;
