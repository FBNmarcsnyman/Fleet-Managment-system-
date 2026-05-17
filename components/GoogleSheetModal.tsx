
import React, { useState } from 'react';

interface GoogleSheetModalProps {
    type: 'vehicles' | 'fuel';
    onSubmit: (url: string) => void;
    onCancel: () => void;
}

export const GoogleSheetModal: React.FC<GoogleSheetModalProps> = ({ type, onSubmit, onCancel }) => {
    const [url, setUrl] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!url) {
            alert('Please provide the public CSV URL for your sheet.');
            return;
        }
        if (!url.includes('docs.google.com/spreadsheets')) {
            alert('Please enter a valid Google Sheets publish URL.');
            return;
        }
        onSubmit(url);
    };

    const isVehicleSheet = type === 'vehicles';
    const title = isVehicleSheet ? "Connect Vehicle Sheet" : "Connect Fuel Sheet";
    const placeholder = isVehicleSheet ? "Vehicles Sheet Publish URL" : "Fuel Entries Sheet Publish URL";

    return (
        <form onSubmit={handleSubmit}>
            <h2 className="text-2xl font-bold mb-4 text-white">{title}</h2>
            <p className="text-gray-400 mb-6">
                Paste the public CSV URL for your {type} sheet below. The data will sync automatically.
            </p>
            
            <div className="space-y-4 mb-6">
                <input 
                    type="url" 
                    placeholder={placeholder}
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    className="w-full bg-gray-700 text-white p-3 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-secondary" 
                    required
                />
            </div>

            <div className="text-sm p-4 bg-gray-900/50 rounded-lg text-gray-300">
                <h4 className="font-semibold text-white mb-2">Instructions:</h4>
                <ol className="list-decimal list-inside space-y-1">
                    <li>Your sheet must have the headers: <br/> 
                        {isVehicleSheet ? (
                            <>
                                <code className="text-xs bg-gray-700 p-1 rounded whitespace-nowrap">Fleet Number</code>, 
                                <code className="text-xs bg-gray-700 p-1 rounded">Registration</code>, 
                                <code className="text-xs bg-gray-700 p-1 rounded">VIN Number</code>, 
                                <code className="text-xs bg-gray-700 p-1 rounded">Make</code>, 
                                <code className="text-xs bg-gray-700 p-1 rounded">Model</code>, 
                                <code className="text-xs bg-gray-700 p-1 rounded">Year</code>.
                            </>
                        ) : (
                            <>
                                <code className="text-xs bg-gray-700 p-1 rounded whitespace-nowrap">Vehicle Registration</code>, 
                                <code className="text-xs bg-gray-700 p-1 rounded">Date</code>, 
                                <code className="text-xs bg-gray-700 p-1 rounded">Odometer</code>, 
                                <code className="text-xs bg-gray-700 p-1 rounded">Liters</code>.
                            </>
                        )}
                    </li>
                    <li>In Google Sheets, go to <span className="font-mono bg-gray-700 p-1 rounded">File &gt; Share &gt; Publish to the web</span>.</li>
                    <li>
                        In the 'Link' tab, select your <span className="font-bold">{type}</span> sheet.
                    </li>
                    <li>
                        Change the format to <span className="font-bold">Comma-separated values (.csv)</span>.
                    </li>
                    <li>Click 'Publish' and copy the generated link.</li>
                </ol>
            </div>

            <div className="flex justify-end space-x-4 mt-8">
                <button type="button" onClick={onCancel} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300">Cancel</button>
                <button type="submit" className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300">Connect</button>
            </div>
        </form>
    )
}
