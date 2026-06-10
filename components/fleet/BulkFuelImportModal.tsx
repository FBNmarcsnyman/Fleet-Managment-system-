import React, { useState } from 'react';
import { useVehicles, useUIState } from '../../contexts/AppContexts';
import { Vehicle, FuelEntry } from '../../types';
import {
    buildFuelEntry,
    buildPlaceholderVehicle,
    mapRowToVehicle,
    normalizeRegistration,
    parseFuelCsv,
    ParsedFuelCsvRow,
} from '../../lib/fuelImport';

const BulkFuelImportModal: React.FC = () => {
    const { vehicles = [], handleAddVehicle, handleBulkAddFuelEntries, handleAddFuelEntry } = useVehicles();
    const { hideModal, showToast } = useUIState();

    const [report, setReport] = useState<string | null>(null);
    const [parsedRows, setParsedRows] = useState<ParsedFuelCsvRow[]>([]);
    const [matchedRows, setMatchedRows] = useState<Array<{ row: ParsedFuelCsvRow; vehicle: Vehicle; entry: ReturnType<typeof buildFuelEntry> }>>([]);
    const [unmatchedRows, setUnmatchedRows] = useState<ParsedFuelCsvRow[]>([]);
    const [invalidRows, setInvalidRows] = useState<ParsedFuelCsvRow[]>([]);
    const [loading, setLoading] = useState(false);

    const summarize = (rows: ParsedFuelCsvRow[]) => {
        const matched: Array<{ row: ParsedFuelCsvRow; vehicle: Vehicle; entry: ReturnType<typeof buildFuelEntry> }> = [];
        const missing: ParsedFuelCsvRow[] = [];
        const invalid: ParsedFuelCsvRow[] = [];

        rows.forEach(row => {
            const isValid = Boolean(row.registration && row.date && row.litres !== null && row.odometer !== null);
            if (!isValid) {
                invalid.push(row);
                return;
            }

            const vehicle = mapRowToVehicle(row, vehicles as Vehicle[]);
            const entry = vehicle ? buildFuelEntry(row, vehicle.id) : null;
            if (vehicle && entry) {
                matched.push({ row, vehicle, entry });
            } else {
                missing.push(row);
            }
        });

        setMatchedRows(matched);
        setUnmatchedRows(missing);
        setInvalidRows(invalid);
        setReport(`Rows loaded: ${rows.length}. Matched: ${matched.length}. Missing: ${missing.length}. Invalid: ${invalid.length}.`);
    };

    const handleFile = async (file: File | null) => {
        if (!file) return;
        const text = await file.text();
        const rows = parseFuelCsv(text);
        setParsedRows(rows);
        summarize(rows);
    };

    const importMatchedRows = async () => {
        if (!matchedRows.length) {
            showToast('No matched fuel rows are available for import.');
            return;
        }

        console.log('[fuel import] starting import of', matchedRows.length, 'matched rows');
        setLoading(true);
        try {
            const entries: Omit<FuelEntry, 'id'>[] = matchedRows.map(m => m.entry!).filter(Boolean);
            console.log('[fuel import] entry payload:', entries.slice(0, 2));
            
            const result = await handleBulkAddFuelEntries(entries);
            console.log('[fuel import] bulk result:', result);

            if (result.ok) {
                console.log('[fuel import] success! imported', result.count, 'rows');
                showToast(`✓ Imported ${result.count} matched fuel rows successfully.`);
                setMatchedRows([]);
                setReport(prev => `${prev}\n✓ SUCCESS: Imported ${result.count} matched rows.`);
                return;
            }

            console.error('[fuel import] bulk insert failed:', result.error);
            console.error('[fuel import] entries that failed:', entries.slice(0, 3));
            showToast(`Bulk import failed: ${result.error}. Falling back to individual inserts.`);
            setReport(prev => `${prev}\n⚠ Bulk insert failed: ${result.error}`);

            let fallbackCount = 0;
            let fallbackErrors = 0;
            for (let i = 0; i < entries.length; i++) {
                const entry = entries[i];
                try {
                    const fallback = await handleAddFuelEntry(entry.vehicleId, {
                        date: entry.date,
                        odometer: entry.odometer,
                        liters: entry.liters,
                        tripDistance: entry.tripDistance,
                        sourceBowserId: entry.sourceBowserId,
                    });
                    if (fallback?.ok) {
                        fallbackCount += 1;
                    } else {
                        fallbackErrors += 1;
                        if (i < 3) console.error('[fuel import] row', i, 'fallback failed:', fallback?.error, entry);
                    }
                } catch (rowErr) {
                    fallbackErrors += 1;
                    if (i < 3) console.error('[fuel import] row', i, 'threw:', rowErr, entry);
                }
            }

            console.log('[fuel import] fallback complete:', fallbackCount, 'success,', fallbackErrors, 'failed');
            if (fallbackCount > 0) {
                showToast(`✓ Imported ${fallbackCount}/${entries.length} fuel rows via fallback.`);
                setMatchedRows([]);
                setReport(prev => `${prev}\n✓ FALLBACK: Imported ${fallbackCount} of ${entries.length} rows.`);
            } else {
                showToast('✗ Import failed. Check browser console for details.');
                setReport(prev => `${prev}\n✗ FAILED: No rows imported. ${fallbackErrors} errors.`);
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error while importing matched rows.';
            console.error('[fuel import] exception:', err, 'message:', message);
            showToast(`✗ Import error: ${message}`);
            setReport(prev => `${prev}\n✗ EXCEPTION: ${message}`);
        } finally {
            setLoading(false);
        }
    };

    const createPlaceholdersAndImportAll = async () => {
        const uniqueMissing = Array.from(new Map(unmatchedRows.map(row => [normalizeRegistration(row.registration), row])).values());
        if (!uniqueMissing.length) {
            showToast('No missing vehicle registrations to create placeholders for.');
            return;
        }

        setLoading(true);
        try {
            const createdVehicles: Vehicle[] = [];
            for (const row of uniqueMissing) {
                const placeholder = buildPlaceholderVehicle(row);
                const created = await handleAddVehicle(placeholder as any);
                if (created.ok) {
                    createdVehicles.push(created.vehicle);
                }
            }

            const allEntries: Omit<FuelEntry, 'id'>[] = [];
            parsedRows.forEach(row => {
                const vehicle = mapRowToVehicle(row, [...vehicles, ...createdVehicles]) || createdVehicles.find(cv => normalizeRegistration(cv.registration) === normalizeRegistration(row.registration));
                const entry = vehicle ? buildFuelEntry(row, vehicle.id) : null;
                if (entry) {
                    allEntries.push(entry);
                }
            });

            const result = await handleBulkAddFuelEntries(allEntries);
            if (result.ok) {
                showToast(`Created ${createdVehicles.length} placeholder assets and imported ${result.count} fuel rows.`);
                setReport(prev => `${prev}\nCreated ${createdVehicles.length} placeholder vehicles and imported ${result.count} rows.`);
            } else {
                showToast(`Import failed: ${result.error}`);
                setReport(prev => `${prev}\nImport failed: ${result.error}`);
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error while importing fuel rows.';
            showToast(`Import failed: ${message}`);
            setReport(prev => `${prev}\nImport threw an error: ${message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <h2 className="text-2xl font-bold mb-4 text-white">Bulk Fuel Import & Validator</h2>
            <p className="text-gray-400 mb-4">Upload a CSV with vehicle registration, date, odometer, litres, and depot. The system will match rows to existing fleet assets and optionally create placeholders for missing vehicles.</p>
            <input type="file" accept="text/csv,text/plain" onChange={e => handleFile(e.target.files?.[0] ?? null)} />

            {report && (
                <pre className="mt-4 bg-gray-900 p-3 rounded text-sm whitespace-pre-wrap text-gray-100">{report}</pre>
            )}

            {parsedRows.length > 0 && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gray-800 p-4 rounded-lg">
                        <div className="text-sm text-gray-400">Valid rows</div>
                        <div className="mt-2 text-2xl font-bold text-white">{parsedRows.length - invalidRows.length}</div>
                    </div>
                    <div className="bg-gray-800 p-4 rounded-lg">
                        <div className="text-sm text-gray-400">Matched rows</div>
                        <div className="mt-2 text-2xl font-bold text-white">{matchedRows.length}</div>
                    </div>
                    <div className="bg-gray-800 p-4 rounded-lg">
                        <div className="text-sm text-gray-400">Missing vehicles</div>
                        <div className="mt-2 text-2xl font-bold text-white">{unmatchedRows.length}</div>
                    </div>
                </div>
            )}

            {invalidRows.length > 0 && (
                <div className="mt-4 bg-rose-900/20 p-4 rounded-lg text-sm text-rose-100">
                    <p className="font-semibold">Invalid rows detected:</p>
                    <p>{invalidRows.length} row(s) are missing required fuel, odometer, or date data and will not be imported.</p>
                </div>
            )}

            {matchedRows.length > 0 && (
                <div className="mt-6 bg-gray-800 p-4 rounded-lg">
                    <h3 className="text-sm font-semibold text-gray-200 mb-3">Matched Rows ({matchedRows.length})</h3>
                    <div className="overflow-x-auto">
                        <div className="min-w-max">
                            <table className="w-full text-xs text-gray-300 border-collapse">
                                <thead>
                                    <tr className="border-b border-gray-700">
                                        <th className="text-left py-2 px-3 font-semibold text-gray-200">CSV Registration</th>
                                        <th className="text-left py-2 px-3 font-semibold text-gray-200">Fleet Vehicle</th>
                                        <th className="text-left py-2 px-3 font-semibold text-gray-200">Date</th>
                                        <th className="text-right py-2 px-3 font-semibold text-gray-200">Odometer</th>
                                        <th className="text-right py-2 px-3 font-semibold text-gray-200">Litres</th>
                                    </tr>
                                </thead>
                            </table>
                        </div>
                    </div>
                    <div className="max-h-[36rem] overflow-y-auto">
                        <table className="w-full text-xs text-gray-300 border-collapse">
                            <tbody>
                                {matchedRows.slice(0, 50).map((m, i) => (
                                    <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                                        <td className="py-2 px-3 font-mono text-blue-300 min-w-[10rem] break-words">{m.row.registration}</td>
                                        <td className="py-2 px-3 min-w-[12rem]"><span className="text-white font-bold text-sm">{m.vehicle.registration}</span><br/><span className="text-gray-400 text-xs">{m.vehicle.name}</span></td>
                                        <td className="py-2 px-3 text-gray-400 min-w-[8rem]">{m.row.date}</td>
                                        <td className="py-2 px-3 text-right text-gray-400 min-w-[7rem]">{m.row.odometer?.toLocaleString()}</td>
                                        <td className="py-2 px-3 text-right text-gray-400 min-w-[6rem]">{m.row.litres}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {matchedRows.length > 50 && (
                        <div className="mt-2 text-xs text-gray-500 italic">Showing 50 of {matchedRows.length} matched rows</div>
                    )}
                </div>
            )}

            {unmatchedRows.length > 0 && (
                <div className="mt-4 bg-gray-800 p-4 rounded-lg">
                    <h3 className="text-sm font-semibold text-gray-200 mb-3">Unmatched Rows ({unmatchedRows.length})</h3>
                    <div className="overflow-x-auto">
                        <div className="min-w-max">
                            <table className="w-full text-xs text-gray-400 border-collapse">
                                <thead>
                                    <tr className="border-b border-gray-700">
                                        <th className="text-left py-2 px-3 font-semibold text-gray-200">Registration</th>
                                        <th className="text-left py-2 px-3 font-semibold text-gray-200">Date</th>
                                        <th className="text-right py-2 px-3 font-semibold text-gray-200">Odometer</th>
                                        <th className="text-right py-2 px-3 font-semibold text-gray-200">Litres</th>
                                        <th className="text-left py-2 px-3 font-semibold text-gray-200">Depot</th>
                                    </tr>
                                </thead>
                            </table>
                        </div>
                    </div>
                    <div className="max-h-[28rem] overflow-y-auto">
                        <table className="w-full text-xs text-gray-400 border-collapse">
                            <tbody>
                                {unmatchedRows.slice(0, 50).map((row, i) => (
                                    <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/20">
                                        <td className="py-2 px-3 font-mono text-orange-300 min-w-[10rem] break-words">{row.registration}</td>
                                        <td className="py-2 px-3 text-gray-500 min-w-[8rem]">{row.date}</td>
                                        <td className="py-2 px-3 text-right text-gray-500 min-w-[7rem]">{row.odometer?.toLocaleString()}</td>
                                        <td className="py-2 px-3 text-right text-gray-500 min-w-[6rem]">{row.litres}</td>
                                        <td className="py-2 px-3 text-gray-500 min-w-[7rem]">{row.depot}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {unmatchedRows.length > 50 && (
                        <div className="mt-2 text-xs text-gray-500 italic">Showing 50 of {unmatchedRows.length} unmatched rows</div>
                    )}
                </div>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                    onClick={importMatchedRows}
                    disabled={!matchedRows.length || loading}
                    className="w-full sm:w-auto bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
                >
                    Import Matched Rows
                </button>
                <button
                    onClick={createPlaceholdersAndImportAll}
                    disabled={!unmatchedRows.length || loading}
                    className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
                >
                    Create Missing Assets & Import All
                </button>
                <button
                    onClick={() => hideModal()}
                    className="w-full sm:w-auto bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
                >
                    Close
                </button>
            </div>
        </div>
    );
};

export default BulkFuelImportModal;
