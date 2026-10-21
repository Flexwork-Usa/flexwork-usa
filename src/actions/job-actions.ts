"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const INSUFFICIENT_TOKENS = "Insufficient tokens. Minimum required: 10 tokens ($2.00).";

export type ApplyResult =
  | { success: true; tokenBalance: number }
  | { success: false; error: string };

function messageFrom(error: { message: string } | null, fallback: string) {
  return error?.message || fallback;
}

function isSchemaCacheError(message: string) {
  return /schema cache|could not find the function|pgrst202|function .* does not exist|invalid input syntax/i.test(
    message,
  );
}

async function ensureProfile(
  admin: ReturnType<typeof createAdminClient>,
  user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> },
) {
  const { data: existing } = await admin.from("profiles").select("id, token_balance").eq("id", user.id).maybeSingle();
  if (existing) return existing;

  const fullName =
    (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name) ||
    user.email?.split("@")[0] ||
    "Worker";

  const { data: created, error } = await admin
    .from("profiles")
    .upsert({
      id: user.id,
      email: user.email || "",
      full_name: fullName,
      role: "worker",
      status: "active",
      is_approved: true,
      onboarding_status: "approved",
      token_balance: 50,
    })
    .select("id, token_balance")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return created ?? { id: user.id, token_balance: 50 };
}

export async function applyToCuratedJob({ jobId }: { jobId: string }): Promise<ApplyResult> {
  const id = jobId.trim();
  if (!id) return { success: false, error: "A job is required." };

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "You need to sign in." };

  const admin = createAdminClient();
  try {
    await ensureProfile(admin, user);
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not load your profile." };
  }

  const { data, error } = await supabase.rpc("apply_to_curated_job", { p_job_id: id });
  if (!error) {
    revalidatePath("/dashboard");
    revalidatePath("/jobs");
    return { success: true, tokenBalance: Number(data ?? 0) };
  }

  if (!isSchemaCacheError(error.message) && !/worker profile was not found/i.test(error.message)) {
    return { success: false, error: messageFrom(error, "Could not apply.") };
  }

  const existingByWorker = await admin
    .from("job_applications")
    .select("id")
    .eq("worker_id", user.id)
    .eq("job_id", id)
    .maybeSingle();
  const existing = existingByWorker.error
    ? await admin.from("job_applications").select("id").eq("user_id", user.id).eq("job_id", id).maybeSingle()
    : existingByWorker;
  if (existing.data) return { success: false, error: "You already applied to this job." };

  const { error: insertError } = await admin.from("job_applications").insert({
    worker_id: user.id,
    job_id: id,
    status: "applied",
    tokens_staked: 0,
  });
  if (insertError) {
    const legacy = await admin.from("job_applications").insert({
      user_id: user.id,
      job_id: id,
      status: "applied",
      tokens_staked: 0,
    });
    if (legacy.error) {
      const oldest = await admin.from("job_applications").insert({
        user_id: user.id,
        job_id: id,
        status: "applied",
        tokens_spent: 0,
      });
      if (oldest.error) return { success: false, error: insertError.message };
    }
  }

  const { data: profile } = await admin.from("profiles").select("token_balance").eq("id", user.id).maybeSingle();
  revalidatePath("/dashboard");
  revalidatePath("/jobs");
  return { success: true, tokenBalance: Number(profile?.token_balance ?? 0) };
}

export async function applyToAffiliateJob({
  jobId,
  tokenCost = 10,
}: {
  jobId: string;
  tokenCost?: number;
}): Promise<ApplyResult> {
  const id = jobId.trim();
  if (!id) return { success: false, error: "A job is required." };
  if (!Number.isInteger(tokenCost) || tokenCost < 1) {
    return { success: false, error: "Token cost must be a positive whole number." };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "You need to sign in." };

  const admin = createAdminClient();
  try {
    await ensureProfile(admin, user);
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not load your profile." };
  }

  const { data, error } = await supabase.rpc("apply_to_affiliate_job", {
    p_job_id: id,
    p_token_cost: tokenCost,
  });

  if (error) {
    const message = messageFrom(error, "Could not apply.");
    if (message.toLowerCase().includes("insufficient")) {
      return { success: false, error: INSUFFICIENT_TOKENS };
    }
    return { success: false, error: message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/jobs");
  return { success: true, tokenBalance: Number(data ?? 0) };
}
