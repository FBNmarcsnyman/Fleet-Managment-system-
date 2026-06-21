import { useEffect, useState } from 'react';

// Live alerts (off-road vehicle, unassigned load, expiring docs…) are derived
// from current state, so they can't be "deleted". When the user dismisses one
// we remember it here so it stays cleared — persisted to localStorage so it
// survives a page reload (previously the mute set was in-memory only, so cleared
// alerts came straight back on refresh). A tiny pub/sub lets the bell badge and
// the notification panel both react the instant a mute changes.

const KEY = 'fbn_muted_live_alerts';

const load = (): Set<string> => {
    try { return new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); }
    catch { return new Set(); }
};

let muted: Set<string> = load();
const listeners = new Set<() => void>();

const save = () => { try { localStorage.setItem(KEY, JSON.stringify([...muted])); } catch { /* storage full / unavailable */ } };
const emit = () => listeners.forEach(l => l());

export const isMuted = (id: string): boolean => muted.has(id);

export const muteAlert = (id: string): void => { muted.add(id); save(); emit(); };
export const muteAlerts = (ids: string[]): void => { ids.forEach(id => muted.add(id)); save(); emit(); };

// Subscribe to mute changes (returns an unsubscribe fn). Hook below wraps this so
// any component that filters live alerts re-renders when the mute set changes.
export const subscribeMutes = (fn: () => void): (() => void) => { listeners.add(fn); return () => listeners.delete(fn); };

export const useMutedLiveAlerts = (): Set<string> => {
    const [, force] = useState(0);
    useEffect(() => subscribeMutes(() => force(x => x + 1)), []);
    return muted;
};
