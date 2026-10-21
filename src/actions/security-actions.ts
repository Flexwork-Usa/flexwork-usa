"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PASSWORD_LOCK_HOURS } from "@/lib/platform/rules";

export type PasswordUpdateResult = { success: true } | { success: false; error: string };

export async function updateWorkerPassword(newPassword: string): Promise<PasswordUpdateResult> {
  const password = newPassword.trim();
  if (password.length < 8) return { success: false, error: "Use at least 8 characters." };

  const session = await createServerSupabaseClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) return { success: false, error: "You need to sign in." };

  const admin = createAdminClient();
  const { data: allowed, error: lockError } = await admin.rpc("can_change_password", { p_user_id: user.id });

  let canChange = allowed === true;
  if (lockError) {
    const { data: profile } = await admin
      .from("profiles")
      .select("last_password_change_at")
      .eq("id", user.id)
      .maybeSingle();
    const changedAt = profile?.last_password_change_at ? new Date(profile.last_password_change_at).getTime() : 0;
    canChange = !changedAt || Date.now() - changedAt >= PASSWORD_LOCK_HOURS * 60 * 60 * 1000;
  }

  if (!canChange) {
    return {
      success: false,
      error: `Password can only be changed once every ${PASSWORD_LOCK_HOURS} hours. Try again later.`,
    };
  }

  const { error } = await session.auth.updateUser({ password });
  if (error) return { success: false, error: error.message };

  await admin
    .from("profiles")
    .update({ last_password_change_at: new Date().toISOString() })
    .eq("id", user.id);

  return { success: true };
}
