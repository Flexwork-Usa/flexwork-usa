"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const INSUFFICIENT_TOKENS = "Insufficient tokens. Minimum required: 10 tokens ($2.00).";

export type ApplyResult =
  | { success: true; tokenBalance: number }
  | { success: false; error: string };

function messageFrom(error: { message: string } | null, fallback: string) {
  return error?.message || fallback;
}

export async function applyToCuratedJob({ jobId }: { jobId: string }): Promise<ApplyResult> {
  const id = jobId.trim();
  if (!id) return { success: false, error: "A job is required." };

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "You need to sign in." };

  const { data, error } = await supabase.rpc("apply_to_curated_job", { p_job_id: id });

  if (error) return { success: false, error: messageFrom(error, "Could not apply.") };

  revalidatePath("/dashboard");
  revalidatePath("/jobs");
  return { success: true, tokenBalance: Number(data ?? 0) };
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
