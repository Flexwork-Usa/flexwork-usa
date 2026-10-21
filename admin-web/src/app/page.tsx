import { redirect } from "next/navigation";
import { isSuperAdminIdentity } from "@/lib/admin/auth-bypass";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function HomePage() {
  // TODO: Re-enable Super Admin authentication before production
  let destination = "/super-admin";
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: adminUser } = await supabase
        .from("admin_users")
        .select("email, role")
        .eq("id", user.id)
        .maybeSingle();
      const email = adminUser?.email || user.email || "";
      if (isSuperAdminIdentity(email, adminUser?.role)) destination = "/super-admin";
      else if (adminUser?.role === "admin") destination = "/dashboard";
      else destination = "/console/v1/login";
    }
  } catch {
    destination = "/super-admin";
  }
  redirect(destination);
}
