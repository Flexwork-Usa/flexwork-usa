import { revalidateTag, updateTag } from "next/cache";

/** Shared cache tags for admin ops data. Mutations call invalidateAdminCaches(). */
export const ADMIN_DASHBOARD_TAG = "admin-dashboard";
export const ADMIN_ACCOUNTS_TAG = "admin-accounts";

/** Soft TTL — panel hops reuse warm data; mutations bust via tags. */
export const ADMIN_DATA_REVALIDATE_SECONDS = 20;

/** Call from Server Actions so the next render sees fresh data. */
export function invalidateAdminCaches() {
  updateTag(ADMIN_DASHBOARD_TAG);
  updateTag(ADMIN_ACCOUNTS_TAG);
  revalidateTag(ADMIN_DASHBOARD_TAG, "max");
  revalidateTag(ADMIN_ACCOUNTS_TAG, "max");
}
