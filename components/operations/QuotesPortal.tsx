import React from 'react';
import { useOperations, useUIState } from '../../contexts/AppContexts';
import QuotesView from './QuotesView';

// Standalone Quotes workspace (its own sidebar tab). This is where the external
// quoting tool will be incorporated; for now it runs the in-app quotes flow.
const QuotesPortal: React.FC = () => {
    const { quotes, clients, suppliers } = useOperations();
    const { showModal } = useUIState();
    return (
        <QuotesView
            quotes={quotes}
            clients={clients}
            suppliers={suppliers}
            onShowPdf={(quote, client) => showModal('quotePdf', { quote, client })}
        />
    );
};

export default QuotesPortal;
