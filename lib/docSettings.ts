import { supabase } from './supabase';

const ORG = '00000000-0000-0000-0000-000000000001';

// Editable boilerplate that appears on every LoadCon / Order / POD.
export interface DocSettings {
    officeName: string;
    officeLines: string[];
    podsEmail: string;
    notesHead: string;        // the big red NOTES heading
    notesBullets: string[];   // the bullet clauses under NOTES
    defaultSpecial: string;   // default special-instructions (red text)
    gitAmount: string;        // GIT required / load
    footer: string;
}

export const DEFAULT_DOC_SETTINGS: DocSettings = {
    officeName: 'Durban Head Office:',
    officeLines: ['P O Box 1405, HILLCREST', 'Phone: 031 - 205 1705', 'Fax: 031 - 205 2098', 'Email: fbndbn@fbn-transport.co.za'],
    podsEmail: 'pods@fbn-transport.co.za',
    notesHead: 'NOTES: PLEASE SCAN COPIES OF PODS AND SUPPLIER DOCS WITHIN 24-48hrs AFTER DELIVERY TO THE EMAIL YOU RECEIVED THE LOADCON ON AND {podsEmail}',
    notesBullets: [
        'BY ACCEPTING THIS LOAD/LOADCON YOU ACCEPT THE FBN TRANSPORT SUBCONTRACTOR TERMS & CONDITIONS.',
        'NO INVOICE WILL BE PAID UNTIL ALL THE RELEVANT, CORRECTLY REFERENCED ORIGINAL DOCUMENTATION HAS BEEN RECEIVED.',
        'ALL DOCUMENTATION TO BE RECEIVED BY FBN TRANSPORT CC BEFORE 12 NOON ON THE 20TH OF EACH MONTH. IF RECEIVED LATER THAN THE 20TH, PAYMENT WILL ONLY BE MADE 60 DAYS FROM RECEIPT.',
        'ALL VEHICLES ARE TO BE FITTED WITH REPUTABLE TRACKING AND 24hr SURVEILLANCE UNITS AND VEHICLES TO SLEEP AT SAFE AND SECURE TRUCK STOPS.',
    ],
    defaultSpecial: 'Please ensure cargo is secured and tarped correctly, tarps must be in good condition. CARGO MUST NOT GET WET.',
    gitAmount: 'R 1 500 000.00',
    footer: 'FBN Transport  |  Commercial Freight Specialists  |  tracking@fbn-transport.co.za',
};

let cache: DocSettings | null = null;

export const getDocSettings = async (): Promise<DocSettings> => {
    if (cache) return cache;
    try {
        const { data } = await supabase.from('document_settings' as any).select('settings').eq('organization_id', ORG).single();
        cache = { ...DEFAULT_DOC_SETTINGS, ...(((data as any)?.settings as Partial<DocSettings>) || {}) };
    } catch {
        cache = { ...DEFAULT_DOC_SETTINGS };
    }
    return cache;
};

export const saveDocSettings = async (s: DocSettings): Promise<{ ok: boolean; error?: string }> => {
    const { error } = await supabase.from('document_settings' as any)
        .upsert({ organization_id: ORG, settings: s as any, updated_at: new Date().toISOString() }, { onConflict: 'organization_id' });
    if (error) return { ok: false, error: error.message };
    cache = { ...s };
    return { ok: true };
};

// Synchronous access to the cached settings (falls back to defaults). Use after
// getDocSettings() has run at least once.
export const cachedDocSettings = (): DocSettings => cache || DEFAULT_DOC_SETTINGS;
