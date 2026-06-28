
import React, { createContext, useContext, useMemo, useRef, ReactNode } from 'react';
import { RawDataContext } from './RawDataContext';
import { CommonDataContext } from './CommonDataContext';
import { JobCard, JobCardStatus, PurchaseRequest, PurchaseOrder, Part, Tire, PlannedService } from '../types';
import { supabase, runWrite } from '../lib/supabase';
import {
    toJobCardInsert, toJobCardUpdate, toPartInsert, toPurchaseRequestInsert, toTireUpdate,
    toPlannedServiceInsert, toPurchaseOrderInsert,
    mapJobCard, mapPart, mapPurchaseRequest, mapPlannedService, mapPurchaseOrder, mapChecklistTemplate, mapTireInspection, mapTire,
} from '../lib/mappers';

const FBN_ORG_ID = '00000000-0000-0000-0000-000000000001';

export const WorkshopContext = createContext<any>(undefined);

type Result<T = void> = { ok: true; value?: T } | { ok: false; error: string };

export const WorkshopDataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const raw = useContext(RawDataContext);
    const common = useContext(CommonDataContext);
    if (!raw || !common) return <>{children}</>;
    const { state, dispatch } = raw;
    const { users } = common;
    const stateRef = useRef(state);
    stateRef.current = state;

    // Tier 2: when a job card is resolved, return the vehicle to the road —
    // but only if it was a critical fault and no other open critical job
    // cards remain on that vehicle.
    const returnVehicleToRoadIfClear = async (jobCardId: string, newStatus: JobCardStatus) => {
        if (newStatus !== 'Resolved') return;
        const cards = stateRef.current.jobCards || [];
        const jc = cards.find((j: any) => j.id === jobCardId);
        if (!jc || (jc.severity !== 'Critical' && jc.priority !== 'Critical')) return;
        const otherOpenCritical = cards.some((j: any) =>
            j.id !== jobCardId && j.vehicleId === jc.vehicleId && j.status !== 'Resolved' &&
            (j.severity === 'Critical' || j.priority === 'Critical'));
        if (otherOpenCritical) return;
        const vehicle = (stateRef.current.vehicles || []).find((v: any) => v.id === jc.vehicleId);
        if (!vehicle || vehicle.status !== 'Off the road') return;
        const { error } = await supabase.from('vehicles').update({ status: 'On the road' }).eq('id', jc.vehicleId);
        if (error) console.error('[workshop] return-to-road update failed:', error);
        else dispatch({ type: 'UPDATE_VEHICLE', payload: { vehicleId: jc.vehicleId, updates: { status: 'On the road' } } });
    };

    const handlers = useMemo(() => ({
        // -- Job Cards --------------------------------------------------------
        handleCreateJobCard: async (jobCard: any): Promise<Result<JobCard>> => {
            try {
                const row = toJobCardInsert(jobCard);
                const { data, error } = await supabase
                    .from('job_cards').insert(row).select().single();
                if (error) { console.error('[workshop] createJobCard failed:', error); return { ok: false, error: error.message }; }
                const mapped = mapJobCard(data);
                dispatch({ type: 'CREATE_JOB_CARD', payload: mapped });
                return { ok: true, value: mapped };
            } catch (err) {
                console.error('[workshop] createJobCard threw:', err);
                return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
            }
        },
        handleUpdateJobCard: async (id: string, updates: Partial<JobCard>): Promise<Result<void>> => {
            try {
                const row = toJobCardUpdate(updates);
                const { error } = await supabase
                    .from('job_cards').update(row).eq('id', id);
                if (error) { console.error('[workshop] updateJobCard failed:', error); return { ok: false, error: error.message }; }
                dispatch({ type: 'UPDATE_JOB_CARD', payload: { id, updates } });
                if (updates.status) await returnVehicleToRoadIfClear(id, updates.status);
                return { ok: true };
            } catch (err) {
                console.error('[workshop] updateJobCard threw:', err);
                return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
            }
        },
        // -- Checklist review: mark a submitted inspection as Reviewed ---------
        handleUpdateChecklistSubmission: async (id: string, updates: { status?: 'Submitted' | 'Reviewed'; reviewedBy?: string }): Promise<Result<void>> => {
            try {
                const patch: Record<string, unknown> = {};
                if (updates.status) patch.status = updates.status;
                if (updates.status === 'Reviewed') { patch.reviewed_by_id = updates.reviewedBy || null; patch.reviewed_at = new Date().toISOString(); }
                const { error } = await runWrite(() => supabase.from('checklist_submissions').update(patch as any).eq('id', id));
                if (error) { console.error('[workshop] updateChecklistSubmission failed:', error); return { ok: false, error: error.message }; }
                dispatch({ type: 'UPDATE_CHECKLIST_SUBMISSION', payload: { id, updates: { ...updates, reviewedAt: patch.reviewed_at as string | undefined } } });
                return { ok: true };
            } catch (err) {
                console.error('[workshop] updateChecklistSubmission threw:', err);
                return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
            }
        },
        handleUpdateJobCardStatus: async (id: string, status: JobCardStatus): Promise<Result<void>> => {
            try {
                const { error } = await supabase
                    .from('job_cards').update({ status }).eq('id', id);
                if (error) { console.error('[workshop] updateJobCardStatus failed:', error); return { ok: false, error: error.message }; }
                dispatch({ type: 'UPDATE_JOB_CARD_STATUS', payload: { id, status } });
                await returnVehicleToRoadIfClear(id, status);
                return { ok: true };
            } catch (err) {
                console.error('[workshop] updateJobCardStatus threw:', err);
                return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
            }
        },

        // -- Parts ------------------------------------------------------------
        handleAddPart: async (part: Omit<Part, 'id'>): Promise<Result<Part>> => {
            try {
                const row = toPartInsert(part);
                const { data, error } = await supabase
                    .from('parts').insert(row).select().single();
                if (error) { console.error('[workshop] addPart failed:', error); return { ok: false, error: error.message }; }
                const mapped = mapPart(data);
                dispatch({ type: 'ADD_PART', payload: mapped });
                return { ok: true, value: mapped };
            } catch (err) {
                console.error('[workshop] addPart threw:', err);
                return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
            }
        },

        // -- Purchase Requests -----------------------------------------------
        handleCreatePurchaseRequest: async (request: any, userId: string): Promise<Result<PurchaseRequest>> => {
            try {
                const withUser = { ...request, requestedByUserId: userId };
                const row = toPurchaseRequestInsert(withUser);
                const { data, error } = await supabase
                    .from('purchase_requests').insert(row).select().single();
                if (error) { console.error('[workshop] createPurchaseRequest failed:', error); return { ok: false, error: error.message }; }
                const mapped = mapPurchaseRequest(data);
                dispatch({ type: 'CREATE_PURCHASE_REQUEST', payload: mapped });
                return { ok: true, value: mapped };
            } catch (err) {
                console.error('[workshop] createPurchaseRequest threw:', err);
                return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
            }
        },

        // -- Purchase authorisation + part assignment (Part 8) ----------------
        handleSetPurchaseRequestStatus: async (id: string, status: PurchaseRequest['status']): Promise<Result<void>> => {
            try {
                const { error } = await runWrite(() => supabase.from('purchase_requests').update({ status }).eq('id', id));
                if (error) { console.error('[workshop] setPurchaseRequestStatus failed:', error); return { ok: false, error: error.message }; }
                dispatch({ type: 'UPDATE_PURCHASE_REQUEST', payload: { id, updates: { status } } });
                return { ok: true };
            } catch (err) { return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }; }
        },
        // Issue a part out of stock to a vehicle (and optionally onto a job card).
        handleAssignPartFromInventory: async (vehicleId: string, partId: string, quantity: number, jobCardId?: string): Promise<Result<void>> => {
            try {
                const cur = stateRef.current;
                const part = (cur.parts || []).find((p: any) => p.id === partId);
                if (!part) return { ok: false, error: 'Part not found.' };
                if ((part.quantityInStock || 0) < quantity) return { ok: false, error: 'Not enough stock.' };
                const newQty = (part.quantityInStock || 0) - quantity;
                const { error } = await runWrite(() => supabase.from('parts').update({ quantity_in_stock: newQty }).eq('id', partId));
                if (error) { console.error('[workshop] assignPart stock update failed:', error); return { ok: false, error: error.message }; }
                dispatch({ type: 'UPDATE_PART', payload: { id: partId, updates: { quantityInStock: newQty } } });
                if (jobCardId) {
                    const jc = (cur.jobCards || []).find((j: any) => j.id === jobCardId);
                    if (jc) {
                        const partsUsed = [...(jc.partsUsed || []), { partId, quantity, unitCost: part.cost || 0 }];
                        const { error: jErr } = await supabase.from('job_cards').update({ parts_used: partsUsed as any }).eq('id', jobCardId);
                        if (jErr) console.error('[workshop] assignPart job card update failed:', jErr);
                        else dispatch({ type: 'UPDATE_JOB_CARD', payload: { id: jobCardId, updates: { partsUsed } } });
                    }
                }
                return { ok: true };
            } catch (err) { return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }; }
        },
        handleAssignPartToJob: async (jobCardId: string, partId: string, quantity: number): Promise<Result<void>> => {
            const jc = (stateRef.current.jobCards || []).find((j: any) => j.id === jobCardId);
            return (handlers as any).handleAssignPartFromInventory(jc?.vehicleId || '', partId, quantity, jobCardId);
        },

        // -- Tires ------------------------------------------------------------
        handleUpdateTire: async (tire: Tire): Promise<Result<Tire>> => {
            try {
                const row = toTireUpdate(tire);
                const { error } = await supabase
                    .from('tires').update(row).eq('id', tire.id);
                if (error) { console.error('[workshop] updateTire failed:', error); return { ok: false, error: error.message }; }
                dispatch({ type: 'UPDATE_TIRE', payload: tire });
                return { ok: true, value: tire };
            } catch (err) {
                console.error('[workshop] updateTire threw:', err);
                return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
            }
        },

        // -- Tyre lifecycle operations (Part 11) ------------------------------
        handleAddTire: async (tire: { serialNumber: string; brand: string; size: string; type: 'New' | 'Retread'; purchaseDate: string; purchasePrice: number; retreadDetails?: any }): Promise<Result<void>> => {
            try {
                const row = { organization_id: FBN_ORG_ID, serial_number: tire.serialNumber, brand: tire.brand, size: tire.size, type: tire.type, purchase_date: tire.purchaseDate, purchase_price: tire.purchasePrice, status: 'In Storage', retread_details: tire.retreadDetails ?? null };
                const { data, error } = await runWrite(() => supabase.from('tires').insert(row as any).select().single());
                if (error || !data) { console.error('[workshop] addTire failed:', error); return { ok: false, error: error?.message || 'Could not add tyre.' }; }
                dispatch({ type: 'ADD_TIRE', payload: mapTire(data, new Map()) });
                return { ok: true };
            } catch (err) { return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }; }
        },
        handleMountTire: async (tireId: string, vehicleId: string, position: string, odometer: number): Promise<Result<void>> => {
            try {
                const tire = (stateRef.current.tires || []).find((t: any) => t.id === tireId);
                if (!tire) return { ok: false, error: 'Tire not found.' };
                const today = new Date().toISOString().slice(0, 10);
                const { error: hErr } = await runWrite(() => supabase.from('tire_mount_history').insert({ tire_id: tireId, vehicle_id: vehicleId, position, mounted_date: today, mounted_odometer: odometer } as any));
                if (hErr) { console.error('[workshop] mountTire history failed:', hErr); return { ok: false, error: hErr.message }; }
                const { error } = await supabase.from('tires').update({ status: 'Mounted', assigned_vehicle_id: vehicleId, assigned_position: position }).eq('id', tireId);
                if (error) { console.error('[workshop] mountTire failed:', error); return { ok: false, error: error.message }; }
                dispatch({ type: 'UPDATE_TIRE', payload: { ...tire, status: 'Mounted', assignedVehicleId: vehicleId, assignedPosition: position, mountHistory: [...(tire.mountHistory || []), { vehicleId, position, mountedDate: today, mountedOdometer: odometer }] } });
                return { ok: true };
            } catch (err) { return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }; }
        },
        handleDismountTire: async (tireId: string, odometer: number): Promise<Result<void>> => {
            try {
                const tire = (stateRef.current.tires || []).find((t: any) => t.id === tireId);
                if (!tire) return { ok: false, error: 'Tire not found.' };
                const today = new Date().toISOString().slice(0, 10);
                await supabase.from('tire_mount_history').update({ removed_date: today, removed_odometer: odometer }).eq('tire_id', tireId).is('removed_date', null);
                const { error } = await supabase.from('tires').update({ status: 'In Storage', assigned_vehicle_id: null, assigned_position: null }).eq('id', tireId);
                if (error) { console.error('[workshop] dismountTire failed:', error); return { ok: false, error: error.message }; }
                const mh = [...(tire.mountHistory || [])];
                for (let i = mh.length - 1; i >= 0; i--) { if (!mh[i].removedDate) { mh[i] = { ...mh[i], removedDate: today, removedOdometer: odometer }; break; } }
                dispatch({ type: 'UPDATE_TIRE', payload: { ...tire, status: 'In Storage', assignedVehicleId: undefined, assignedPosition: undefined, mountHistory: mh } });
                return { ok: true };
            } catch (err) { return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }; }
        },
        handleScrapTire: async (tireId: string, reason: string, _costToRecover: number): Promise<Result<void>> => {
            try {
                const tire = (stateRef.current.tires || []).find((t: any) => t.id === tireId);
                if (!tire) return { ok: false, error: 'Tire not found.' };
                const retread = { ...(tire.retreadDetails || {}), scrapReason: reason, scrapDate: new Date().toISOString().slice(0, 10) };
                const { error } = await runWrite(() => supabase.from('tires').update({ status: 'Scrapped', retread_details: retread as any }).eq('id', tireId));
                if (error) { console.error('[workshop] scrapTire failed:', error); return { ok: false, error: error.message }; }
                dispatch({ type: 'UPDATE_TIRE', payload: { ...tire, status: 'Scrapped', retreadDetails: retread } });
                return { ok: true };
            } catch (err) { return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }; }
        },
        handleSendForRetread: async (tireId: string, vendor: string, expectedReturn: string): Promise<Result<void>> => {
            try {
                const tire = (stateRef.current.tires || []).find((t: any) => t.id === tireId);
                if (!tire) return { ok: false, error: 'Tire not found.' };
                const retread = { vendor, expectedReturnDate: expectedReturn, sentDate: new Date().toISOString().slice(0, 10) };
                const { error } = await runWrite(() => supabase.from('tires').update({ status: 'Out for Retread', retread_details: retread as any }).eq('id', tireId));
                if (error) { console.error('[workshop] sendForRetread failed:', error); return { ok: false, error: error.message }; }
                dispatch({ type: 'UPDATE_TIRE', payload: { ...tire, status: 'Out for Retread', retreadDetails: retread } });
                return { ok: true };
            } catch (err) { return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }; }
        },
        handleReceiveRetread: async (tireId: string): Promise<Result<void>> => {
            try {
                const tire = (stateRef.current.tires || []).find((t: any) => t.id === tireId);
                if (!tire) return { ok: false, error: 'Tire not found.' };
                const retread = { ...(tire.retreadDetails || {}), receivedDate: new Date().toISOString().slice(0, 10) };
                const { error } = await runWrite(() => supabase.from('tires').update({ status: 'In Storage', type: 'Retread', retread_details: retread as any }).eq('id', tireId));
                if (error) { console.error('[workshop] receiveRetread failed:', error); return { ok: false, error: error.message }; }
                dispatch({ type: 'UPDATE_TIRE', payload: { ...tire, status: 'In Storage', type: 'Retread', retreadDetails: retread } });
                return { ok: true };
            } catch (err) { return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }; }
        },
        handleAddTireInspection: async (tireId: string, inspection: { date: string; vehicleOdometer: number; treadDepth: number; pressure: number; notes?: string }): Promise<Result<void>> => {
            try {
                const row = { organization_id: FBN_ORG_ID, tire_id: tireId, date: inspection.date, vehicle_odometer: inspection.vehicleOdometer, tread_depth_mm: inspection.treadDepth, pressure_psi: inspection.pressure, notes: inspection.notes || null };
                const { data, error } = await runWrite(() => supabase.from('tire_inspections').insert(row as any).select().single());
                if (error || !data) { console.error('[workshop] addTireInspection failed:', error); return { ok: false, error: error?.message || 'Could not save inspection.' }; }
                dispatch({ type: 'ADD_TIRE_INSPECTION', payload: mapTireInspection(data) });
                return { ok: true };
            } catch (err) { return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }; }
        },

        // -- Planned Services -------------------------------------------------
        handleAddPlannedService: async (service: Omit<PlannedService, 'id'>): Promise<Result<PlannedService>> => {
            try {
                const row = toPlannedServiceInsert(service);
                const { data, error } = await supabase
                    .from('planned_services').insert(row).select().single();
                if (error) { console.error('[workshop] addPlannedService failed:', error); return { ok: false, error: error.message }; }
                const mapped = mapPlannedService(data);
                dispatch({ type: 'ADD_PLANNED_SERVICE', payload: mapped });
                return { ok: true, value: mapped };
            } catch (err) {
                console.error('[workshop] addPlannedService threw:', err);
                return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
            }
        },
        handleDeletePlannedService: async (id: string): Promise<Result<void>> => {
            try {
                const { error } = await supabase.from('planned_services').delete().eq('id', id);
                if (error) { console.error('[workshop] deletePlannedService failed:', error); return { ok: false, error: error.message }; }
                dispatch({ type: 'DELETE_PLANNED_SERVICE', payload: id });
                return { ok: true };
            } catch (err) {
                console.error('[workshop] deletePlannedService threw:', err);
                return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
            }
        },

        // Procurement: create a PO from an approved request, and receive goods
        // (both persist to Supabase, mirroring the parts-stock cascade).
        handleCreatePurchaseOrder: async (req: PurchaseRequest): Promise<Result<void>> => {
            try {
                const cur = stateRef.current;
                const part = (cur.parts || []).find((p: any) => p.id === req.partId);
                const quote = req.quotes?.[0];
                const unitCost = quote ? quote.amount / req.quantity : (part?.cost || 0);
                const totalCost = quote ? quote.amount : unitCost * req.quantity;
                const supplierId = quote?.supplierId || part?.supplierId || (cur.suppliers || []).find((s: any) => s.type === 'Workshop')?.id || '';
                const poInput: Omit<PurchaseOrder, 'id'> = {
                    poNumber: `PO-${Date.now().toString().slice(-6)}`,
                    purchaseRequestId: req.id,
                    supplierId,
                    orderDate: new Date().toISOString(),
                    items: [{ partId: req.partId, quantity: req.quantity, unitCost }],
                    totalCost,
                    status: 'Ordered',
                };
                const { data, error } = await runWrite(() => supabase.from('purchase_orders').insert(toPurchaseOrderInsert(poInput)).select().single());
                if (error || !data) { console.error('[workshop] createPurchaseOrder failed:', error); return { ok: false, error: error?.message || 'Could not create the purchase order.' }; }
                const { error: rErr } = await supabase.from('purchase_requests').update({ status: 'Ordered' }).eq('id', req.id);
                if (rErr) console.error('[workshop] purchase request status update failed:', rErr);
                dispatch({ type: 'CREATE_PURCHASE_ORDER', payload: { persisted: mapPurchaseOrder(data) } });
                return { ok: true };
            } catch (err) { return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }; }
        },
        handleReceiveGoods: async (order: PurchaseOrder): Promise<Result<void>> => {
            try {
                const { error } = await runWrite(() => supabase.from('purchase_orders').update({ status: 'Received' }).eq('id', order.id).select().single());
                if (error) { console.error('[workshop] receiveGoods failed:', error); return { ok: false, error: error.message }; }
                const cur = stateRef.current;
                for (const item of (order.items || [])) {
                    const part = (cur.parts || []).find((p: any) => p.id === item.partId);
                    if (part) {
                        const { error: pErr } = await supabase.from('parts').update({ quantity_in_stock: (part.quantityInStock || 0) + item.quantity }).eq('id', item.partId);
                        if (pErr) console.error('[workshop] part stock update failed:', pErr);
                    }
                }
                dispatch({ type: 'RECEIVE_GOODS', payload: order });
                return { ok: true };
            } catch (err) { return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }; }
        },
        // -- Checklist Templates ---------------------------------------------
        handleAddChecklistTemplate: async (template: { name: string; items: any[]; vehicleTypes?: string[] }): Promise<Result<void>> => {
            try {
                const row = { organization_id: FBN_ORG_ID, name: template.name, items: template.items as any, vehicle_types: template.vehicleTypes ?? [], is_active: true };
                const { data, error } = await runWrite(() => supabase.from('checklist_templates').insert(row as any).select().single());
                if (error || !data) { console.error('[workshop] addChecklistTemplate failed:', error); return { ok: false, error: error?.message || 'Could not save template.' }; }
                dispatch({ type: 'ADD_CHECKLIST_TEMPLATE', payload: mapChecklistTemplate(data) });
                return { ok: true };
            } catch (err) { return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }; }
        },
        handleUpdateChecklistTemplate: async (template: { id: string; name: string; items: any[]; vehicleTypes?: string[] }): Promise<Result<void>> => {
            try {
                const patch: any = { name: template.name, items: template.items as any };
                if (template.vehicleTypes !== undefined) patch.vehicle_types = template.vehicleTypes;
                const { data, error } = await runWrite(() => supabase.from('checklist_templates').update(patch as any).eq('id', template.id).select().single());
                if (error || !data) { console.error('[workshop] updateChecklistTemplate failed:', error); return { ok: false, error: error?.message || 'Could not update template.' }; }
                dispatch({ type: 'UPDATE_CHECKLIST_TEMPLATE', payload: mapChecklistTemplate(data) });
                return { ok: true };
            } catch (err) { return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }; }
        },
        handleDeleteChecklistTemplate: async (id: string): Promise<Result<void>> => {
            try {
                const { error } = await runWrite(() => supabase.from('checklist_templates').delete().eq('id', id));
                if (error) { console.error('[workshop] deleteChecklistTemplate failed:', error); return { ok: false, error: error.message }; }
                dispatch({ type: 'DELETE_CHECKLIST_TEMPLATE', payload: id });
                return { ok: true };
            } catch (err) { return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }; }
        },

        // AI triage suggestions stay local-only (applied per job card via the
        // workshop board, which persists individually).
        applyAiAssignments: (suggestions: Partial<JobCard>[]) => dispatch({ type: 'APPLY_AI_ASSIGNMENTS', payload: suggestions }),
    }), [dispatch]);

    const value = useMemo(() => ({ ...state, ...handlers, users }), [state, handlers, users]);
    return <WorkshopContext.Provider value={value}>{children}</WorkshopContext.Provider>;
};

export const useWorkshop = () => useContext(WorkshopContext);
