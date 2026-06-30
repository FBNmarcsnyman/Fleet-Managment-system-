import React, { useState } from 'react';
import { useUIState, useOperations, useAuth } from '../../contexts/AppContexts';

// Always-visible quick-collect button (bottom-right). On mobile it's the
// fastest way to log a collection from any screen; on desktop it's a handy
// shortcut. Opens the ops or broking collection form with the create handler.
const CollectFab: React.FC = () => {
    const { currentUser, hasPermission } = useAuth();
    const { showModal, showToast } = useUIState();
    const { handleCreateLoadConfirmation: createLoadCon } = useOperations() as any;
    const [open, setOpen] = useState(false);

    if (!currentUser || !hasPermission('access_operations')) return null;

    const onSubmit = async (data: any) => {
        const r = await createLoadCon(data);
        if (r?.ok) showToast((r as any).warning ? `${r.value?.loadConNumber} logged — ⚠ ${(r as any).warning}` : `${r.value?.loadConNumber} logged.`);
        else showToast(`Failed: ${r?.error}`);
        return r;
    };
    const go = (type: string) => { setOpen(false); showModal(type, { onSubmit }); };

    return (
        <div className="fixed z-40 right-4 bottom-20 md:bottom-6 flex flex-col items-end gap-2">
            {open && (
                <div className="flex flex-col items-end gap-2 mb-1">
                    <button onClick={() => go('quickCollection')} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-4 rounded-full shadow-lg text-sm whitespace-nowrap active:scale-95">Ops collection</button>
                    <button onClick={() => go('brokingCollection')} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 px-4 rounded-full shadow-lg text-sm whitespace-nowrap active:scale-95">Broking collection</button>
                </div>
            )}
            <button onClick={() => setOpen(o => !o)} aria-label="Log a collection"
                className={`h-14 px-5 rounded-full shadow-xl text-white font-black uppercase tracking-wider text-sm flex items-center gap-2 transition active:scale-95 ${open ? 'bg-slate-700' : 'bg-[#13294b] hover:bg-[#1d3a66]'}`}>
                {open ? '✕ Close' : '＋ Collect'}
            </button>
        </div>
    );
};

export default CollectFab;
