import React from 'react';
import { JobCard, JobCardStatus } from '../types';

interface JobCardStatusTrackerProps {
    status: JobCard['status'];
    steps: JobCardStatus[];
    onUpdate: (newStatus: JobCardStatus) => void;
}

const JobCardStatusTracker: React.FC<JobCardStatusTrackerProps> = ({ status, steps, onUpdate }) => {
    const currentIndex = steps.indexOf(status);

    return (
        <div className="flex items-center justify-between w-full">
            {steps.map((step, index) => {
                const isCompleted = index < currentIndex;
                const isCurrent = index === currentIndex;
                
                let dotClasses = 'w-4 h-4 rounded-full transition-all duration-300 ';
                let labelClasses = 'text-xs md:text-sm mt-2 transition-colors duration-300 ';
                let lineClasses = 'flex-1 h-1 transition-colors duration-300 ';

                if (isCompleted) {
                    dotClasses += 'bg-green-500';
                    labelClasses += 'text-green-400';
                    lineClasses += 'bg-green-500';
                } else if (isCurrent) {
                    dotClasses += 'bg-brand-secondary ring-4 ring-brand-secondary/50';
                    labelClasses += 'font-bold text-white';
                    lineClasses += 'bg-gray-600';
                } else {
                    dotClasses += 'bg-gray-600 group-hover:bg-gray-500';
                    labelClasses += 'text-gray-500 group-hover:text-gray-300';
                    lineClasses += 'bg-gray-600';
                }

                return (
                    <React.Fragment key={step}>
                        <div 
                            className="flex flex-col items-center cursor-pointer group"
                            onClick={() => onUpdate(step)}
                        >
                            <div className={dotClasses}></div>
                            <div className={labelClasses}>{step}</div>
                        </div>
                        {index < steps.length - 1 && (
                            <div className={lineClasses}></div>
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
};

export default JobCardStatusTracker;