import { Vehicle, ChecklistTemplate, VehicleChecklistType } from '../types';

// Classify a fleet vehicle into its checklist type. Mapping confirmed with Marc
// (2026-06-28) against the real fleet weight_category values + naming:
//  - Trailer  = Superlink Trailer / Triaxle* / Skeleton*  (T-/TD-/TJ-)
//  - Forklift = FORKLIFT  (FL-*)
//  - Loadmaster = HORSE category AND name LM-*  (Horse checklist + crane section)
//  - Horse    = HORSE category  (FD-/FJ-)
//  - Rigid    = RIGID* or "… TONNER"  (rigid trucks)
//  - Light    = bakkies / Hilux / Ranger / Triton / Toyota (MV-*) — existing Light Duty checklist
export const vehicleType = (v: Partial<Vehicle> | any): VehicleChecklistType => {
    const cat = String(v?.weightCategory || (v as any)?.weight_category || '').trim().toUpperCase();
    const name = String(v?.name || '').trim().toUpperCase();
    if (/SUPERLINK|TRIAXLE|TRI-AXLE|SKELETON|TRAILER/.test(cat)) return 'Trailer';
    if (/FORKLIFT/.test(cat)) return 'Forklift';
    if (cat === 'HORSE') return name.startsWith('LM') ? 'Loadmaster' : 'Horse';
    if (/^RIGID/.test(cat) || /TONNER/.test(cat)) return 'Rigid';
    return 'Light';
};

export const isLoadmaster = (v: Partial<Vehicle> | any): boolean => vehicleType(v) === 'Loadmaster';

// Pick the checklist template for a vehicle from the loaded templates (matches on
// vehicle_types; Loadmaster uses the Horse template, whose loadmasterOnly items show).
export const templateForVehicle = (v: Partial<Vehicle> | any, templates: ChecklistTemplate[]): ChecklistTemplate | undefined => {
    const t = vehicleType(v);
    const active = (templates || []).filter(tpl => tpl.isActive !== false);
    return active.find(tpl => (tpl.vehicleTypes || []).includes(t));
};

// Items to show for a vehicle: a non-Loadmaster horse hides the loadmasterOnly crane
// section; cross-border-only items show only for cross-border-capable vehicles.
export const itemsForVehicle = (template: ChecklistTemplate, v: Partial<Vehicle> | any): ChecklistTemplate['items'] => {
    const lm = isLoadmaster(v);
    const crossBorder = !!(v as any)?.crossBorder || !!(v as any)?.cross_border;
    return (template.items || []).filter(it => (lm || !it.loadmasterOnly) && (crossBorder || !it.crossBorder));
};
