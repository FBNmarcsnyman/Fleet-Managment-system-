// Printable / emailable line-haul MANIFEST and delivery TRIP SHEET documents.
// One source of truth for both the on-screen doc modals and the auto-send on
// create. Builders take already-resolved data (no DB context) so they can run
// anywhere (UI or context).
import { LoadConfirmation, Manifest, TripSheet } from '../types';

export const opsEmailFor = (b?: string): string =>
    b === 'FBN DBN' ? 'opsdbn@fbn-transport.co.za' : b === 'FBN JHB' ? 'opsjhb@fbn-transport.co.za' : 'ops@fbn-transport.co.za';

const kg = (n: number) => Math.round(n).toLocaleString('en-ZA');
const m3 = (n: number) => n ? n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
export const pkgsOf = (l: LoadConfirmation): number => Number(l.loadedPackages) || (l.quantity && !isNaN(parseInt(l.quantity)) ? parseInt(l.quantity) : 0) || (Array.isArray(l.items) ? l.items.reduce((s: number, i: any) => s + (Number(i.quantity) || 0), 0) : 0);
const cubesOf = (l: LoadConfirmation): number => Number(l.cubeM3) || 0;

// Normalise an SA cell to E.164 for WhatsApp (0XX… → +27XX…).
export const waNum = (cell?: string): string => {
    if (!cell) return '';
    let d = String(cell).replace(/[^\d+]/g, '');
    if (d.startsWith('+')) return d;
    if (d.startsWith('0')) return '+27' + d.slice(1);
    if (d.startsWith('27')) return '+' + d;
    return d;
};

const HEAD = (subtitle: string, number: string, date: string) => `
  <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #f5b700;padding-bottom:8px;margin-bottom:14px">
    <div><div style="font-size:20px;font-weight:800;color:#13294b">FBN TRANSPORT</div><div style="font-size:11px;color:#5b6573;letter-spacing:2px">${subtitle}</div></div>
    <div style="text-align:right"><div style="font-size:18px;font-weight:800;color:#13294b">${number}</div><div style="font-size:12px;color:#5b6573">${date || ''}</div></div>
  </div>`;

type ManifestDocData = { manifest: Manifest; loads: LoadConfirmation[]; vehicleLabel: string; driverName: string; clientNameOf: (l: LoadConfirmation) => string };

// LINE-HAUL MANIFEST — what's on the trailer for the receiving depot: per
// shipment client / deliver-to / pkgs / weight / cubes, with totals + trailer.
export const manifestHtml = ({ manifest: m, loads, vehicleLabel, driverName, clientNameOf }: ManifestDocData): string => {
    const tot = loads.reduce((t, l) => ({ pkgs: t.pkgs + pkgsOf(l), kg: t.kg + (Number(l.weightKg) || 0), cube: t.cube + cubesOf(l) }), { pkgs: 0, kg: 0, cube: 0 });
    const td = 'border:1px solid #cbd5e1;padding:5px 8px';
    const isSuper = m.trailerSize === '6m + 12m';
    const split = (m as any).trailerSplit || {};
    const trailerOf = (l: LoadConfirmation): string => isSuper ? (split[l.id] || '12m') : (m.trailerSize || '');
    // Per-trailer kg subtotals (superlink shows each leg).
    const legKg: Record<string, number> = {};
    loads.forEach(l => { const t = trailerOf(l); legKg[t] = (legKg[t] || 0) + (Number(l.weightKg) || 0); });
    const rows = loads.map(l => `<tr>
        <td style="${td};font-family:monospace">${l.loadConNumber}</td>
        <td style="${td}">${clientNameOf(l)}</td>
        <td style="${td}">${l.deliveryPoint || ''}</td>
        ${isSuper ? `<td style="${td};text-align:center;font-weight:700">${trailerOf(l)}</td>` : ''}
        <td style="${td};text-align:right">${pkgsOf(l) || ''}</td>
        <td style="${td};text-align:right">${l.weightKg ? kg(Number(l.weightKg)) : ''}</td>
        <td style="${td};text-align:right">${m3(cubesOf(l))}</td>
      </tr>`).join('');
    const trailerLine = isSuper
        ? `6m + 12m (superlink)${(m as any).trailerReg6m || (m as any).trailerReg12m ? ` — 6m: <b>${(m as any).trailerReg6m || '—'}</b> · 12m: <b>${(m as any).trailerReg12m || '—'}</b>` : ''}`
        : `${m.trailerSize || '—'}${((m as any).trailerReg6m || (m as any).trailerReg12m) ? ` — <b>${(m as any).trailerReg6m || (m as any).trailerReg12m}</b>` : ''}`;
    const colspan = isSuper ? 4 : 3;
    return `<div style="font-family:Arial,sans-serif;color:#13294b;max-width:820px">
      ${HEAD('LINE-HAUL MANIFEST', m.manifestNumber, m.dispatchDate)}
      <table style="border-collapse:collapse;margin-bottom:12px;font-size:13px">
        <tr><td style="padding:2px 14px 2px 0;font-weight:700">Route</td><td>${m.originBranch || ''} &rarr; ${m.destinationBranch || ''}</td></tr>
        <tr><td style="padding:2px 14px 2px 0;font-weight:700">Trailer</td><td>${trailerLine}</td></tr>
        <tr><td style="padding:2px 14px 2px 0;font-weight:700">Vehicle</td><td>${vehicleLabel || '—'}${(m as any).startOdometer != null ? ` · odo ${kg(Number((m as any).startOdometer))} km` : ''}</td></tr>
        <tr><td style="padding:2px 14px 2px 0;font-weight:700">Driver</td><td>${driverName || '—'}</td></tr>
        ${(m as any).totalRate != null ? (() => { const turnover = loads.reduce((s, l) => s + (Number((l as any).totalAmount) || 0), 0); const cost = Number((m as any).totalRate) || 0; const margin = turnover - cost; return `<tr><td style="padding:2px 14px 2px 0;font-weight:700">Turnover (all waybills)</td><td>R ${kg(turnover)}</td></tr><tr><td style="padding:2px 14px 2px 0;font-weight:700">Line-haul cost</td><td>R ${kg(cost)}</td></tr><tr><td style="padding:2px 14px 2px 0;font-weight:700">Margin</td><td style="color:${margin < 0 ? '#b91c1c' : '#047857'};font-weight:800">R ${kg(margin)}</td></tr>`; })() : ''}
      </table>
      <table style="border-collapse:collapse;width:100%;font-size:12px">
        <thead><tr style="background:#13294b;color:#fff">
          <th style="border:1px solid #13294b;padding:6px 8px;text-align:left">LoadCon</th>
          <th style="border:1px solid #13294b;padding:6px 8px;text-align:left">Client</th>
          <th style="border:1px solid #13294b;padding:6px 8px;text-align:left">Deliver to</th>
          ${isSuper ? '<th style="border:1px solid #13294b;padding:6px 8px;text-align:center">Trailer</th>' : ''}
          <th style="border:1px solid #13294b;padding:6px 8px;text-align:right">Pkgs</th>
          <th style="border:1px solid #13294b;padding:6px 8px;text-align:right">Kg</th>
          <th style="border:1px solid #13294b;padding:6px 8px;text-align:right">Cube m³</th>
        </tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr style="font-weight:800;background:#f1f5f9">
          <td style="${td}" colspan="${colspan}">TOTAL — ${loads.length} shipment${loads.length !== 1 ? 's' : ''}</td>
          <td style="${td};text-align:right">${tot.pkgs}</td>
          <td style="${td};text-align:right">${kg(tot.kg)}</td>
          <td style="${td};text-align:right">${m3(tot.cube)}</td>
        </tr>
        ${isSuper ? `<tr style="font-weight:700;background:#f8fafc;font-size:11px"><td style="${td}" colspan="${colspan}">Per trailer</td><td style="${td};text-align:right" colspan="3">6m: ${kg(legKg['6m'] || 0)} kg (cap 12 000) · 12m: ${kg(legKg['12m'] || 0)} kg (cap 22 000)</td></tr>` : ''}
        </tfoot>
      </table>
      <p style="font-size:11px;color:#5b6573;margin-top:16px">Received in good order at ${m.destinationBranch || 'destination'} depot — Name __________________  Signature __________________  Date ________</p>
    </div>`;
};

type TripDocData = { trip: TripSheet; loads: LoadConfirmation[]; vehicleLabel: string; driverName: string; clientNameOf: (l: LoadConfirmation) => string };

// DELIVERY TRIP SHEET (run sheet) — the driver's multi-drop list with a column
// for arrival time, delivery time and the client's signature on site (POD), plus
// odometer start/end.
export const tripSheetHtml = ({ trip: t, loads, vehicleLabel, driverName, clientNameOf }: TripDocData): string => {
    const tot = loads.reduce((a, l) => ({ pkgs: a.pkgs + pkgsOf(l), kg: a.kg + (Number(l.weightKg) || 0) }), { pkgs: 0, kg: 0 });
    const td = 'border:1px solid #cbd5e1;padding:6px 8px';
    const rows = loads.map((l, i) => `<tr>
        <td style="${td};text-align:center">${i + 1}</td>
        <td style="${td};font-family:monospace">${l.loadConNumber}</td>
        <td style="${td}">${clientNameOf(l)}</td>
        <td style="${td}">${l.deliveryPoint || ''}${l.deliveryArea ? `<br><span style="font-size:10px;color:#5b6573">${l.deliveryArea}</span>` : ''}</td>
        <td style="${td};text-align:right">${pkgsOf(l) || ''}</td>
        <td style="${td};text-align:right">${l.weightKg ? kg(Number(l.weightKg)) : ''}</td>
        <td style="${td};width:64px"></td>
        <td style="${td};width:64px"></td>
        <td style="${td};width:150px"></td>
      </tr>`).join('');
    return `<div style="font-family:Arial,sans-serif;color:#13294b;max-width:900px">
      ${HEAD('DELIVERY TRIP SHEET', t.tripSheetNumber, t.dispatchDate)}
      <table style="border-collapse:collapse;margin-bottom:12px;font-size:13px">
        <tr><td style="padding:2px 14px 2px 0;font-weight:700">Branch</td><td>${t.branch || ''}</td><td style="padding:2px 14px 2px 24px;font-weight:700">Vehicle</td><td>${vehicleLabel || '—'}</td></tr>
        <tr><td style="padding:2px 14px 2px 0;font-weight:700">Driver</td><td>${driverName || '—'}</td><td style="padding:2px 14px 2px 24px;font-weight:700">Drops</td><td>${loads.length}</td></tr>
        <tr><td style="padding:2px 14px 2px 0;font-weight:700">Odo start</td><td>${t.odometerStart != null ? t.odometerStart : '____________'} km</td><td style="padding:2px 14px 2px 24px;font-weight:700">Odo end</td><td>${t.odometerEnd != null ? t.odometerEnd : '____________'} km</td></tr>
      </table>
      <table style="border-collapse:collapse;width:100%;font-size:12px">
        <thead><tr style="background:#13294b;color:#fff">
          <th style="border:1px solid #13294b;padding:6px 8px">#</th>
          <th style="border:1px solid #13294b;padding:6px 8px;text-align:left">LoadCon</th>
          <th style="border:1px solid #13294b;padding:6px 8px;text-align:left">Client</th>
          <th style="border:1px solid #13294b;padding:6px 8px;text-align:left">Deliver to</th>
          <th style="border:1px solid #13294b;padding:6px 8px;text-align:right">Pkgs</th>
          <th style="border:1px solid #13294b;padding:6px 8px;text-align:right">Kg</th>
          <th style="border:1px solid #13294b;padding:6px 8px">Arrival</th>
          <th style="border:1px solid #13294b;padding:6px 8px">Delivered</th>
          <th style="border:1px solid #13294b;padding:6px 8px">Client name & signature</th>
        </tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr style="font-weight:800;background:#f1f5f9">
          <td style="${td}" colspan="4">TOTAL — ${loads.length} drop${loads.length !== 1 ? 's' : ''}</td>
          <td style="${td};text-align:right">${tot.pkgs}</td>
          <td style="${td};text-align:right">${kg(tot.kg)}</td>
          <td style="${td}" colspan="3"></td>
        </tr></tfoot>
      </table>
      <p style="font-size:11px;color:#5b6573;margin-top:14px">Each client signs on arrival to acknowledge receipt. Driver to record arrival &amp; delivery times per drop, and odometer start/end. Return this sheet to the depot.</p>
    </div>`;
};

// Short WhatsApp run-list for the driver's phone.
export const tripWaText = (t: TripSheet, loads: LoadConfirmation[], vehicleLabel: string, clientNameOf: (l: LoadConfirmation) => string): string => {
    const drops = loads.map((l, i) => `${i + 1}. ${clientNameOf(l)} — ${l.deliveryPoint || ''} (${pkgsOf(l) || '?'} pkgs)`).join('\n');
    return `FBN Transport — Trip ${t.tripSheetNumber}\nVehicle: ${vehicleLabel}\n${loads.length} drop${loads.length !== 1 ? 's' : ''}:\n${drops}\n\nSign each client on arrival. Reply DONE when the run is complete.`;
};
