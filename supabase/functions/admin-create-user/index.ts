import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Admin-only: create a team member login + profile. Gated to active Admin/Super Admin.
// IMPORTANT: the on_auth_user_created trigger auto-provisions a default 'Ops' profile for
// any @fbn-transport.co.za email, so this UPSERTS the profile (insert would hit profiles_pkey).
// Also reuses an existing auth login if the email already signed in (e.g. via Google).
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });

const genPassword = () => {
  const adj = ["Swift", "Bright", "Solid", "Prime", "Rapid", "Clear", "Sharp", "Bold"];
  const a = adj[Math.floor(Math.random() * adj.length)];
  const n = Math.floor(1000 + Math.random() * 9000);
  return `${a}Fleet${n}`;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    const caller = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: uErr } = await caller.auth.getUser();
    if (uErr || !user) return json({ error: "Not authenticated." }, 401);

    const admin = createClient(url, service);
    const { data: callerProfile } = await admin
      .from("profiles").select("role, organization_id, is_active").eq("id", user.id).single();
    if (!callerProfile || callerProfile.is_active === false || !["Admin", "Super Admin"].includes(callerProfile.role)) {
      return json({ error: "Only an active admin can add team members." }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const role = body.role;
    const assignedBranches: string[] = Array.isArray(body.assignedBranches) ? body.assignedBranches : [];
    if (!name || !email || !role) return json({ error: "Name, email and role are required." }, 400);

    const password = (body.password && String(body.password).length >= 6) ? String(body.password) : genPassword();

    let userId = "";
    let createdNew = false;
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { name },
    });
    if (cErr || !created?.user) {
      const { data: list } = await admin.auth.admin.listUsers();
      const existing = (list?.users || []).find((u: any) => (u.email || "").toLowerCase() === email);
      if (!existing) return json({ error: cErr?.message || "Could not create the login." }, 400);
      userId = existing.id;
    } else {
      userId = created.user.id;
      createdNew = true;
    }

    let assignedBranchIds: string[] = [];
    if (assignedBranches.length) {
      const { data: branches } = await admin
        .from("branches").select("id, code").eq("organization_id", callerProfile.organization_id);
      assignedBranchIds = (branches ?? []).filter((b: any) => assignedBranches.includes(b.code)).map((b: any) => b.id);
    }

    // Upsert (trigger may have pre-created a default 'Ops' profile → insert would collide).
    const { error: pErr } = await admin.from("profiles").upsert({
      id: userId,
      organization_id: callerProfile.organization_id,
      name, email, role,
      assigned_branch_ids: assignedBranchIds,
      supplier_id: body.supplierId || null,
      client_id: body.clientId || null,
      license_number: body.licenseNumber || null,
      license_expiry: body.licenseExpiry || null,
      pdp_expiry: body.pdpExpiry || null,
      is_active: true,
    }, { onConflict: "id" });
    if (pErr) {
      if (createdNew) await admin.auth.admin.deleteUser(userId);
      return json({ error: pErr.message }, 400);
    }

    return json({ ok: true, userId, email, name, role, tempPassword: createdNew ? password : undefined });
  } catch (e) {
    return json({ error: (e as Error)?.message || String(e) }, 500);
  }
});
