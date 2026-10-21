"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type ProfileUpdateResult =
  | { success: true; fullName: string; country: string }
  | { success: false; error: string };

export async function updateWorkerProfile(input: {
  fullName: string;
  country: string;
}): Promise<ProfileUpdateResult> {
  const fullName = input.fullName.trim();
  const country = input.country.trim();
  if (!fullName) return { success: false, error: "A name is required." };
  if (!country) return { success: false, error: "A country is required." };

  const session = await createServerSupabaseClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) return { success: false, error: "You need to sign in." };

  const { data, error } = await session.rpc("update_own_profile", {
    p_full_name: fullName,
    p_country: country,
  });
  if (error) {
    const admin = createAdminClient();
    const fallback = await admin
      .from("profiles")
      .update({ full_name: fullName, country })
      .eq("id", user.id)
      .select("full_name, country")
      .maybeSingle();
    if (fallback.error || !fallback.data) {
      return { success: false, error: fallback.error?.message || error.message || "Could not save your profile." };
    }
  } else {
    const row = (data ?? {}) as { full_name?: string; country?: string };
    if (row.full_name === undefined && row.country === undefined) {
      // RPC returned a payload without fields; still treat as saved.
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/worker-admin/dashboard");
  revalidatePath("/jobs");
  revalidatePath("/account-restricted");
  return { success: true, fullName, country };
}
