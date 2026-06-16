import React, { useEffect, useState } from 'react';

// A date field that ALWAYS shows and accepts DD/MM/YYYY (e.g. 18/06/2026),
// regardless of the browser's locale — the native <input type="date"> shows
// YYYY/MM/DD on some machines, which Marc doesn't want. Internally it still
// stores an ISO yyyy-mm-dd string (what the rest of the app + database expect).

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

    // Keep the box in sync when the value is set programmatically (e.g. prefill).
    useEffect(() => { setText(isoToDisplay(value)); }, [value]);

    const handle = (raw: string) => {
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

    return (
        <input
            type="text"
            inputMode="numeric"
            maxLength={10}
            value={text}
            onChange={e => handle(e.target.value)}
            placeholder="DD/MM/YYYY"
            className={className}
        />
    );
};

export default DateField;
