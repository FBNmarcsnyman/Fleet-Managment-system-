import React, { useEffect, useState } from 'react';

// Stops the recurring "I deployed but it still shows the old screen" problem.
// A single-page app keeps running whatever bundle the tab first loaded; new
// deploys only land on refresh. This watches the live index.html (no-cache) for
// a new entry-bundle hash and offers a one-tap update (or auto-reloads when the
// tab has been idle), so the latest version reaches the device on its own.
const currentEntry = (() => {
    const scripts = Array.from(document.querySelectorAll('script'));
    const src = scripts.map(s => s.getAttribute('src') || '').find(s => /\/assets\/index-[\w-]+\.js/.test(s));
    const m = src ? src.match(/index-[\w-]+\.js/) : null;
    return m ? m[0] : '';
})();

const VersionWatcher: React.FC = () => {
    const [stale, setStale] = useState(false);

    useEffect(() => {
        if (!currentEntry) return; // dev / unknown build — nothing to compare
        let cancelled = false;
        const check = async () => {
            if (cancelled) return;
            try {
                const r = await fetch('/index.html', { cache: 'no-store' });
                if (!r.ok) return;
                const html = await r.text();
                const m = html.match(/index-[\w-]+\.js/);
                if (m && m[0] !== currentEntry) setStale(true);
            } catch { /* offline — ignore */ }
        };
        const id = window.setInterval(check, 60000);
        const onFocus = () => check();
        window.addEventListener('focus', onFocus);
        check();
        return () => { cancelled = true; window.clearInterval(id); window.removeEventListener('focus', onFocus); };
    }, []);

    if (!stale) return null;
    return (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[200] bg-[#13294b] text-white rounded-full shadow-2xl ring-2 ring-[#f5b700] px-4 py-2.5 flex items-center gap-3 text-sm font-bold animate-pulse">
            <span>A new version is ready.</span>
            <button onClick={() => window.location.reload()} className="bg-[#f5b700] text-[#13294b] font-black px-3 py-1 rounded-full hover:brightness-95">Update now</button>
        </div>
    );
};

export default VersionWatcher;
