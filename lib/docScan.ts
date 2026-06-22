import { GoogleGenAI, Type } from '@google/genai';

// Shared document-extraction helper. Reuses the same Gemini pattern the app
// already uses for licence-disk / POD scanning: send an image or PDF plus a
// prompt, get structured JSON back against a schema. Used to pull fields off a
// container arrival notification or a depot groupage manifest so staff don't
// retype them.

const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(new Error('Could not read the file.'));
    r.readAsDataURL(file);
});

export async function extractFromDocument(file: File, prompt: string, schema: any): Promise<any> {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error('Document scanning is not available — no AI key configured.');
    const data = await fileToBase64(file);
    const mimeType = file.type || 'application/octet-stream';
    const ai = new GoogleGenAI({ apiKey });
    const res = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [{ inlineData: { mimeType, data } }, { text: prompt }] },
        config: { responseMimeType: 'application/json', responseSchema: schema },
    });
    const text = res.text ? res.text.trim() : '{}';
    try { return JSON.parse(text); }
    catch { throw new Error('The document could not be read clearly. Try a sharper scan or enter it manually.'); }
}

// ---- SA motor-vehicle licence disc (read the expiry date off the scan) ----
export const LICENCE_DISC_PROMPT =
    'This is a South African motor-vehicle licence document (licence disc / registration certificate). ' +
    'Extract the vehicle registration number and the licence EXPIRY date — labelled "Date of expiry" / "Vervaldatum" (NOT the receipt or payment date). ' +
    'Return the expiry as YYYY-MM-DD. Use empty strings for anything not present.';

export const LICENCE_DISC_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        registration: { type: Type.STRING, description: 'Vehicle registration / licence number' },
        expiry_date: { type: Type.STRING, description: 'Licence expiry date (Date of expiry / Vervaldatum), YYYY-MM-DD' },
    },
    required: ['expiry_date'],
};

// Build a File from a base64 string (e.g. a Drive doc fetched via drive-fetch)
// so it can be passed to extractFromDocument.
export function base64ToFile(base64: string, name: string, mimeType: string): File {
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new File([bytes], name || 'document', { type: mimeType || 'application/octet-stream' });
}

// ---- Container arrival notification / bill of lading ----
export const CONTAINER_DOC_PROMPT =
    'This is a shipping document (arrival notification, bill of lading, or container release). ' +
    'Extract the container details. Use empty strings for anything not present. Dates as YYYY-MM-DD.';

export const CONTAINER_DOC_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        container_no: { type: Type.STRING, description: 'Container number, e.g. ABCU1234567' },
        seal_no: { type: Type.STRING, description: 'Seal number' },
        size: { type: Type.STRING, description: 'Container size/type e.g. 20FT, 40FT, REEFER 40FT' },
        weight: { type: Type.STRING, description: 'Gross/cargo weight in kg, digits only' },
        commodity: { type: Type.STRING, description: 'Goods / commodity description' },
        client_name: { type: Type.STRING, description: 'Consignee / customer name' },
        client_ref: { type: Type.STRING, description: 'Customer or booking reference' },
        vessel_name: { type: Type.STRING, description: 'Vessel / ship name' },
        shipping_line: { type: Type.STRING, description: 'Shipping line / carrier' },
        eta_port: { type: Type.STRING, description: 'ETA to port, YYYY-MM-DD' },
    },
    required: ['container_no'],
};

// ---- Cartage advice / delivery order (the road-transport instruction) ----
// One job: collect from A, deliver to B. Works for FCL (collect from a port
// terminal) and LCL (collect from an unpack depot like ZACPAK).
export const CARTAGE_DOC_PROMPT =
    'This is a road cartage advice / delivery order instructing a trucking company to collect and deliver goods. ' +
    'Extract the job. collect_from = the full PICKUP / "goods available at" address on one line. ' +
    'deliver_to = the full DELIVERY / consignee address on one line. ' +
    'client_name = the freight forwarder / company that ISSUED this instruction and books the transport (e.g. the DHL / forwarding entity), NOT the shipper or consignee. ' +
    'consignee_name = the party the goods are delivered to. Use empty strings for anything absent; numbers as digits only.';

export const CARTAGE_DOC_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        client_name: { type: Type.STRING, description: 'Forwarder / company that issued the cartage advice (books the transport)' },
        consignee_name: { type: Type.STRING, description: 'Delivery party / consignee' },
        shipper_name: { type: Type.STRING, description: 'Shipper / exporter' },
        collect_from: { type: Type.STRING, description: 'Full pickup / goods-available-at address, one line' },
        deliver_to: { type: Type.STRING, description: 'Full delivery / consignee address, one line' },
        commodity: { type: Type.STRING, description: 'Goods description / commodity' },
        packages: { type: Type.STRING, description: 'Package count + type, e.g. "3 PCE" or "54 PALLETS"' },
        weight: { type: Type.STRING, description: 'Weight in kg, digits only' },
        volume: { type: Type.STRING, description: 'Volume in cubic metres' },
        container_no: { type: Type.STRING, description: 'Container number if FCL, else empty' },
        house_bill: { type: Type.STRING, description: 'House bill / waybill number' },
        ocean_bill: { type: Type.STRING, description: 'Ocean / master bill of lading' },
        shipment_ref: { type: Type.STRING, description: 'Shipment reference (e.g. S...)' },
        booking_ref: { type: Type.STRING, description: 'Transport booking reference (e.g. TB...)' },
        contact_name: { type: Type.STRING, description: 'Issuing contact person' },
        contact_email: { type: Type.STRING, description: 'Issuing contact email' },
        contact_phone: { type: Type.STRING, description: 'Issuing contact phone' },
    },
    required: ['collect_from', 'deliver_to'],
};

// ---- DRO / release / clearing document for ONE LCL groupage shipment ----
// We receive these per shipment from the forwarder; pull the tracking fields so
// the shipment lands on the status report without retyping.
export const DRO_DOC_PROMPT =
    'This is a delivery release order (DRO) / cargo release / clearing instruction for a single LCL groupage shipment ' +
    'arriving by sea and being unpacked at a Durban depot (e.g. ZACPAK, CHC, ICS, MONT, SACD). ' +
    'Extract the tracking fields. Use empty strings for anything absent; numbers as digits only. Dates as YYYY-MM-DD.';

export const DRO_DOC_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        fbn_di: { type: Type.STRING, description: 'FBN DI / job / file reference if shown' },
        file_ref: { type: Type.STRING, description: 'Forwarder file ref / shipment ref (e.g. S...)' },
        house_bill: { type: Type.STRING, description: 'House bill of lading number' },
        container_no: { type: Type.STRING, description: 'Container number the cargo arrived in' },
        vessel: { type: Type.STRING, description: 'Vessel / ship name' },
        eta: { type: Type.STRING, description: 'ETA to port, YYYY-MM-DD' },
        depot: { type: Type.STRING, description: 'Unpack depot (ZACPAK / CHC / ICS / MONT / SACD)' },
        consignee: { type: Type.STRING, description: 'Consignee / client name' },
        commodity: { type: Type.STRING, description: 'Goods / commodity description' },
        qty: { type: Type.STRING, description: 'Number of packages, digits only' },
        weight: { type: Type.STRING, description: 'Weight in kg, digits only' },
        cube: { type: Type.STRING, description: 'Volume in cubic metres' },
        hazardous: { type: Type.STRING, description: 'YES if hazardous/IMO/UN cargo, else NO' },
        un_number: { type: Type.STRING, description: 'UN number if hazardous' },
    },
    required: ['file_ref'],
};

// ---- Depot groupage / packing manifest (many consignments) ----
export const BULK_DOC_PROMPT =
    'This is a depot groupage / packing manifest listing multiple consignments to collect. ' +
    'Extract EVERY consignment line as a row. Use empty strings for missing values; numbers as digits only. ' +
    'If a depot name (e.g. ZACPAK, CHC, ICS, IWS, SACD) appears, return it as depot.';

export const BULK_DOC_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        depot: { type: Type.STRING, description: 'Unpack depot name if shown' },
        consignments: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    client: { type: Type.STRING, description: 'Client / consignee name' },
                    waybill: { type: Type.STRING, description: 'Waybill / house bill number' },
                    ref: { type: Type.STRING, description: 'Client reference / order number' },
                    door: { type: Type.STRING, description: 'Delivery address / door' },
                    packages: { type: Type.STRING, description: 'Number of packages, digits only' },
                    weight: { type: Type.STRING, description: 'Weight in kg, digits only' },
                    cube: { type: Type.STRING, description: 'Volume in cubic metres' },
                    commodity: { type: Type.STRING, description: 'Goods description' },
                },
            },
        },
    },
    required: ['consignments'],
};
