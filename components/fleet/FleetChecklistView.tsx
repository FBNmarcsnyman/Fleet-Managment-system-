import React from 'react';
import { useAuth, useWorkshop, useVehicles } from '../../contexts/AppContexts';
import ChecklistReview from '../workshop/ChecklistReview';

const FleetChecklistView: React.FC = () => {
    const { currentUser } = useAuth();
    const { checklistSubmissions = [], jobCards = [], handleCreateJobCard, handleUpdateChecklistSubmission } = useWorkshop();
    const { vehicles = [] } = useVehicles();

    const handleUpdateSubmission = (submission: any) => {
        handleUpdateChecklistSubmission?.(submission.id, { status: submission.status, reviewedBy: currentUser?.id });
    };

    return (
        <div>
            <h2 className="text-3xl font-black text-[#13294b] mb-6">Checklist Submissions Review</h2>
             <ChecklistReview
                currentUser={currentUser!}
                submissions={checklistSubmissions}
                jobCards={jobCards}
                vehicles={vehicles}
                onUpdateSubmission={handleUpdateSubmission}
                onCreateJobCard={handleCreateJobCard}
            />
        </div>
    );
};

export default FleetChecklistView;