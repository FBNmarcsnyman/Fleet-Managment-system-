
import React, { useState } from 'react';
import FleetPerformanceReport from './reports/FleetPerformanceReport';
import DriverScorecardReport from './reports/DriverScorecardReport';
import PredictiveMaintenanceReport from './reports/PredictiveMaintenanceReport';
import { ChartBarIcon } from './icons/ChartBarIcon';
import { UsersIcon } from './icons/UsersIcon';
import { SparklesIcon } from './icons/SparklesIcon';
import { TireIcon } from './icons/TireIcon';
import TirePerformanceReport from './reports/TirePerformanceReport';
import { RouteIcon } from './icons/RouteIcon';
import LaneProfitabilityReport from './reports/LaneProfitabilityReport';

type ReportType = 'fleet' | 'drivers' | 'maintenance' | 'tires' | 'lanes' | null;

const Reporting: React.FC = () => {
    const [activeReport, setActiveReport] = useState<ReportType>(null);

    const ReportCard = ({ type, title, description, icon: Icon }: { type: ReportType, title: string, description: string, icon: React.ElementType }) => (
        <div
            onClick={() => setActiveReport(type)}
            className="bg-gray-800 p-6 rounded-lg shadow-lg cursor-pointer hover:shadow-brand-secondary/40 hover:scale-105 transition-transform duration-300"
        >
            <Icon className="h-8 w-8 text-brand-secondary mb-3" />
            <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
            <p className="text-gray-400 text-sm">{description}</p>
        </div>
    );

    const renderReport = () => {
        switch (activeReport) {
            case 'fleet':
                return <FleetPerformanceReport />;
            case 'drivers':
                return <DriverScorecardReport />;
            case 'maintenance':
                return <PredictiveMaintenanceReport />;
            case 'tires':
                return <TirePerformanceReport />;
            case 'lanes':
                return <LaneProfitabilityReport />;
            default:
                return null;
        }
    };
    
    if (activeReport) {
        return (
            <div>
                <button onClick={() => setActiveReport(null)} className="flex items-center text-brand-secondary hover:text-blue-400 mb-6 font-semibold">
                   &larr; Back to Reports
                </button>
                {renderReport()}
            </div>
        )
    }

    return (
        <div className="space-y-8">
            <h2 className="text-3xl font-bold text-white">Reporting & Analytics Suite</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <ReportCard
                    type="fleet"
                    title="Fleet Performance"
                    description="Analyze profitability by vehicle type with a breakdown of costs, revenue, and net profit."
                    icon={ChartBarIcon}
                />
                <ReportCard
                    type="drivers"
                    title="Driver Scorecards"
                    description="Evaluate driver performance based on checklist consistency and reported issues."
                    icon={UsersIcon}
                />
                 <ReportCard
                    type="tires"
                    title="Tire Performance"
                    description="Compare tire brands by analyzing their total distance traveled and cost-per-kilometer (CPK)."
                    icon={TireIcon}
                />
                 <ReportCard
                    type="lanes"
                    title="Lane Profitability"
                    description="Identify your most and least profitable routes based on revenue and estimated running costs."
                    icon={RouteIcon}
                />
                <ReportCard
                    type="maintenance"
                    title="Predictive Maintenance"
                    description="Use AI to analyze vehicle history and forecast potential future maintenance needs."
                    icon={SparklesIcon}
                />
            </div>
        </div>
    );
};

export default React.memo(Reporting);
