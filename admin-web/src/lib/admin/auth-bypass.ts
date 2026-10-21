// TODO: Re-enable Super Admin authentication before production
export const SUPER_ADMIN_BYPASS_EMAIL = "blackmanochieng@gmail.com";

export function isSuperAdminIdentity(email: string | null | undefined, role: string | null | undefined) {
  return role === "super_admin" || (email ?? "").trim().toLowerCase() === SUPER_ADMIN_BYPASS_EMAIL;
}
