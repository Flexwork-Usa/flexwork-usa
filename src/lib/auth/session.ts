import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import {
  ACCOUNT_RESTRICTED_PATH,
  ONBOARDING_PENDING_PATH,
  WORKER_ADMIN_PATH,
  adminPortalHome,
  isActiveAccountStatus,
  isOpsAdminRole,
} from "@/lib/auth/account-gate";

export async function resolveWorkerHome() {
  const supabase = createBrowserSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "/login";

  const [{ data: profile }, { data: workerAdmin }, { data: adminUser }] = await Promise.all([
    supabase
      .from("profiles")
      .select("is_approved, onboarding_status, role, status")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.from("worker_admins").select("worker_id").eq("worker_id", user.id).maybeSingle(),
    supabase.from("admin_users").select("role").eq("id", user.id).maybeSingle(),
  ]);

  const opsRole = adminUser?.role || (profile?.role === "admin" || profile?.role === "super_admin" ? profile.role : null);
  if (isOpsAdminRole(opsRole) || isOpsAdminRole(profile?.role)) {
    return adminPortalHome(opsRole || profile?.role);
  }

  if (!isActiveAccountStatus(profile?.status)) return ACCOUNT_RESTRICTED_PATH;

  const pending = !profile?.is_approved || profile?.onboarding_status === "pending_approval";
  if (pending) return ONBOARDING_PENDING_PATH;

  const isWorkerAdmin =
    Boolean(workerAdmin?.worker_id) ||
    adminUser?.role === "worker_admin" ||
    profile?.role === "worker_admin";
  return isWorkerAdmin ? WORKER_ADMIN_PATH : "/dashboard";
}

export function goTo(path: string) {
  window.location.replace(path);
}

export async function signOutToLogin() {
  try {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
  } catch {
    // Always leave the signed-in surface even if the API call fails.
  }
  goTo("/login");
}
