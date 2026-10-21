import { redirect } from "next/navigation";
import type { AdminRole } from "@/lib/platform/types";
import { verifyAdmin } from "@/lib/supabase/admin";

export const metadata = { title: "flexwork-usa" };

export default async function LegacyConsoleRedirect() {
  try {
    const { adminUser } = await verifyAdmin();
    const role = ((adminUser as { role?: AdminRole }).role ?? "admin") as AdminRole;
    redirect(role === "super_admin" ? "/super-admin" : "/dashboard");
  } catch {
    redirect("/console/v1/login");
  }
}
