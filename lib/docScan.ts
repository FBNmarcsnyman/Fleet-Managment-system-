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
