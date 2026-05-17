
import React, { useState } from 'react';
import { Vehicle, OtherCost } from '../../types';
import { format, subMonths } from 'date-fns';
import { RefreshIcon } from '../icons/RefreshIcon';

interface QuickBooksSyncModalProps {
    vehicles: Vehicle[];
    onSync: (costs: Omit<OtherCost, 'id'>[]) => void;
    onClose: () => void;
}

const QuickBooksSyncModal: React.FC<QuickBooksSyncModalProps> = ({ vehicles, onSync, onClose }) => {
    const [isConnected, setIsConnected] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    const handleConnect = () => {
        setIsSyncing(true);
        // Simulate OAuth flow
        setTimeout(() => {
            setIsConnected(true);
            setIsSyncing(false);
        }, 1500);
    };

    const handleFetchExpenses = () => {
        setIsSyncing(true);
        
        // Simulate fetching expenses for the last month
        setTimeout(() => {
            const simulatedCosts: Omit<OtherCost, 'id'>[] = [];
            const categories = ['Tolls', 'Permits', 'Licensing', 'Repairs & Maintenance'];
            
            vehicles.slice(0, 3).forEach(v => {
                categories.forEach(cat => {
                    simulatedCosts.push({
                        vehicleId: v.id,
                        date: format(subMonths(new Date(), 1), 'yyyy-MM'),
                        category: cat,
                        amount: Math.floor(Math.random() * 5000) + 500,
                    });
                });
            });

            onSync(simulatedCosts);
            setIsSyncing(false);
            onClose();
            alert(`Successfully synchronized ${simulatedCosts.length} expenses from QuickBooks.`);
        }, 2000);
    };

    return (
        <div className="p-2">
            <h2 className="text-2xl font-bold mb-4 text-white flex items-center">
                <img src="https://quickbooks.intuit.com/favicon.ico" alt="QB" className="h-6 w-6 mr-2" />
                QuickBooks Online Sync
            </h2>
            
            {!isConnected ? (
                <div className="text-center py-10">
                    <p className="text-gray-400 mb-8">
                        Automate your fleet costing by connecting to your QuickBooks account. <br/>
                        We'll automatically match "Class" or "Customer" fields to your asset registrations.
                    </p>
                    <button 
                        onClick={handleConnect}
                        disabled={isSyncing}
                        className="bg-[#2ca01c] hover:bg-[#258a17] text-white font-bold py-3 px-8 rounded-lg shadow-lg disabled:opacity-50 flex items-center mx-auto"
                    >
                        {isSyncing ? 'Connecting...' : 'Connect to QuickBooks'}
                    </button>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="p-4 bg-green-900/20 border border-green-800/40 rounded-lg flex items-center justify-between">
                        <div>
                            <p className="text-green-400 font-bold">Account Connected</p>
                            <p className="text-xs text-green-300/60 font-mono">FBN TRANSPORT HOLDINGS (PTY) LTD</p>
                        </div>
                        <button onClick={() => setIsConnected(false)} className="text-xs text-gray-500 hover:text-white underline">Disconnect</button>
                    </div>

                    <div>
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3">Recent Unsynced Expenses</h3>
                        <div className="space-y-2 max-h-48 overflow-y-auto bg-gray-900/50 p-2 rounded-lg border border-gray-700/50">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="flex items-center justify-between text-xs p-2 border-b border-gray-800 last:border-0">
                                    <div>
                                        <p className="text-white font-bold">SANRAL TOLL FEES - {format(new Date(), 'MMM yy')}</p>
                                        <p className="text-gray-500">Auto-matched: <span className="text-blue-400 font-mono">JHB 01 GP</span></p>
                                    </div>
                                    <p className="font-mono text-white">R {(Math.random() * 1000).toFixed(2)}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <button 
                        onClick={handleFetchExpenses}
                        disabled={isSyncing}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center disabled:opacity-50"
                    >
                        {isSyncing ? (
                            <>
                                <RefreshIcon className="h-5 w-5 mr-2 animate-spin" />
                                Syncing Data...
                            </>
                        ) : 'Sync Expenses Now'}
                    </button>
                </div>
            )}

            <div className="mt-8 text-center">
                 <button onClick={onClose} className="text-sm text-gray-500 hover:text-white">Close</button>
            </div>
        </div>
    );
};

export default QuickBooksSyncModal;
