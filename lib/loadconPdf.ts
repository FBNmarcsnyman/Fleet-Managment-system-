import { jsPDF } from 'jspdf';
import { LoadConfirmation } from '../types';
import { getDocSettings } from './docSettings';

export type DocType = 'loadcon' | 'clientOrder' | 'deliveryNote';

const NAVY: [number, number, number] = [19, 41, 75];
const RED: [number, number, number] = [197, 32, 32];
const BLACK: [number, number, number] = [25, 30, 40];
const GREY: [number, number, number] = [90, 100, 115];
const BORDER: [number, number, number] = [19, 41, 75];

const money = (n?: number) => 'R ' + (n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const fmt = (d?: string) => {
    if (!d) return '';
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
};

const logoDataUrl = async (): Promise<string | null> => {
    try {
        const r = await fetch('/fbn-logo.jpg');
        if (!r.ok) return null;
        const b = await r.blob();
        return await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result as string); fr.onerror = () => res(null); fr.readAsDataURL(b); });
    } catch { return null; }
};

type Style = 'label' | 'value' | 'banner' | 'centerLabel';
type Cell = { w: number; text?: string; style?: Style; size?: number };

export const buildLoadConPdf = async (lc: LoadConfirmation, type: DocType): Promise<{ doc: jsPDF; base64: string; filename: string }> => {
    const ds = await getDocSettings();
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = 210, M = 10, CW = W - 2 * M;
    const PAD = 1.6;
    const title = type === 'deliveryNote' ? 'DELIVERY NOTE / POD' : type === 'clientOrder' ? 'TRANSPORT ORDER' : 'TRANSPORT ORDER';
    let y = 12;

    // ---------- Letterhead: logo left, head-office block right ----------
    const logo = await logoDataUrl();
    if (logo) { try { doc.addImage(logo, 'JPEG', M, y, 60, 18); } catch { /* ignore */ } }
    const addr = [ds.officeName, ...ds.officeLines];
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...GREY);
    addr.forEach((line, i) => { doc.setFont('helvetica', i === 0 ? 'bold' : 'normal'); doc.setTextColor(...(i === 0 ? NAVY : GREY)); doc.text(line, W - M, y + 2 + i * 4, { align: 'right' }); });
    y += 22;
    // Clean navy rule beneath the letterhead (no yellow on documents).
    doc.setDrawColor(...NAVY); doc.setLineWidth(0.8); doc.line(M, y, W - M, y);
    y += 4;

    const lineHFor = (size: number) => size * 0.42 + 0.7;

    // ---------- generic bordered row (taller, vertically-centred) ----------
    const row = (cells: Cell[], minH = 9) => {
        const measured = cells.map(c => {
            const size = c.size || (c.style === 'banner' ? 10 : 8);
            doc.setFontSize(size);
            const lines = doc.splitTextToSize(c.text || '', c.w - 2 * PAD);
            return { lines, size };
        });
        const h = Math.max(minH, ...measured.map(m => m.lines.length * lineHFor(m.size) + 2 * PAD));
        if (y + h > 286) { doc.addPage(); y = 14; }
        let x = M;
        cells.forEach((c, i) => {
            const { lines, size } = measured[i];
            if (c.style === 'banner') { doc.setFillColor(...NAVY); doc.rect(x, y, c.w, h, 'F'); }
            doc.setDrawColor(...BORDER); doc.setLineWidth(0.25); doc.rect(x, y, c.w, h);
            doc.setFontSize(size);
            const isLabel = c.style === 'label' || c.style === 'banner' || c.style === 'centerLabel';
            doc.setFont('helvetica', isLabel ? 'bold' : 'normal');
            doc.setTextColor(...(c.style === 'banner' ? [255, 255, 255] as [number, number, number] : isLabel ? NAVY : BLACK));
            const centered = c.style === 'banner' || c.style === 'centerLabel';
            const tx = centered ? x + c.w / 2 : x + PAD;
            // vertical-centre the text block within the cell
            const textH = lines.length * lineHFor(size);
            const ty = y + (h - textH) / 2 + size * 0.34;
            doc.text(lines, tx, ty, { align: centered ? 'center' : 'left' });
            x += c.w;
        });
        y += h;
    };

    // ---------- the big red NOTES block (subcontractor LoadCon only) ----------
    const notesBlock = () => {
        const head = ds.notesHead.replace('{podsEmail}', ds.podsEmail);
        doc.setFontSize(8.5); doc.setFont('helvetica', 'bold');
        const headLines = doc.splitTextToSize(head, CW - 2 * PAD);
        doc.setFontSize(6.4); doc.setFont('helvetica', 'normal');
        const bulletLines = ds.notesBullets.map(b => doc.splitTextToSize('•  ' + b, CW - 2 * PAD - 2));
        const h = 2 * PAD + headLines.length * lineHFor(8.5) + 1 + bulletLines.reduce((s, bl) => s + bl.length * lineHFor(6.4), 0) + bulletLines.length * 0.6;
        if (y + h > 286) { doc.addPage(); y = 14; }
        doc.setDrawColor(...BORDER); doc.setLineWidth(0.25); doc.rect(M, y, CW, h);
        let ty = y + PAD + 2.6;
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...RED);
        doc.text(headLines, M + PAD, ty); ty += headLines.length * lineHFor(8.5) + 1;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(6.4); doc.setTextColor(...NAVY);
        bulletLines.forEach(bl => { doc.text(bl, M + PAD + 1, ty); ty += bl.length * lineHFor(6.4) + 0.6; });
        y += h;
    };

    // ---------- special instructions (navy heading + red body) ----------
    const specialBlock = () => {
        const body = `${lc.specialInstructions ? lc.specialInstructions + '  ' : ''}${ds.defaultSpecial}`;
        doc.setFontSize(7.5); doc.setFont('helvetica', 'bold');
        const bodyLines = doc.splitTextToSize(body, CW - 2 * PAD);
        const h = 2 * PAD + lineHFor(7.5) + bodyLines.length * lineHFor(7.5);
        if (y + h > 286) { doc.addPage(); y = 14; }
        doc.setDrawColor(...BORDER); doc.setLineWidth(0.25); doc.rect(M, y, CW, h);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...NAVY);
        doc.text('SPECIAL INSTRUCTIONS:', M + PAD, y + PAD + 2.6);
        doc.setTextColor(...RED);
        doc.text(bodyLines, M + PAD, y + PAD + 2.6 + lineHFor(7.5));
        y += h;
    };

    const L = 34;
    const c3 = (CW - 3 * L) / 3;

    // Title banner
    row([{ w: CW, text: title, style: 'banner' }]);

    if (type === 'deliveryNote') {
        row([{ w: L, text: 'CONSIGNMENT', style: 'label' }, { w: CW / 2 - L, text: lc.loadConNumber }, { w: L, text: 'FBN REF', style: 'label' }, { w: CW / 2 - L, text: lc.loadRefNo || '' }]);
        row([{ w: L, text: 'CARRIER', style: 'label' }, { w: CW / 2 - L, text: lc.subcontractorName || '' }, { w: L, text: 'DRIVER', style: 'label' }, { w: CW / 2 - L, text: lc.subcontractorDriverName || '' }]);
    } else if (type === 'clientOrder') {
        row([{ w: L, text: 'INSTRUCTION FROM', style: 'label' }, { w: CW / 2 - L, text: lc.fbnRepresentative || '' }, { w: L, text: 'LOADCON NO', style: 'label' }, { w: CW / 2 - L, text: lc.loadConNumber }]);
        row([{ w: L, text: 'CLIENT', style: 'label' }, { w: CW / 2 - L, text: lc.clientName || '' }, { w: L, text: 'FOR ATT', style: 'label' }, { w: CW / 2 - L, text: lc.clientContact || '' }]);
        row([{ w: L, text: 'FBN REF', style: 'label' }, { w: CW / 2 - L, text: lc.loadRefNo || '' }, { w: L, text: 'CUST O/NO', style: 'label' }, { w: CW / 2 - L, text: lc.customerOrderNumber || '' }]);
    } else {
        row([{ w: L, text: 'INSTRUCTION FROM', style: 'label' }, { w: CW / 2 - L, text: lc.fbnRepresentative || '' }, { w: L, text: 'LOADCON NO', style: 'label' }, { w: CW / 2 - L, text: lc.loadConNumber }]);
        row([{ w: L, text: 'SUB-CONTRACTOR', style: 'label' }, { w: CW / 2 - L, text: lc.subcontractorName || '' }, { w: L, text: 'FOR ATT', style: 'label' }, { w: CW / 2 - L, text: lc.forAttention || '' }]);
        row([{ w: L, text: 'REG + DRIVER', style: 'label' }, { w: CW / 2 - L, text: lc.subcontractorDriverName || lc.subcontractorVehicleReg || '' }, { w: L, text: 'DRIVER CELL', style: 'label' }, { w: CW / 2 - L, text: lc.subcontractorDriverCell || '' }]);
        notesBlock();
    }

    row([{ w: L, text: 'ROUTE', style: 'label' }, { w: CW / 2 - L, text: lc.route || '', style: 'value' }, { w: L, text: 'BRANCH / PRIORITY', style: 'label' }, { w: CW / 2 - L, text: `${lc.arrangingBranch || ''}${lc.priority ? '  -  ' + lc.priority : ''}`, style: 'value' }]);

    specialBlock();

    row([
        { w: L, text: 'LOADING DATE', style: 'label' }, { w: c3, text: fmt(lc.collectionDate), style: 'value' },
        { w: L, text: 'LOADING TIME', style: 'label' }, { w: c3, text: lc.loadingTime || '', style: 'value' },
        { w: L, text: 'CUST O/NO', style: 'label' }, { w: c3, text: lc.customerOrderNumber || '', style: 'value' },
    ]);
    row([
        { w: L, text: 'OFFLOADING DATE', style: 'label' }, { w: c3, text: fmt(lc.deliveryDate), style: 'value' },
        { w: L, text: 'OFFLOADING TIME', style: 'label' }, { w: c3, text: lc.offloadingTime || '', style: 'value' },
        { w: L, text: 'CONTAINER NO', style: 'label' }, { w: c3, text: lc.containerNo || '', style: 'value' },
    ]);
    row([
        { w: L, text: 'QUANTITY', style: 'label' }, { w: c3, text: lc.quantity || '', style: 'value' },
        { w: L, text: 'LOAD TYPE', style: 'label' }, { w: c3, text: lc.loadType || '', style: 'value' },
        { w: L, text: 'WEIGHT', style: 'label' }, { w: c3, text: lc.weightKg ? `${lc.weightKg} KG` : '', style: 'value' },
    ]);
    row([
        { w: L, text: 'VOLUME', style: 'label' }, { w: c3, text: lc.volume || '', style: 'value' },
        { w: L, text: 'CARGO VALUE', style: 'label' }, { w: c3, text: lc.cargoValue || '', style: 'value' },
        { w: L, text: 'CONT TURN-IN', style: 'label' }, { w: c3, text: lc.containerTurnInAddress || '', style: 'value' },
    ]);
    row([{ w: L, text: 'COMMODITY', style: 'label' }, { w: CW - L, text: `${lc.commodity || ''}${lc.packaging ? ' - ' + lc.packaging : ''}`, style: 'value' }]);
    if (lc.containerNo || lc.containerSealNo || lc.containerOperator) {
        row([
            { w: L, text: 'CONTAINER NO', style: 'label' }, { w: c3, text: lc.containerNo || '', style: 'value' },
            { w: L, text: 'OPERATOR', style: 'label' }, { w: c3, text: lc.containerOperator || '', style: 'value' },
            { w: L, text: 'SEAL NO', style: 'label' }, { w: c3, text: lc.containerSealNo || '', style: 'value' },
        ]);
    }

    // Addresses
    row([{ w: CW / 2, text: 'COLLECTION ADDRESS', style: 'centerLabel' }, { w: CW / 2, text: 'DELIVERY ADDRESS', style: 'centerLabel' }]);
    row([{ w: CW / 2, text: lc.collectionPoint || '', style: 'value' }, { w: CW / 2, text: lc.deliveryPoint || '', style: 'value' }]);
    row([
        { w: 18, text: 'CONTACT', style: 'label', size: 7 }, { w: CW / 2 - 18, text: `${lc.collectionContact || ''}${lc.collectionTelephone ? ' / ' + lc.collectionTelephone : ''}`, style: 'value' },
        { w: 18, text: 'CONTACT', style: 'label', size: 7 }, { w: CW / 2 - 18, text: `${lc.deliveryContact || ''}${lc.deliveryTelephone ? ' / ' + lc.deliveryTelephone : ''}`, style: 'value' },
    ]);

    row([{ w: L, text: 'EQUIPMENT REQUIRED', style: 'label' }, { w: CW - L, text: (lc.equipmentRequired || []).join(', '), style: 'value' }]);

    // Rate row
    if (type === 'loadcon') {
        row([{ w: L, text: 'AGREED RATE', style: 'label' }, { w: 52, text: money(lc.supplierRate), style: 'value', size: 9 }, { w: L, text: 'RATE EXCL V.A.T.', style: 'label', size: 7 }, { w: CW - 2 * L - 52, text: `GIT/LOAD: ${ds.gitAmount}`, style: 'value', size: 7.5 }]);
    } else if (type === 'clientOrder') {
        row([{ w: L, text: 'AGREED RATE', style: 'label' }, { w: CW / 2 - L, text: money(lc.totalAmount), style: 'value', size: 9 }, { w: L, text: 'RATE EXCL V.A.T.', style: 'label', size: 7 }, { w: CW / 2 - L, text: '', style: 'value' }]);
    }

    // POD signature block
    if (type === 'deliveryNote') {
        row([{ w: CW / 2, text: 'RECEIVED IN GOOD ORDER BY', style: 'centerLabel' }, { w: CW / 2, text: 'DATE / TIME', style: 'centerLabel' }]);
        row([{ w: CW / 2, text: ' ', style: 'value' }, { w: CW / 2, text: ' ', style: 'value' }]);
        row([{ w: CW, text: 'SHORTAGES / DAMAGES / REMARKS', style: 'centerLabel' }]);
        row([{ w: CW, text: '  ', style: 'value' }]);
    }

    // Subcontractor acceptance block — they complete & sign back (also fills the page)
    if (type === 'loadcon') {
        y += 3;
        row([{ w: CW, text: 'SUBCONTRACTOR ACCEPTANCE  -  PLEASE COMPLETE & RETURN TO CONFIRM', style: 'banner', size: 8.5 }], 8);
        row([{ w: L, text: 'DRIVER NAME', style: 'label' }, { w: CW / 2 - L, text: '', style: 'value' }, { w: L, text: 'VEHICLE REG', style: 'label' }, { w: CW / 2 - L, text: '', style: 'value' }], 12);
        row([{ w: L, text: 'DRIVER CELL', style: 'label' }, { w: CW / 2 - L, text: '', style: 'value' }, { w: L, text: 'SIGNATURE', style: 'label' }, { w: CW / 2 - L, text: '', style: 'value' }], 12);
        row([{ w: L, text: 'DATE', style: 'label' }, { w: CW / 2 - L, text: '', style: 'value' }, { w: L, text: 'COMPANY STAMP', style: 'label' }, { w: CW / 2 - L, text: '', style: 'value' }], 16);
    }

    // Footer: clickable T&Cs link (subbie) + branding
    y += 3;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    if (type === 'loadcon') {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...RED);
        const tcs = 'CLICK HERE FOR SUBCONTRACTOR TERMS & CONDITIONS';
        const tw = doc.getTextWidth(tcs);
        const tx = (W - tw) / 2;
        doc.textWithLink(tcs, tx, y, { url: `${origin}?tcs=1` });
        doc.setDrawColor(...RED); doc.setLineWidth(0.3); doc.line(tx, y + 1, tx + tw, y + 1); // underline = looks like a link
        y += 5;
    }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.8); doc.setTextColor(150, 160, 170);
    doc.text(ds.footer, W / 2, y, { align: 'center' });

    const base64 = (doc.output('datauristring') as string).split(',')[1] || '';
    return { doc, base64, filename: `${title.replace(/[^A-Za-z0-9]+/g, '_')}_${lc.loadConNumber}.pdf` };
};
