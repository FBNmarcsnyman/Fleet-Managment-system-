
import React, { useState } from 'react';
import { Vehicle, Branch } from '../../types';
import { BRANCHES } from '../../constants';
import { LinkIcon } from '../icons/LinkIcon';

interface ConnectAssetSheetModalProps {
    onImport: (vehicles: Omit<Vehicle, 'id'>[]) => void;
    onClose: () => void;
}

const ConnectAssetSheetModal: React.FC<ConnectAssetSheetModalProps> = ({ onImport, onClose }) => {
    const [url, setUrl] = useState('');
    const [isSyncing, setIsSyncing] = useState(false);

    const handleSync = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!url.includes('docs.google.com/spreadsheets')) {
            alert('Please enter a valid Google Sheets URL.');
            return;
        }

        setIsSyncing(true);
        try {
            // Pattern for Google Sheets CSV export
            const csvUrl = url.includes('/pub?') 
                ? url 
                : url.replace(/\/edit.*$/, '/export?format=csv');

            const response = await fetch(csvUrl);
            const csvText = await response.text();
            
            // Simple CSV parser for demo purposes
            const lines = csvText.split('\n');
            const headers = lines[0].split(',').map(h => h.trim());
            
            const rows = lines.slice(1).map(line => {
                const values = line.split(',');
                const obj: any = {};
                headers.forEach((header, i) => {
                    obj[header] = values[i]?.trim();
                });
                return obj;
            });

            const newVehicles: Omit<Vehicle, 'id'>[] = rows.filter(r => r.Registration && r.Name).map(row => ({
                name: row.Name,
                registration: row.Registration,
                make: row.Make || 'Unknown',
                model: row.Model || 'Unknown',
                year: parseInt(row.Year) || new Date().getFullYear(),
                vin: row.VIN || 'N/A',
                branch: (BRANCHES.includes(row.Branch) ? row.Branch : BRANCHES[0]) as Branch,
                weightCategory: row.Category || 'Horse',
                status: 'On the road',
                purchasePrice: parseFloat(row['Purchase Price']) || 0,
                currentValue: parseFloat(row['Purchase Price']) || 0,
            }));

            if (newVehicles.length > 0) {
                onImport(newVehicles);
                onClose();
            } else {
                alert('No valid data found in the spreadsheet. Please check your headers.');
            }
        } catch (error) {
            console.error(error);
            alert('Failed to sync from Google Sheets. Ensure the sheet is Shared with "Anyone with the link".');
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <form onSubmit={handleSync} className="p-2">
            <h2 className="text-2xl font-bold mb-4 text-white flex items-center">
                <LinkIcon className="h-6 w-6 mr-2 text-green-400" />
                Connect Asset Sheet
            </h2>
            <p className="text-gray-400 mb-6 text-sm leading-relaxed">
                Sync your fleet list directly from Google Sheets. <br/>
                Go to <span className="text-white font-mono">File &gt; Share &gt; Share with others</span> and ensure "Anyone with the link" has access.
            </p>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Google Sheet URL</label>
                    <input 
                        type="url" 
                        placeholder="https://docs.google.com/spreadsheets/d/..." 
                        value={url}
                        onChange={e => setUrl(e.target.value)}
                        required
                        className="w-full bg-gray-700 text-white p-3 rounded-lg border border-gray-600 focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>

            <div className="mt-8 p-4 bg-blue-900/20 border border-blue-800/40 rounded-lg">
                <h4 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-1">Expected Headers</h4>
                <p className="text-[10px] text-blue-300/80 font-mono">Name, Registration, Make, Model, Year, VIN, Branch, Category, Purchase Price</p>
            </div>

            <div className="flex justify-end space-x-4 mt-8">
                <button type="button" onClick={onClose} className="px-6 py-2 text-gray-400 hover:text-white font-semibold">Cancel</button>
                <button 
                    type="submit" 
                    disabled={isSyncing}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 px-8 rounded-lg shadow-lg disabled:opacity-50 flex items-center"
                >
                    {isSyncing ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                            Syncing...
                        </>
                    ) : 'Establish Sync'}
                </button>
            </div>
        </form>
    );
};

export default ConnectAssetSheetModal;
