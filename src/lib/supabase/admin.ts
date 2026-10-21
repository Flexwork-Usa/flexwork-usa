import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Missing Supabase URL or service role key.");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function verifyAdmin() {
  const session = await createServerSupabaseClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    throw new Error("Access restricted to platform administrators");
  }

  const supabase = createAdminClient();
  const { data: adminUser, error } = await supabase
    .from("admin_users")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !adminUser) {
    throw new Error("Access restricted to platform administrators");
  }

  if (adminUser.role === "worker_admin") {
    throw new Error("Worker admins use the worker dashboard, not the admin console.");
  }

  return { user, adminUser, supabase };
}

export function generateTempPassword(length = 14) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@$%";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}
