export const ACCOUNT_RESTRICTED_PATH = "/account-restricted";
export const ONBOARDING_PENDING_PATH = "/onboarding-pending";
export const WORKER_ADMIN_PATH = "/worker-admin/dashboard";

export function isOpsAdminRole(role?: string | null) {
  return role === "admin" || role === "super_admin";
}

export function isWorkerPortalRole(role?: string | null) {
  return role === "worker" || role === "worker_admin";
}

export function isActiveAccountStatus(status?: string | null) {
  return !status || status === "active";
}

export function accountStatusLabel(status?: string | null) {
  if (status === "banned") return "banned";
  if (status === "suspended" || status === "temp_disabled") return "suspended";
  if (status === "under_review") return "under review";
  return status?.replaceAll("_", " ") || "restricted";
}

export function adminPortalHome(role?: string | null) {
  const origin = (process.env.NEXT_PUBLIC_ADMIN_WEB_URL || "").replace(/\/$/, "");
  const base = origin || (process.env.NODE_ENV !== "production" ? "http://localhost:3001" : "");
  if (base) {
    if (role === "super_admin") return `${base}/super-admin`;
    return `${base}/dashboard`;
  }
  return "/console/v1/x9q7";
}
