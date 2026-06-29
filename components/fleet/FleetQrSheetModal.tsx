import React, { useMemo, useState } from 'react';
import { Vehicle } from '../../types';
import { useFleetData } from '../../contexts/AppContexts';
import { PrinterIcon } from '../icons/PrinterIcon';

interface Props { onCancel: () => void; }

// Bulk QR-label sheet: one scannable code per vehicle/trailer reg, that opens the
// driver checklist (?checklist=<id>). Print the whole fleet's labels at once, or
// filter to a branch first. Reuses the same QR pattern as the single-vehicle modal.
const qrUrlFor = (v: Vehicle) => `${window.location.origin}${window.location.pathname}?checklist=${v.id}`;
const qrImg = (v: Vehicle, size = 220) => `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&data=${encodeURIComponent(qrUrlFor(v))}`;
const isTrailer = (v: Vehicle) => /superlink|triaxle|tri-axle|skeleton|trailer/i.test(String(v.weightCategory || ''));

const FleetQrSheetModal: React.FC<Props> = ({ onCancel }) => {
    const { vehicles = [] } = useFleetData() as any;
    const [q, setQ] = useState('');
    const [branch, setBranch] = useState('All');
    const [kind, setKind] = useState<'all' | 'trucks' | 'trailers'>('all');

    const branches = useMemo(() => {
        const set = new Set<string>();
        (vehicles as Vehicle[]).forEach(v => { if (v.branch) set.add(v.branch as string); });
        return ['All', ...Array.from(set).sort()];
    }, [vehicles]);

    const list = useMemo(() => {
        const needle = q.trim().toLowerCase();
        return (vehicles as Vehicle[])
            .filter(v => v.status !== 'Sold')
            .filter(v => branch === 'All' || v.branch === branch)
            .filter(v => kind === 'all' || (kind === 'trailers' ? isTrailer(v) : !isTrailer(v)))
            .filter(v => !needle || `${v.name} ${v.registration}`.toLowerCase().includes(needle))
            .sort((a, b) => `${a.name}`.localeCompare(`${b.name}`));
    }, [vehicles, q, branch, kind]);

    const printSheet = () => {
        const labels = list.map(v => `
            <div class="label">
                <img src="${qrImg(v, 300)}" alt="${v.registration}" />
                <div class="reg">${v.registration || ''}</div>
                <div class="name">${v.name || ''}</div>
                <div class="hint">Scan to start the vehicle checklist</div>
            </div>`).join('');
        const win = window.open('', '_blank');
        if (!win) return;
        win.document.write(`<html><head><title>FBN Vehicle QR Labels</title><style>
            * { box-sizing: border-box; }
            body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 10mm; }
            .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8mm; }
            .label { border: 1px dashed #999; border-radius: 8px; padding: 8px; text-align: center; page-break-inside: avoid; }
            .label img { width: 150px; height: 150px; }
            .reg { font-size: 18px; font-weight: 800; color: #13294b; margin-top: 4px; letter-spacing: 1px; }
            .name { font-size: 12px; color: #444; }
            .hint { font-size: 10px; color: #888; margin-top: 4px; }
            @media print { @page { margin: 8mm; } }
        </style></head><body>
            <div class="grid">${labels}</div>
            <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 600); };<\/script>
        </body></html>`);
        win.document.close();
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h2 className="text-2xl font-black text-white">Vehicle QR Labels</h2>
                    <p className="text-sm text-gray-400">Print a code for each truck &amp; trailer — drivers scan it to run the checklist.</p>
                </div>
                <button onClick={printSheet} disabled={!list.length} className="flex items-center bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-2 px-4 rounded-lg">
                    <PrinterIcon className="h-5 w-5 mr-2" /> Print {list.length} label{list.length === 1 ? '' : 's'}
                </button>
            </div>

            <div className="flex items-center gap-2 mb-4">
                <select value={branch} onChange={e => setBranch(e.target.value)} className="bg-gray-700 text-white p-2 rounded-md text-sm border border-gray-600">
                    {branches.map(b => <option key={b} value={b}>{b === 'All' ? 'All branches' : b}</option>)}
                </select>
                <select value={kind} onChange={e => setKind(e.target.value as any)} className="bg-gray-700 text-white p-2 rounded-md text-sm border border-gray-600">
                    <option value="all">Trucks &amp; trailers</option>
                    <option value="trucks">Trucks only</option>
                    <option value="trailers">Trailers only</option>
                </select>
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search reg or name…" className="bg-gray-700 text-white p-2 rounded-md text-sm border border-gray-600 flex-1" />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[55vh] overflow-y-auto pr-1">
                {list.map(v => (
                    <div key={v.id} className="bg-white rounded-lg p-2 text-center">
                        <img src={qrImg(v, 160)} alt={v.registration} className="w-full aspect-square object-contain" />
                        <div className="text-sm font-black text-[#13294b] mt-1">{v.registration}</div>
                        <div className="text-[11px] text-gray-500 truncate">{v.name}</div>
                    </div>
                ))}
                {list.length === 0 && <p className="col-span-full text-center text-gray-500 py-10">No vehicles match.</p>}
            </div>

            <div className="flex justify-end mt-6">
                <button onClick={onCancel} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-5 rounded-lg">Close</button>
            </div>
        </div>
    );
};

export default FleetQrSheetModal;
