import { GoogleGenAI } from '@google/genai';

// The FBN Control Centre knowledge base. The help chatbot answers ONLY from this,
// so keep it accurate and update it as features change. Plain-English, task-focused.
export const FBN_FAQ = `
# FBN CONTROL CENTRE — HOW IT WORKS

## What this is
The FBN Control Centre is the web app FBN Transport uses to run quotes, loads, collections, deliveries, the fleet, fuel, and subcontractors. Staff sign in with their work email (or "Sign in with Google" on an @fbn-transport.co.za address). On a phone it opens on the Collections home with quick tiles.

## QUOTES (client quoting)
- Clients request a quote from the website "Get a Quote" form. It lands in the **Quotes** screen as status **Requested**.
- To price it: open the quote and click **Quote It**. This edits the SAME quote (keeps its QU number) — it does NOT make a new line.
- The sell **rate is for the whole shipment** (it is NOT multiplied by the quantity). Quantity is just info.
- Add **weight** and **cubes**. You can enter **parcel dimensions** (L×W×H×qty) and the total cube calculates automatically.
- The **load spec auto-stipulates**: full-vehicle or heavy/high-cube loads → Dedicated; everything else → Consolidated. You can override it.
- Commodity & packaging boxes: start typing to pick an existing one or add a new name (it's saved for next time).
- Click **Generate Quote** to save it as a Draft.
- Send it: the **mail icon** (or "Send Quote to Client") emails the client from **quotes@fbn-transport.co.za** with a View Your Quote link. Rates are shown **excl. VAT**, total **incl. 15% VAT**.
- The client opens the link and clicks **Accept** (or Decline). On Accept they fill in full collection/delivery addresses + contacts.
- On Accept the system automatically: creates the **collection load on the collecting depot's floor**, emails that depot to book & collect, and emails the client a "LOAD BOOKED — we'll keep you updated" confirmation.
- **Proforma (COD):** the **Proforma** button on a quote emails the client a proforma invoice (banking + VAT details, COD note) with **fbndebtors@fbn-transport.co.za** cc'd.
- The Quotes screen has a dashboard: **Accepted / Declined value, Open pipeline, Win rate, Avg R/kg**, plus an **R/kg** per quote.
- To tidy test quotes: tick them and click **Archive selected** (they move to the Archived filter — not deleted; Restore brings them back).

## CARRIER RFQ (sourcing transport)
- In Operations, **Raise RFQ** broadcasts a load to carriers who run the lane. Pick the route, vehicle, commodity, weight, GIT and Hazardous flags, dates/times, and tick the carriers (or "On this route only").
- Carriers reply with a price (by the portal/public link, or you "Log a quote" for phone/WhatsApp replies). Quotes are ranked cheapest-first.
- **Pick & quote** the winner: set a markup → it builds the client quote for approval. After the client approves, convert it to a load.

## SHIPMENTS / COLLECTIONS BOARD
- Operations → Shipments shows two floors: **Collection floor** and **Delivery floor**. A load shows on the collecting branch until in-transit, then moves to the destination branch's delivery floor. Each user lands on their own branch/floor.
- A **collection-date pill** shows when each load is due.
- **Assign FBN** = use our own truck (you must give an ETA). **Subbie** = off-network lane (e.g. Cape Town): FBN collects, then a LoadCon is raised to a subcontractor and it joins the Broking board.
- Cards show the source **quote number + quoted rate** so pricing is traceable through to delivery.

## LOAD LIFECYCLE & DISPATCH
- Statuses run: Booked → At Collection → Collected/Loaded → In Transit → Out for Delivery → Delivered → POD.
- **Dispatch** sets a load In Transit with a planned delivery date and auto-updates the client.
- **Inter-depot line haul** (e.g. DBN → JHB): on dispatch the **receiving depot is emailed** ("please receive on arrival") and the **origin depot is cc'd**. The local truck does the final delivery.

## PODs
- PODs are uploaded against the load (driver link or ops), auto-filed to the company Google Drive POD folder, and emailed to the client.

## SUBCONTRACTORS / SUPPLIERS
- Onboarding: a carrier registers via the become-a-supplier form → uploads compliance docs (Company reg, Tax, BEE, **GIT insurance**, Public liability) → staff **vet** them in Operations → Clients & Subbies → Compliance Vetting → Supplier Onboarding → **Review → Approve**. Approving creates a Transport subcontractor (so they appear in routing & RFQ lists) and emails the applicant.
- Subcontractors have their own **portal**: My Loads, Compliance Vault (upload docs), Fleet & Rates, Profile. Admins can create a login for them and "view portal as".

## FLEET, FUEL, COMPLIANCE
- Fleet: each vehicle has a Documents tab; licence-disc expiry can be read by AI from a scan. Expiring docs are flagged.
- Fuel is its own tab: tank gauges, Drive folder auto-import, cost-per-km.

## EMAILS — IMPORTANT
- There is a global **TEST MODE** (toggle pill in the Topbar). When ON, ALL emails (and WhatsApp) are redirected to Marc with a yellow banner — they do NOT go to real clients/carriers. **If an email "didn't arrive", check TEST MODE first.**
- Depot inboxes: Durban = opsdbn@fbn-transport.co.za, JHB = opsjhb@fbn-transport.co.za. Quotes come from quotes@. Loadcons team = loadcons@ (only copied once a subcontractor LoadCon is made).

## COMMON "HOW DO I…"
- Price an inbound quote: Quotes → open it → Quote It → add rate/weight/cubes → Generate → mail icon to send.
- Get a load onto a depot floor: it happens automatically when the client accepts the quote; or raise a collection from the mobile Collections home.
- Find a carrier for a lane: Operations → Raise RFQ → pick the lane and carriers → send.
- Send a COD client a proforma: open the quote → Proforma button.
- Tidy duplicate/test quotes: tick them → Archive selected.
`;

const SYSTEM = `You are the FBN Control Centre help assistant for FBN Transport's team (and clients).
Answer the user's question using ONLY the knowledge base below. Be concise, friendly and practical — give the exact steps to follow in plain English, as a short numbered list where it helps.
If the answer is not in the knowledge base, say you're not sure and suggest they check with the operations team or Marc — do not invent features.
Never reveal internal rates, other clients' details, or anything a client shouldn't see if the question looks like it's from a client.

KNOWLEDGE BASE:
${FBN_FAQ}`;

export interface HelpMessage { role: 'user' | 'assistant'; text: string; }

// Ask the help assistant a question. `history` is the prior turns (oldest first).
export async function askHelp(question: string, history: HelpMessage[] = []): Promise<string> {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error('The help assistant is not available right now (no AI key configured).');
    const ai = new GoogleGenAI({ apiKey });
    const contents = [
        ...history.map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.text }] })),
        { role: 'user', parts: [{ text: question }] },
    ];
    const res = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents,
        config: { systemInstruction: SYSTEM, temperature: 0.2 },
    });
    return res.text ? res.text.trim() : "Sorry, I couldn't find an answer to that.";
}
