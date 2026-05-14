import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Missing auth" }, 401);

    // Validate caller and check admin
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Invalid session" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: isAdmin, error: roleErr } = await admin.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (roleErr) return json({ error: roleErr.message }, 500);
    if (!isAdmin) return json({ error: "Forbidden — admin only" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "");

    if (action === "list") {
      const { data: users, error } = await admin.auth.admin.listUsers({ perPage: 200 });
      if (error) return json({ error: error.message }, 500);
      const { data: roles } = await admin.from("user_roles").select("user_id, role");
      const roleMap = new Map<string, string[]>();
      (roles ?? []).forEach((r: any) => {
        const arr = roleMap.get(r.user_id) ?? [];
        arr.push(r.role);
        roleMap.set(r.user_id, arr);
      });
      const result = users.users.map((u) => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        banned_until: (u as any).banned_until ?? null,
        email_confirmed_at: u.email_confirmed_at,
        roles: roleMap.get(u.id) ?? [],
      }));
      return json({ users: result });
    }

    if (action === "create") {
      const email = String(body?.email ?? "").trim().toLowerCase();
      const isAdminFlag = Boolean(body?.is_admin);
      const redirectTo = String(body?.redirect_to ?? "");
      if (!email || !email.includes("@")) return json({ error: "Valid email required" }, 400);

      const tempPassword = crypto.randomUUID() + "Aa1!";
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
      });
      if (createErr) return json({ error: createErr.message }, 500);

      if (isAdminFlag && created.user) {
        await admin.from("user_roles").insert({ user_id: created.user.id, role: "admin" });
      }

      // Send password reset email so user can set their own password
      await admin.auth.resetPasswordForEmail(email, {
        redirectTo: redirectTo || undefined,
      });

      return json({ user: created.user });
    }

    if (action === "reset_password") {
      const email = String(body?.email ?? "").trim().toLowerCase();
      const redirectTo = String(body?.redirect_to ?? "");
      if (!email) return json({ error: "Email required" }, 400);
      const { error } = await admin.auth.resetPasswordForEmail(email, {
        redirectTo: redirectTo || undefined,
      });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    if (action === "ban") {
      const userId = String(body?.user_id ?? "");
      if (!userId) return json({ error: "user_id required" }, 400);
      const { error } = await admin.auth.admin.updateUserById(userId, {
        ban_duration: "876000h", // ~100 years
      } as any);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    if (action === "unban") {
      const userId = String(body?.user_id ?? "");
      if (!userId) return json({ error: "user_id required" }, 400);
      const { error } = await admin.auth.admin.updateUserById(userId, {
        ban_duration: "none",
      } as any);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    if (action === "delete") {
      const userId = String(body?.user_id ?? "");
      if (!userId) return json({ error: "user_id required" }, 400);
      if (userId === userData.user.id) return json({ error: "Cannot delete yourself" }, 400);
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    if (action === "set_admin") {
      const userId = String(body?.user_id ?? "");
      const makeAdmin = Boolean(body?.is_admin);
      if (!userId) return json({ error: "user_id required" }, 400);
      if (makeAdmin) {
        const { error } = await admin
          .from("user_roles")
          .insert({ user_id: userId, role: "admin" });
        if (error && !error.message.includes("duplicate")) return json({ error: error.message }, 500);
      } else {
        if (userId === userData.user.id) return json({ error: "Cannot remove your own admin role" }, 400);
        const { error } = await admin
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", "admin");
        if (error) return json({ error: error.message }, 500);
      }
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
