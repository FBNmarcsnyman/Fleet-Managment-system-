import { useEffect, useState } from 'react';
import { directSelect, directInsert, directDelete } from '../lib/supabase';

// Managed, editable dropdown lists (commodity / packaging…). Ops can add and
// remove options; everything stays uppercase for neat data.
export const usePickOptions = (category: string): string[] => {
    const [opts, setOpts] = useState<string[]>([]);
    const load = async () => {
        const { data } = await directSelect(`pick_options?select=value&category=eq.${category}&order=value.asc`);
        setOpts(Array.isArray(data) ? data.map((r: any) => r.value) : []);
    };
    useEffect(() => {
        load();
        const h = (e: any) => { if (!e?.detail || e.detail === category) load(); };
        window.addEventListener('pick-options-changed', h);
        return () => window.removeEventListener('pick-options-changed', h);
    }, [category]);
    return opts;
};

export const addPickOption = async (category: string, value: string) => {
    const v = value.trim().toUpperCase();
    if (!v) return;
    await directInsert('pick_options', { category, value: v });
    window.dispatchEvent(new CustomEvent('pick-options-changed', { detail: category }));
};

export const removePickOption = async (category: string, value: string) => {
    await directDelete('pick_options', { category, value });
    window.dispatchEvent(new CustomEvent('pick-options-changed', { detail: category }));
};
