import React, { useEffect, useRef, useState } from 'react';

// A date field that ALWAYS shows and accepts DD/MM/YYYY (e.g. 18/06/2026) AND
// gives a click-to-pick calendar — the native <input type="date"> shows
// YYYY/MM/DD on some machines (which Marc doesn't want), so we show our own
// text box for the display and overlay a native date input on the calendar
// button purely to drive the OS picker. Internally we still store ISO
// yyyy-mm-dd (what the rest of the app + database expect).

const isoToDisplay = (iso: string): string => {
    if (!iso) return '';
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
};

// Returns a valid ISO date or '' — rejects nonsense like 17/00/6202 so a broken
// date can never be saved (which would make the whole load fail to create).
const displayToIso = (s: string): string => {
    const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return '';
    const dd = +m[1], mm = +m[2], yyyy = +m[3];
    if (mm < 1 || mm > 12) return '';
    if (dd < 1 || dd > 31) return '';
    if (yyyy < 2020 || yyyy > 2100) return '';
    return `${m[3]}-${m[2]}-${m[1]}`;
};

interface Props {
    value: string;                       // ISO yyyy-mm-dd ('' when empty)
    onChange: (iso: string) => void;
    className?: string;
}

const DateField: React.FC<Props> = ({ value, onChange, className }) => {
    const [text, setText] = useState(isoToDisplay(value));
    const pickerRef = useRef<HTMLInputElement>(null);

    // Keep the box in sync when the value is set programmatically (e.g. prefill).
    useEffect(() => { setText(isoToDisplay(value)); }, [value]);

    const handleText = (raw: string) => {
        // Keep digits only, then auto-insert the slashes as they type: DD/MM/YYYY.
        const digits = raw.replace(/\D/g, '').slice(0, 8);
        let out = digits;
        if (digits.length >= 5) out = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
        else if (digits.length >= 3) out = `${digits.slice(0, 2)}/${digits.slice(2)}`;
        setText(out);
        if (out === '') { onChange(''); return; }
        const iso = displayToIso(out);
        if (iso) onChange(iso);            // only push a complete, valid date upstream
    };

    const openPicker = () => {
        const el = pickerRef.current;
        if (!el) return;
        // showPicker() is the reliable way to open the OS calendar on demand.
        if (typeof (el as any).showPicker === 'function') { try { (el as any).showPicker(); return; } catch { /* fall back */ } }
        el.focus(); el.click();
    };

    return (
        <div className="relative">
            <input
                type="text"
                inputMode="numeric"
                maxLength={10}
                value={text}
                onChange={e => handleText(e.target.value)}
                placeholder="DD/MM/YYYY"
                className={className}
            />
            {/* Calendar button — opens the OS date picker. */}
            <button type="button" onClick={openPicker} aria-label="Pick a date"
                className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-blue-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
            </button>
            {/* Hidden native date input that actually drives the picker. */}
            <input
                ref={pickerRef}
                type="date"
                value={value || ''}
                onChange={e => { onChange(e.target.value); setText(isoToDisplay(e.target.value)); }}
                className="absolute right-0 bottom-0 w-0 h-0 opacity-0 pointer-events-none"
                tabIndex={-1}
            />
        </div>
    );
};

export default DateField;
