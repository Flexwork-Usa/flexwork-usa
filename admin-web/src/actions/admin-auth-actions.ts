"use server";

import { verifyAdmin } from "@/lib/supabase/admin";

export type ConfirmAdminResult =
  | { success: true; email: string }
  | { success: false; error: string };

export async function confirmAdminSession(): Promise<ConfirmAdminResult> {
  try {
    const { user, adminUser } = await verifyAdmin();
    if (adminUser.role === "worker_admin") {
      return { success: false, error: "Worker admins use the worker dashboard, not admin-web." };
    }
    const email =
      (typeof adminUser.email === "string" && adminUser.email) || user.email || "";
    return { success: true, email };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Access restricted to platform administrators";
    return { success: false, error: message };
  }
}
