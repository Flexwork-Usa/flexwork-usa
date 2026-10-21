import { cache } from "react";
import { redirect } from "next/navigation";
import type { AdminRole } from "@/lib/platform/types";
import { verifyAdmin } from "@/lib/supabase/admin";

export type OpsActor = {
  adminEmail: string;
  role: AdminRole;
};

/** Dedupes auth within a single RSC request (layout + page). */
export const resolveOpsActor = cache(async (): Promise<OpsActor> => {
  let adminEmail = "";
  let role: AdminRole = "admin";

  try {
    const { user, adminUser } = await verifyAdmin();
    const storedEmail = typeof adminUser.email === "string" ? adminUser.email : "";
    adminEmail = storedEmail || user.email || "";
    role = ((adminUser as { role?: AdminRole }).role ?? "admin") as AdminRole;
  } catch {
    redirect("/console/v1/login");
  }

  if (role !== "super_admin" && role !== "admin") {
    redirect("/console/v1/login");
  }

  return { adminEmail, role };
});

export function shellMode(role: AdminRole): "super_admin" | "admin" {
  return role === "super_admin" ? "super_admin" : "admin";
}
