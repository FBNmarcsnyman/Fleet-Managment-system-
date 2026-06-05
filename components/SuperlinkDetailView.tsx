import React from 'react';
import { Vehicle } from '../types';
import { useVehicles } from '../contexts/AppContexts';
import { BackIcon } from './icons/BackIcon';
import { LinkIcon } from './icons/LinkIcon';
import SingleVehicleDetailView from './SingleVehicleDetailView';

interface SuperlinkDetailViewProps {
    vehicleA: Vehicle;
    vehicleB: Vehicle;
}

// Returns the deck length in metres if we can infer it from the trailer's
// fields. Marc records 6m vs 12m via Vehicle.deckMeters; for vehicles that
// haven't been tagged yet we fall back to undefined so the sort just keeps
// insertion order.
const inferDeckMetres = (v: Vehicle): number | undefined => {
    if (typeof v.deckMeters === 'number' && v.deckMeters > 0) return v.deckMeters;
    return undefined;
};

const DeckBadge: React.FC<{ metres: number | undefined }> = ({ metres }) => {
    if (!metres) {
        return (
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 bg-gray-900/40 px-2 py-1 rounded border border-gray-700">
                Deck length unset
            </span>
        );
    }
    const tone = metres <= 6
        ? 'text-amber-300 border-amber-500/30 bg-amber-900/20'
        : 'text-cyan-300 border-cyan-500/30 bg-cyan-900/20';
    return (
        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded border ${tone}`}>
            {metres}m Trailer
        </span>
    );
};

const SuperlinkDetailView: React.FC<SuperlinkDetailViewProps> = ({ vehicleA, vehicleB }) => {
    const { handleSelectVehicle } = useVehicles();

    // Marc's rule: 6m trailer first, 12m second. Sort by deckMeters ascending
    // (undefined sorts last so untagged trailers don't randomly outrank tagged
    // ones). If both are untagged, fall back to the original A/B order.
    const ordered = [vehicleA, vehicleB].sort((a, b) => {
        const ad = inferDeckMetres(a);
        const bd = inferDeckMetres(b);
        if (ad === undefined && bd === undefined) return 0;
        if (ad === undefined) return 1;
        if (bd === undefined) return -1;
        return ad - bd;
    });

    return (
        <div>
            <button onClick={() => handleSelectVehicle(null)} className="flex items-center text-brand-secondary hover:text-blue-400 mb-6 font-semibold">
                <BackIcon className="h-5 w-5 mr-2" /> Back to Fleet List
            </button>
            <div className="mb-6">
                <h2 className="text-3xl font-bold text-white flex items-center gap-3 flex-wrap">
                    <LinkIcon className="h-7 w-7 text-blue-400" />
                    Superlink Pair: {ordered[0].registration}
                    <span className="text-gray-500">+</span>
                    {ordered[1].registration}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                    Lead (front) trailer above, second (rear) trailer below. Edit the trailer's deck length
                    (6m or 12m) in Asset Admin if either badge below reads "Deck length unset".
                </p>
            </div>

            {/* Stacked vertically so each trailer gets full width for its
                seven-tab strip. Side-by-side caused the tab labels to bleed
                into the adjacent column on Marc's screen (the seven tabs do
                not fit in half-width). The vertical stack also reinforces
                the 6m-first ordering the operations team relies on. */}
            <div className="space-y-8">
                {ordered.map((v, idx) => (
                    <div key={v.id} className="bg-gray-900/30 border border-gray-700/50 rounded-2xl p-4 relative">
                        <div className="absolute -top-3 left-4 flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-blue-300 bg-gray-900 px-2 py-1 rounded border border-blue-500/40">
                                {idx === 0 ? 'Lead Trailer' : 'Rear Trailer'}
                            </span>
                            <DeckBadge metres={inferDeckMetres(v)} />
                        </div>
                        <SingleVehicleDetailView vehicle={v} isEmbedded={true} />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SuperlinkDetailView;
