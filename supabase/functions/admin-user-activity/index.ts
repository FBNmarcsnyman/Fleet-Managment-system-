import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Admin-only: returns each auth user's last sign-in + created date (last_sign_in_at
// lives in auth.users, which the client can't read directly). Gated to active Admin/Super Admin.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });

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
    const { data: prof } = await admin.from("profiles").select("role, is_active").eq("id", user.id).single();
    if (!prof || prof.is_active === false || !["Admin", "Super Admin"].includes(prof.role)) {
      return json({ error: "Not authorised." }, 403);
    }

    const activity: { id: string; email: string; lastSignInAt: string | null; createdAt: string | null }[] = [];
    let page = 1;
    // Paginate in case the org grows past one page.
    for (;;) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) return json({ error: error.message }, 500);
      const users = data?.users || [];
      for (const u of users) activity.push({ id: u.id, email: u.email || "", lastSignInAt: (u as any).last_sign_in_at || null, createdAt: u.created_at || null });
      if (users.length < 1000) break;
      page++;
    }
    return json({ ok: true, activity });
  } catch (e) {
    return json({ error: (e as Error)?.message || String(e) }, 500);
  }
});
