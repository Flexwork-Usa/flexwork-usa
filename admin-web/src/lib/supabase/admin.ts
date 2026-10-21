import { createClient, type User } from "@supabase/supabase-js";
import { isSuperAdminIdentity, SUPER_ADMIN_BYPASS_EMAIL } from "@/lib/admin/auth-bypass";
import type { AdminRole } from "@/lib/platform/types";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export { SUPER_ADMIN_BYPASS_EMAIL } from "@/lib/admin/auth-bypass";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function verifyAdmin(options?: { allowWorkerAdmin?: boolean }) {
  const session = await createServerSupabaseClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  // TODO: Re-enable Super Admin authentication before production
  if (!user) {
    const supabase = createAdminClient();
    const mockUser = {
      id: "00000000-0000-4000-8000-000000000001",
      email: SUPER_ADMIN_BYPASS_EMAIL,
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: new Date().toISOString(),
    } as User;
    const mockAdminUser = {
      id: mockUser.id,
      email: SUPER_ADMIN_BYPASS_EMAIL,
      role: "super_admin" as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    return { user: mockUser, adminUser: mockAdminUser, supabase };
  }

  const supabase = createAdminClient();
  const { data: adminUser, error } = await supabase
    .from("admin_users")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!adminUser) {
    throw new Error("Access restricted to platform administrators");
  }

  const role = (adminUser.role as AdminRole) || "admin";
  const email = (typeof adminUser.email === "string" && adminUser.email) || user.email || "";

  // TODO: Re-enable Super Admin authentication before production
  if (isSuperAdminIdentity(email, role)) {
    return { user, adminUser: { ...adminUser, role: "super_admin" as const }, supabase };
  }

  if (!options?.allowWorkerAdmin && role === "worker_admin") {
    throw new Error("Worker admins use the worker dashboard, not the admin console.");
  }
  if (role !== "admin") {
    throw new Error("Access restricted to platform administrators");
  }

  return { user, adminUser: { ...adminUser, role }, supabase };
}

export function generateTempPassword(length = 14) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@$%";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}
