import { jsPDF } from 'jspdf';
import { LoadConfirmation } from '../types';

export type DocType = 'loadcon' | 'clientOrder' | 'deliveryNote';

const NAVY: [number, number, number] = [19, 41, 75];
const YELLOW: [number, number, number] = [245, 183, 0];
const GREY: [number, number, number] = [91, 101, 115];
const LINE: [number, number, number] = [120, 130, 145];
const DARK: [number, number, number] = [31, 41, 55];

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

const SUBBIE_NOTES =
    'PLEASE SCAN COPIES OF PODS AND SUPPLIER DOCS WITHIN 24-48hrs AFTER DELIVERY TO THE EMAIL YOU RECEIVED THE LOADCON ON AND pods@fbn-transport.co.za. ' +
    'BY ACCEPTING THIS LOAD/LOADCON YOU ACCEPT THE FBN TRANSPORT SUBCONTRACTOR TERMS & CONDITIONS. NO INVOICE WILL BE PAID UNTIL ALL THE RELEVANT, CORRECTLY ' +
    'REFERENCED ORIGINAL DOCUMENTATION HAS BEEN RECEIVED. ALL DOCUMENTATION TO BE RECEIVED BY FBN TRANSPORT BEFORE 12 NOON ON THE 20TH OF EACH MONTH. IF ' +
    'RECEIVED LATER THAN THE 20TH, PAYMENT WILL ONLY BE MADE 60 DAYS FROM RECEIPT. ALL VEHICLES ARE TO BE FITTED WITH REPUTABLE TRACKING AND 24hr SURVEILLANCE ' +
    'UNITS AND VEHICLES TO SLEEP AT SAFE AND SECURE TRUCK STOPS.';

const DEFAULT_SPECIAL = 'Please ensure cargo is secured and tarped correctly, tarps must be in good condition. CARGO MUST NOT GET WET.';

type Cell = { w: number; text?: string; label?: boolean; align?: 'left' | 'center'; size?: number };

// Builds the FBN "TRANSPORT ORDER" grid document (LoadCon / Client Order / POD)
// to match the company's real template.
export const buildLoadConPdf = async (lc: LoadConfirmation, type: DocType): Promise<{ doc: jsPDF; base64: string; filename: string }> => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = 210, M = 10, CW = W - 2 * M;
    let y = 12;

    const title = type === 'deliveryNote' ? 'DELIVERY NOTE / POD' : type === 'clientOrder' ? 'TRANSPORT ORDER (CLIENT)' : 'TRANSPORT ORDER';
    const ref = lc.loadConNumber + (type === 'clientOrder' ? '-C' : type === 'deliveryNote' ? '-DN' : '');

    // ---- Header: logo + title + ref ----
    const logo = await logoDataUrl();
    if (logo) { try { doc.addImage(logo, 'JPEG', M, y, 50, 15); } catch { /* ignore */ } }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6); doc.setTextColor(...GREY);
    doc.text('COMMERCIAL FREIGHT SPECIALISTS', M, y + 19);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.setTextColor(...NAVY);
    doc.text(title, W - M, y + 6, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...GREY);
    doc.text(`LoadCon No: ${lc.loadConNumber}`, W - M, y + 11.5, { align: 'right' });
    doc.text(`Date: ${fmt(lc.date) || fmt(new Date().toISOString())}`, W - M, y + 15.5, { align: 'right' });
    y += 22;
    doc.setFillColor(...YELLOW); doc.rect(M, y, CW, 1.4, 'F');
    y += 4;

    // ---- Generic grid row renderer (dynamic height for wrapped text) ----
    const lineH = 3.6;
    const pad = 1.6;
    const row = (cells: Cell[]) => {
        const wrapped = cells.map(c => doc.splitTextToSize(c.text || '', c.w - 2 * pad));
        const h = Math.max(6, ...wrapped.map(w => w.length * lineH + 2 * pad));
        if (y + h > 285) { doc.addPage(); y = 14; }
        let x = M;
        cells.forEach((c, i) => {
            if (c.label) { doc.setFillColor(...NAVY); doc.rect(x, y, c.w, h, 'F'); }
            doc.setDrawColor(...LINE); doc.setLineWidth(0.2); doc.rect(x, y, c.w, h);
            doc.setFont('helvetica', c.label ? 'bold' : 'normal');
            doc.setFontSize(c.size || 7.5);
            doc.setTextColor(...(c.label ? [255, 255, 255] as [number, number, number] : DARK));
            const tx = c.align === 'center' ? x + c.w / 2 : x + pad;
            doc.text(wrapped[i], tx, y + pad + 2.7, { align: c.align || 'left' });
            x += c.w;
        });
        y += h;
    };
    // Single full-width banner cell (navy section header).
    const banner = (text: string) => row([{ w: CW, text, label: true, align: 'center', size: 8 }]);

    const L = 32; // standard label-cell width

    if (type === 'deliveryNote') {
        row([{ w: L, text: 'CONSIGNMENT', label: true }, { w: CW - L, text: `${lc.loadConNumber}   ${lc.collectionPoint || ''} ${lc.deliveryPoint ? '→ ' + lc.deliveryPoint : ''}` }]);
        row([{ w: L, text: 'CARRIER', label: true }, { w: CW / 2 - L, text: lc.subcontractorName || '' }, { w: L, text: 'CUST O/NO', label: true }, { w: CW / 2 - L, text: lc.customerOrderNumber || '' }]);
        row([{ w: L, text: 'DRIVER', label: true }, { w: CW / 2 - L, text: lc.subcontractorDriverName || '' }, { w: L, text: 'VEHICLE', label: true }, { w: CW / 2 - L, text: lc.subcontractorVehicleReg || '' }]);
    } else if (type === 'clientOrder') {
        row([{ w: L, text: 'INSTRUCTION FROM', label: true }, { w: CW / 2 - L, text: lc.fbnRepresentative || '' }, { w: L, text: 'FBN REF', label: true }, { w: CW / 2 - L, text: lc.loadRefNo || '' }]);
        row([{ w: L, text: 'CLIENT', label: true }, { w: CW / 2 - L, text: lc.clientName || '' }, { w: L, text: 'FOR ATT', label: true }, { w: CW / 2 - L, text: lc.clientContact || '' }]);
        row([{ w: L, text: 'CUST O/NO', label: true }, { w: CW - L, text: lc.customerOrderNumber || '' }]);
    } else {
        row([{ w: L, text: 'INSTRUCTION FROM', label: true }, { w: CW / 2 - L, text: lc.fbnRepresentative || '' }, { w: L, text: 'FBN REF', label: true }, { w: CW / 2 - L, text: lc.loadRefNo || '' }]);
        row([{ w: L, text: 'SUB-CONTRACTOR', label: true }, { w: CW / 2 - L, text: lc.subcontractorName || '' }, { w: L, text: 'FOR ATT', label: true }, { w: CW / 2 - L, text: lc.forAttention || '' }]);
        row([{ w: L, text: 'REG + DRIVER', label: true }, { w: CW / 2 - L, text: lc.subcontractorDriverName || lc.subcontractorVehicleReg || '' }, { w: L, text: 'DRIVER CELL', label: true }, { w: CW / 2 - L, text: lc.subcontractorDriverCell || '' }]);
        row([{ w: L, text: 'NOTES', label: true }, { w: CW - L, text: SUBBIE_NOTES, size: 6.3 }]);
    }

    row([{ w: L, text: 'SPECIAL INSTR.', label: true }, { w: CW - L, text: `${lc.specialInstructions ? lc.specialInstructions + '  ' : ''}${DEFAULT_SPECIAL}`, size: 7 }]);

    const c3 = (CW - 3 * L) / 3; // value width when 3 label/value pairs
    row([
        { w: L, text: 'LOADING DATE', label: true }, { w: c3, text: fmt(lc.collectionDate) },
        { w: L, text: 'LOADING TIME', label: true }, { w: c3, text: lc.loadingTime || '' },
        { w: L, text: 'CUST O/NO', label: true }, { w: c3, text: lc.customerOrderNumber || '' },
    ]);
    row([
        { w: L, text: 'OFFLOAD DATE', label: true }, { w: c3, text: fmt(lc.deliveryDate) },
        { w: L, text: 'OFFLOAD TIME', label: true }, { w: c3, text: lc.offloadingTime || '' },
        { w: L, text: 'CONTAINER NO', label: true }, { w: c3, text: lc.containerNo || '' },
    ]);
    row([
        { w: L, text: 'QUANTITY', label: true }, { w: c3, text: lc.quantity || '' },
        { w: L, text: 'LOAD TYPE', label: true }, { w: c3, text: lc.loadType || '' },
        { w: L, text: 'WEIGHT', label: true }, { w: c3, text: lc.weightKg ? `${lc.weightKg} KG` : '' },
    ]);
    row([{ w: L, text: 'COMMODITY', label: true }, { w: CW - L, text: `${lc.commodity || ''}${lc.packaging ? ' - ' + lc.packaging : ''}` }]);

    // Addresses block
    row([{ w: CW / 2, text: 'COLLECTION ADDRESS', label: true, align: 'center' }, { w: CW / 2, text: 'DELIVERY ADDRESS', label: true, align: 'center' }]);
    row([{ w: CW / 2, text: lc.collectionPoint || '' }, { w: CW / 2, text: lc.deliveryPoint || '' }]);
    row([
        { w: L, text: 'CONTACT', label: true }, { w: CW / 2 - L, text: `${lc.collectionContact || ''}${lc.collectionTelephone ? ' / ' + lc.collectionTelephone : ''}` },
        { w: L, text: 'CONTACT', label: true }, { w: CW / 2 - L, text: `${lc.deliveryContact || ''}${lc.deliveryTelephone ? ' / ' + lc.deliveryTelephone : ''}` },
    ]);

    if (lc.equipmentRequired?.length) {
        row([{ w: L, text: 'EQUIPMENT', label: true }, { w: CW - L, text: lc.equipmentRequired.join(', ') }]);
    }

    // Rate band — only the side allowed to see it
    if (type === 'loadcon') {
        row([{ w: L, text: 'AGREED RATE', label: true }, { w: CW / 2 - L, text: `${money(lc.supplierRate)}  (EXCL VAT)`, size: 9 }, { w: L, text: 'GIT/LOAD', label: true }, { w: CW / 2 - L, text: 'R 1 500 000.00' }]);
    } else if (type === 'clientOrder') {
        row([{ w: L, text: 'AGREED RATE', label: true }, { w: CW - L, text: `${money(lc.totalAmount)}  (EXCL VAT)`, size: 9 }]);
    }

    // POD signature block
    if (type === 'deliveryNote') {
        y += 2;
        banner('PROOF OF DELIVERY');
        row([{ w: CW / 2, text: 'RECEIVED IN GOOD ORDER BY', label: true }, { w: CW / 2, text: 'DATE / TIME', label: true }]);
        row([{ w: CW / 2, text: ' ' }, { w: CW / 2, text: ' ' }]); // signature space
        row([{ w: CW / 2, text: 'NAME & SIGNATURE', label: true }, { w: CW / 2, text: 'SHORTAGES / DAMAGES / REMARKS', label: true }]);
        row([{ w: CW / 2, text: ' ' }, { w: CW / 2, text: ' ' }]);
    }

    // Footer
    if (y > 280) { doc.addPage(); y = 16; }
    y = Math.max(y + 4, 288);
    doc.setDrawColor(...LINE); doc.setLineWidth(0.2); doc.line(M, y - 3, W - M, y - 3);
    doc.setTextColor(150, 160, 170); doc.setFont('helvetica', 'normal'); doc.setFontSize(6.8);
    const foot = type === 'loadcon'
        ? 'Subcontractor Terms & Conditions apply.  FBN Transport  |  Commercial Freight Specialists  |  tracking@fbn-transport.co.za'
        : 'FBN Transport  |  Commercial Freight Specialists  |  tracking@fbn-transport.co.za';
    doc.text(foot, W / 2, y, { align: 'center' });

    const base64 = (doc.output('datauristring') as string).split(',')[1] || '';
    return { doc, base64, filename: `${title.replace(/[^A-Za-z0-9]+/g, '_')}_${lc.loadConNumber}.pdf` };
};
