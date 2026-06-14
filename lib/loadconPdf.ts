import { jsPDF } from 'jspdf';
import { LoadConfirmation } from '../types';

export type DocType = 'loadcon' | 'clientOrder' | 'deliveryNote';

const NAVY: [number, number, number] = [19, 41, 75];
const YELLOW: [number, number, number] = [245, 183, 0];
const GREY: [number, number, number] = [91, 101, 115];
const LINE: [number, number, number] = [215, 221, 227];

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

// Builds a clean, branded A4 LoadCon / Client Order / Delivery Note PDF.
export const buildLoadConPdf = async (lc: LoadConfirmation, type: DocType): Promise<{ doc: jsPDF; base64: string; filename: string }> => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = 210, M = 14;
    let y = 14;
    const title = type === 'loadcon' ? 'LOAD CONFIRMATION' : type === 'clientOrder' ? 'CLIENT ORDER' : 'DELIVERY NOTE / POD';
    const ref = lc.loadConNumber + (type === 'clientOrder' ? '-C' : type === 'deliveryNote' ? '-DN' : '');

    const logo = await logoDataUrl();
    if (logo) { try { doc.addImage(logo, 'JPEG', M, y, 55, 16); } catch { /* ignore */ } }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(...GREY);
    doc.text('COMMERCIAL FREIGHT SPECIALISTS', M, y + 21);

    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(...NAVY);
    doc.text(title, W - M, y + 6, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...GREY);
    doc.text(`Ref: ${ref}`, W - M, y + 12, { align: 'right' });
    doc.text(`Date: ${fmt(lc.date) || fmt(new Date().toISOString())}`, W - M, y + 16, { align: 'right' });
    y += 25;
    doc.setDrawColor(...NAVY); doc.setLineWidth(0.8); doc.line(M, y, W - M, y);
    doc.setFillColor(...YELLOW); doc.rect(M, y + 0.7, W - 2 * M, 1.3, 'F');
    y += 7;

    const section = (heading: string, rows: [string, string | undefined][]) => {
        const visible = rows.filter(r => r[1]);
        if (y > 250) { doc.addPage(); y = 16; }
        doc.setFillColor(...NAVY); doc.rect(M, y, W - 2 * M, 7, 'F');
        doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
        doc.text(heading.toUpperCase(), M + 3, y + 4.8);
        y += 10;
        doc.setFontSize(9.5);
        visible.forEach(([l, v]) => {
            doc.setTextColor(...GREY); doc.setFont('helvetica', 'bold'); doc.text(l, M + 1, y);
            doc.setTextColor(31, 41, 55); doc.setFont('helvetica', 'normal');
            const lines = doc.splitTextToSize(String(v), W - 2 * M - 44);
            doc.text(lines, M + 42, y);
            y += 5 * lines.length;
        });
        y += 4;
    };

    if (type === 'loadcon') section('To Subcontractor', [['Company', lc.subcontractorName], ['For Attention', lc.forAttention], ['Email', lc.subcontractorEmail], ['Driver', lc.subcontractorDriverName], ['Driver Cell', lc.subcontractorDriverCell], ['Vehicle Reg', lc.subcontractorVehicleReg]]);
    else if (type === 'clientOrder') section('Client', [['Company', lc.clientName], ['For Attention', lc.clientContact], ['Email', lc.clientEmail], ['Customer Order #', lc.customerOrderNumber]]);
    else section('Consignment', [['Load Ref', ref], ['Customer Order #', lc.customerOrderNumber], ['Carrier', lc.subcontractorName], ['Driver', lc.subcontractorDriverName]]);

    section('Route', [['FBN Branch', lc.arrangingBranch], ['FBN Rep', lc.fbnRepresentative], ['Route', lc.route], ['Priority', lc.priority]]);
    section('Collection', [['Address', lc.collectionPoint], ['Date', fmt(lc.collectionDate)], ['Time', lc.loadingTime], ['Contact', lc.collectionContact], ['Tel', lc.collectionTelephone]]);
    section('Delivery', [['Address', lc.deliveryPoint], ['Date', fmt(lc.deliveryDate)], ['Time', lc.offloadingTime], ['Contact', lc.deliveryContact], ['Tel', lc.deliveryTelephone]]);

    const cargo: [string, string | undefined][] = [['Load Type', lc.loadType], ['Commodity', lc.commodity], ['Packaging', lc.packaging], ['Quantity', lc.quantity], ['Weight (kg)', lc.weightKg], ['Volume', lc.volume], ['Container #', lc.containerNo]];
    if (type !== 'deliveryNote') cargo.push(['Cargo Value', lc.cargoValue]);
    if (lc.equipmentRequired?.length) cargo.push(['Equipment', lc.equipmentRequired.join(', ')]);
    if (lc.specialInstructions) cargo.push(['Instructions', lc.specialInstructions]);
    section('Cargo', cargo);

    if (type === 'loadcon' || type === 'clientOrder') {
        if (y > 255) { doc.addPage(); y = 16; }
        const amt = type === 'loadcon' ? lc.supplierRate : lc.totalAmount;
        const bw = 84, bx = W - M - bw, bh = 16;
        doc.setFillColor(...NAVY); doc.rect(bx, y, bw, bh, 'F');
        doc.setTextColor(...YELLOW); doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
        doc.text(type === 'loadcon' ? 'AGREED TRANSPORT RATE (EXCL. VAT)' : 'AGREED RATE (EXCL. VAT)', bx + bw - 3, y + 5, { align: 'right' });
        doc.setTextColor(255, 255, 255); doc.setFontSize(15);
        doc.text(money(amt), bx + bw - 3, y + 12.5, { align: 'right' });
        y += bh + 6;
    }

    if (type === 'deliveryNote') {
        y += 4;
        doc.setDrawColor(...NAVY); doc.setLineWidth(0.3);
        doc.setTextColor(...GREY); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
        doc.text('Received in good order by (name & signature):', M, y); doc.line(M, y + 14, M + 82, y + 14);
        doc.text('Date / Time:', W / 2 + 12, y); doc.line(W / 2 + 12, y + 14, W - M, y + 14);
        y += 24;
        doc.text('Shortages / damages / remarks:', M, y); doc.rect(M, y + 2, W - 2 * M, 20); y += 28;
    }

    doc.setDrawColor(...LINE); doc.setLineWidth(0.2); doc.line(M, 286, W - M, 286);
    doc.setTextColor(150, 160, 170); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
    doc.text('FBN Transport  |  Commercial Freight Specialists  |  tracking@fbn-transport.co.za', W / 2, 291, { align: 'center' });

    const base64 = (doc.output('datauristring') as string).split(',')[1] || '';
    return { doc, base64, filename: `${title.replace(/[^A-Za-z0-9]+/g, '_')}_${lc.loadConNumber}.pdf` };
};
