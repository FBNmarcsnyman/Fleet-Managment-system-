import React, { useState, useEffect, useMemo, useRef } from 'react';
import { WidgetType } from '../types';
import WidgetWrapper from './dashboard-widgets/WidgetWrapper';
import ActionCenterWidget from './dashboard-widgets/ActionCenterWidget';
import OperationsSummaryWidget from './dashboard-widgets/OperationsSummaryWidget';
import FinancialSummaryStatsWidget from './dashboard-widgets/FinancialSummaryStatsWidget';
import MonthlyFinancialsWidget from './dashboard-widgets/MonthlyFinancialsWidget';
import TireStatusWidget from './dashboard-widgets/TireStatusWidget';
import TopVehiclesWidget from './dashboard-widgets/TopVehiclesWidget';
import JobCardsPriorityWidget from './dashboard-widgets/JobCardsPriorityWidget';
import OverdueServicesWidget from './dashboard-widgets/OverdueServicesWidget';
import FuelPriceTickerWidget from './dashboard-widgets/FuelPriceTickerWidget';
import BowserStatusWidget from './dashboard-widgets/BowserStatusWidget';
import FuelAnalyticsWidget from './dashboard-widgets/FuelAnalyticsWidget';
import AddWidgetModal from './dashboard-widgets/AddWidgetModal';
import { PlusIcon } from './icons/PlusIcon';

const WIDGET_CONFIG: Record<WidgetType, { name: string; component: React.FC<any>; defaultSize: string; }> = {
    'ACTION_CENTER': { name: 'Action Center', component: ActionCenterWidget, defaultSize: 'col-span-12' },
    'OPERATIONS_SUMMARY': { name: 'Operations Summary', component: OperationsSummaryWidget, defaultSize: 'col-span-12' },
    'FINANCIAL_SUMMARY_STATS': { name: 'Financial Snapshot', component: FinancialSummaryStatsWidget, defaultSize: 'col-span-12' },
    'MONTHLY_FINANCIALS_CHART': { name: 'Monthly Financials', component: MonthlyFinancialsWidget, defaultSize: 'col-span-12 md:col-span-8' },
    'TIRE_STATUS_CHART': { name: 'Tire Status', component: TireStatusWidget, defaultSize: 'col-span-12 md:col-span-4' },
    'TOP_PROFIT_VEHICLES': { name: 'Top Profit Vehicles', component: TopVehiclesWidget, defaultSize: 'col-span-12 md:col-span-6' },
    'JOB_PRIORITY_CHART': { name: 'Open Job Priority', component: JobCardsPriorityWidget, defaultSize: 'col-span-12 md:col-span-6' },
    'OVERDUE_SERVICES_LIST': { name: 'Overdue Services', component: OverdueServicesWidget, defaultSize: 'col-span-12' },
    'FUEL_PRICE_TICKER': { name: 'Latest Fuel Price', component: FuelPriceTickerWidget, defaultSize: 'col-span-12 md:col-span-3' },
    'BOWSER_STATUS': { name: 'Bowser Fuel Levels', component: BowserStatusWidget, defaultSize: 'col-span-12 md:col-span-3' },
    'FUEL_ANALYTICS': { name: 'Fuel Analytics', component: FuelAnalyticsWidget, defaultSize: 'col-span-12 md:col-span-8' },
};

const DEFAULT_LAYOUT: { type: WidgetType; size: string; }[] = [
    { type: 'ACTION_CENTER', size: 'col-span-12' },
    { type: 'FINANCIAL_SUMMARY_STATS', size: 'col-span-12' },
    { type: 'BOWSER_STATUS', size: 'col-span-12 md:col-span-4' },
    { type: 'MONTHLY_FINANCIALS_CHART', size: 'col-span-12 md:col-span-8' },
    { type: 'FUEL_ANALYTICS', size: 'col-span-12 md:col-span-8' },
    { type: 'JOB_PRIORITY_CHART', size: 'col-span-12 md:col-span-4' },
    { type: 'OVERDUE_SERVICES_LIST', size: 'col-span-12 md:col-span-6' },
    { type: 'TOP_PROFIT_VEHICLES', size: 'col-span-12 md:col-span-6' },
];

const Dashboard: React.FC = () => {
    const [layout, setLayout] = useState(() => {
        try {
            const savedLayout = localStorage.getItem('dashboardLayout_v3');
            return savedLayout ? JSON.parse(savedLayout) : DEFAULT_LAYOUT;
        } catch (error) {
            return DEFAULT_LAYOUT;
        }
    });
    const [isCustomizeMode, setIsCustomizeMode] = useState(false);
    const [isAddWidgetModalOpen, setIsAddWidgetModalOpen] = useState(false);
    const dragItem = useRef<number | null>(null);
    const dragOverItem = useRef<number | null>(null);

    useEffect(() => {
        localStorage.setItem('dashboardLayout_v3', JSON.stringify(layout));
    }, [layout]);
    
    const onAddWidget = (widgetType: WidgetType) => {
        const config = WIDGET_CONFIG[widgetType];
        setLayout([...layout, { type: widgetType, size: config.defaultSize }]);
    };

    const onRemoveWidget = (index: number) => {
        const newLayout = [...layout];
        newLayout.splice(index, 1);
        setLayout(newLayout);
    };

    const onSizeChange = (index: number, newSize: string) => {
        const newLayout = [...layout];
        newLayout[index].size = newSize;
        setLayout(newLayout);
    };

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, position: number) => {
        dragItem.current = position;
    };

    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>, position: number) => {
        dragOverItem.current = position;
    };
    
    const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
        if (dragItem.current !== null && dragOverItem.current !== null) {
            const newLayout = [...layout];
            const dragItemContent = newLayout[dragItem.current];
            newLayout.splice(dragItem.current, 1);
            newLayout.splice(dragOverItem.current, 0, dragItemContent);
            dragItem.current = null;
            dragOverItem.current = null;
            setLayout(newLayout);
        }
    };

    const availableWidgets = useMemo(() => {
        const currentWidgetTypes = new Set(layout.map((w: any) => w.type));
        return (Object.keys(WIDGET_CONFIG) as WidgetType[]).filter(
            (type) => !currentWidgetTypes.has(type)
        );
    }, [layout]);


    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold text-white">Management Dashboard</h2>
                <div className="flex items-center space-x-4">
                    <button onClick={() => setIsAddWidgetModalOpen(true)} className="flex items-center font-bold py-2 px-4 rounded-lg bg-gray-600 hover:bg-gray-700 text-white">
                        <PlusIcon className="h-5 w-5 mr-2"/> Add Widget
                    </button>
                    <button onClick={() => setIsCustomizeMode(!isCustomizeMode)} className={`font-bold py-2 px-4 rounded-lg ${isCustomizeMode ? 'bg-green-600' : 'bg-brand-primary'} hover:bg-brand-secondary text-white`}>
                        {isCustomizeMode ? 'Done' : 'Customize'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-12 gap-6">
                {layout.map((widget: any, index: number) => {
                    const WidgetComponent = WIDGET_CONFIG[widget.type]?.component;
                    if (!WidgetComponent) return null;
                    return (
                        <WidgetWrapper
                            key={`${widget.type}-${index}`}
                            title={WIDGET_CONFIG[widget.type].name}
                            isCustomizeMode={isCustomizeMode}
                            onRemove={() => onRemoveWidget(index)}
                            className={widget.size}
                            onSizeChange={(newSize) => onSizeChange(index, newSize)}
                            index={index}
                            onDragStart={handleDragStart}
                            onDragEnter={handleDragEnter}
                            onDragEnd={handleDragEnd}
                        >
                            <WidgetComponent />
                        </WidgetWrapper>
                    );
                })}
            </div>
            
            <AddWidgetModal
                isOpen={isAddWidgetModalOpen}
                onClose={() => setIsAddWidgetModalOpen(false)}
                availableWidgets={availableWidgets}
                onAddWidget={onAddWidget}
                widgetConfig={WIDGET_CONFIG}
            />
        </div>
    );
};

export default React.memo(Dashboard);
