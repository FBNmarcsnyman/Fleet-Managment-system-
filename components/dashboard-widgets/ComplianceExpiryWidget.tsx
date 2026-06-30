import React, { useMemo } from 'react';
import { useVehicles } from '../../contexts/AppContexts';
import { differenceInDays } from 'date-fns';
import { Vehicle, User, VehicleComplianceDoc } from '../../types';

type Bucket = 'expired' | 'd30' | 'd60' | 'd90';

interface ExpiryItem {
    subject: 'Driver' | 'Vehicle';
    who: string;       // driver name or vehicle name/reg
    kind: string;      // Licence, PDP, Medical, CoF...
    date: string;
    days: number;      // days until expiry (negative = expired)
    bucket: Bucket;
}

const bucketFor = (days: number): Bucket | null => {
    if (days < 0) return 'expired';
    if (days <= 30) return 'd30';
    if (days <= 60) return 'd60';
    if (days <= 90) return 'd90';
    return null;
};

const ComplianceExpiryWidget: React.FC = () => {
    const { users = [], vehicles = [], vehicleComplianceDocs = [] } = useVehicles() as {
        users: User[]; vehicles: Vehicle[]; vehicleComplianceDocs: VehicleComplianceDoc[];
    };

    const items = useMemo<ExpiryItem[]>(() => {
        const out: ExpiryItem[] = [];
        const today = new Date();
        const add = (subject: ExpiryItem['subject'], who: string, kind: string, date?: string) => {
            if (!date) return;
            const days = differenceInDays(new Date(date), today);
            const bucket = bucketFor(days);
            if (bucket) out.push({ subject, who, kind, date: date.split('T')[0], days, bucket });
        };

        // Driver documents
        (users || []).forEach(u => {
            if (u.role !== 'Driver' && u.role !== 'Staff') return;
            add('Driver', u.name, 'Licence', u.licenseExpiry);
            add('Driver', u.name, 'PDP', u.pdpExpiry);
            add('Driver', u.name, 'Medical', u.medicalExpiry);
            add('Driver', u.name, 'DG cert', u.dgCertExpiry);
        });

        // Vehicle compliance documents
        const vName = new Map((vehicles || []).map(v => [v.id, `${v.name} (${v.registration})`]));
        (vehicleComplianceDocs || []).forEach(d => {
            add('Vehicle', vName.get(d.vehicleId) || 'Unknown vehicle', d.name || d.type, d.expiryDate);
        });

        return out.sort((a, b) => a.days - b.days);
    }, [users, vehicles, vehicleComplianceDocs]);

    const counts = useMemo(() => ({
        expired: items.filter(i => i.bucket === 'expired').length,
        d30: items.filter(i => i.bucket === 'd30').length,
        d60: items.filter(i => i.bucket === 'd60').length,
        d90: items.filter(i => i.bucket === 'd90').length,
    }), [items]);

    const tile = (label: string, value: number, cls: string) => (
        <div className={`rounded-lg p-3 text-center border ${cls}`}>
            <p className="text-2xl font-black">{value}</p>
            <p className="text-[11px] uppercase tracking-wider opacity-80">{label}</p>
        </div>
    );

    const rowColour = (b: Bucket) =>
        b === 'expired' ? 'text-red-400' : b === 'd30' ? 'text-orange-400' : b === 'd60' ? 'text-yellow-400' : 'text-gray-300';

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-4 gap-3">
                {tile('Expired', counts.expired, 'bg-red-900/30 border-red-500/30 text-red-300')}
                {tile('≤ 30 days', counts.d30, 'bg-orange-900/30 border-orange-500/30 text-orange-300')}
                {tile('≤ 60 days', counts.d60, 'bg-yellow-900/20 border-yellow-500/20 text-yellow-300')}
                {tile('≤ 90 days', counts.d90, 'bg-gray-700/40 border-gray-600 text-gray-300')}
            </div>

            {items.length === 0 ? (
                <p className="text-center text-gray-500 py-6 text-sm">
                    Nothing expiring in the next 90 days. Add driver licence/PDP dates and vehicle documents to track compliance here.
                </p>
            ) : (
                <div className="max-h-72 overflow-y-auto">
                    <table className="w-full text-sm">
                        <thead className="text-left text-gray-500 sticky top-0 bg-gray-800">
                            <tr>
                                <th className="py-1.5 pr-2">Who</th>
                                <th className="py-1.5 px-2">Document</th>
                                <th className="py-1.5 px-2">Expires</th>
                                <th className="py-1.5 pl-2 text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((i, idx) => (
                                <tr key={idx} className="border-t border-gray-700/50">
                                    <td className="py-1.5 pr-2 text-white">
                                        <span className="text-[10px] text-gray-500 mr-1">{i.subject === 'Driver' ? '' : ''}</span>{i.who}
                                    </td>
                                    <td className="py-1.5 px-2 text-gray-400">{i.kind}</td>
                                    <td className="py-1.5 px-2 text-gray-400 font-mono">{i.date}</td>
                                    <td className={`py-1.5 pl-2 text-right font-semibold ${rowColour(i.bucket)}`}>
                                        {i.days < 0 ? `Expired ${Math.abs(i.days)}d ago` : `${i.days}d left`}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default React.memo(ComplianceExpiryWidget);
