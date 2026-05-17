import React from 'react';
import { useAuth, useWorkshop, useVehicles } from '../../contexts/AppContexts';
import ChecklistReview from '../workshop/ChecklistReview';

const FleetChecklistView: React.FC = () => {
    const { currentUser } = useAuth();
    const { checklistSubmissions = [], jobCards = [], handleCreateJobCard } = useWorkshop();
    const { vehicles = [] } = useVehicles();

    // In a real app, the onUpdateSubmission would be wired up.
    // For now, a mock function is fine based on existing code.
    const handleUpdateSubmission = (submission: any) => {
        console.log("Updating submission status:", submission.id);
    };

    return (
        <div>
            <h2 className="text-3xl font-bold text-white mb-6">Checklist Submissions Review</h2>
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