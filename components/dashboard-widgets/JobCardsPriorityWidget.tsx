import React, { useMemo } from 'react';
import { useWorkshop } from '../../contexts/AppContexts';

const JobCardsPriorityWidget: React.FC = () => {
    const { jobCards = [] } = useWorkshop();

    const priorityCounts = useMemo(() => {
        return (jobCards || [])
            .filter(j => j.status !== 'Resolved')
            .reduce((acc, job) => {
                acc[job.priority] = (acc[job.priority] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);
    }, [jobCards]);

    const priorities: ('Critical' | 'High' | 'Medium' | 'Low')[] = ['Critical', 'High', 'Medium', 'Low'];

    return (
        <div className="space-y-2">
            {priorities.map(p => (
                <div key={p} className="flex justify-between items-center text-sm">
                    <span>{p}</span>
                    <span className="font-bold text-lg">{priorityCounts[p] || 0}</span>
                </div>
            ))}
        </div>
    );
};

export default JobCardsPriorityWidget;