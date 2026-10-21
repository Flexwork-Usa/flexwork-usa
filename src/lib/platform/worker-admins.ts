import type { SupabaseClient } from "@supabase/supabase-js";

/** True when the user has a row in public.worker_admins (3rd-tier Worker Admin). */
export async function isWorkerAdminAccount(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("worker_admins")
    .select("worker_id")
    .eq("worker_id", userId)
    .maybeSingle();
  return Boolean(data?.worker_id);
}
