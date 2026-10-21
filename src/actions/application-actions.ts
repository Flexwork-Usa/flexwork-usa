"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  anonymizeApplicantName,
  encodeApplicantExtras,
  jobMinTokens,
  MIN_STAKE_TOKENS,
} from "@/lib/platform/rules";
import type { JobBidLeaderboardRow } from "@/lib/platform/types";

export type ApplicationActionResult =
  | { success: true; tokensStaked: number; rankPosition: number; applicantCount: number; tokenBalance?: number }
  | { success: false; error: string };

function rpcFailureMessage(data: unknown, error: { message?: string } | null) {
  if (error?.message) return error.message;
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  if (row.success === false) return String(row.error ?? row.message ?? "Could not submit application.");
  if (typeof row.error === "string" && row.error && row.success !== true && row.id == null) return row.error;
  return null;
}

function applicationInsertPayloads(input: {
  jobId: string;
  workerId: string;
  fullName: string;
  email: string;
  country: string;
  coverLetter: string;
  cvUrl: string | null;
  portfolioUrl: string | null;
  tokens: number;
}) {
  const name = input.fullName.trim() || null;
  const email = input.email.trim();
  const country = input.country.trim();
  const base = {
    job_id: input.jobId,
    worker_id: input.workerId,
    tokens_staked: input.tokens,
    status: "submitted",
    applicant_name: name,
    cover_letter: input.coverLetter,
    cv_url: input.cvUrl,
    portfolio_url: input.portfolioUrl,
  };
  return [
    { ...base, applicant_email: email, applicant_country: country },
    { ...base, email, country },
    { ...base, applicant_email: email, country },
    { ...base, email, applicant_country: country },
    {
      ...base,
      applicant_email: email,
      applicant_country: country,
      cover_letter: encodeApplicantExtras(email, country, input.coverLetter),
    },
  ];
}

async function insertApplicationRow(
  admin: ReturnType<typeof createAdminClient>,
  input: {
    jobId: string;
    workerId: string;
    fullName: string;
    email: string;
    country: string;
    coverLetter: string;
    cvUrl: string | null;
    portfolioUrl: string | null;
    tokens: number;
  },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  let lastError = "Could not submit application.";
  for (const payload of applicationInsertPayloads(input)) {
    const inserted = await admin.from("applications").insert(payload).select("id").maybeSingle();
    if (!inserted.error && inserted.data?.id) return { ok: true, id: String(inserted.data.id) };
    lastError = inserted.error?.message || lastError;
    if (/already exists|duplicate|unique/i.test(lastError)) {
      return { ok: false, error: "You already applied to this job." };
    }
  }
  return { ok: false, error: lastError };
}

async function getRank(admin: ReturnType<typeof createAdminClient>, jobId: string, workerId: string) {
  const { data } = await admin
    .from("application_ranks")
    .select("rank_position, applicant_count, tokens_staked")
    .eq("job_id", jobId)
    .eq("worker_id", workerId)
    .maybeSingle();
  return {
    rankPosition: Number(data?.rank_position ?? 0),
    applicantCount: Number(data?.applicant_count ?? 0),
    tokensStaked: Number(data?.tokens_staked ?? 0),
  };
}

export async function submitJobApplication(input: {
  jobId: string;
  fullName: string;
  email: string;
  country: string;
  coverLetter: string;
  cvUrl?: string;
  portfolioUrl?: string;
  tokens: number;
}): Promise<ApplicationActionResult> {
  const jobId = input.jobId.trim();
  const coverLetter = input.coverLetter.trim();
  const tokens = Math.max(1, Math.floor(Number(input.tokens) || 0));
  if (!jobId) return { success: false, error: "A job is required." };
  if (!coverLetter) return { success: false, error: "A cover letter is required." };

  const session = await createServerSupabaseClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) return { success: false, error: "You need to sign in." };

  const email = input.email.trim() || user.email?.trim() || "";
  const country = input.country.trim();
  const fullName = input.fullName.trim();
  if (!email) return { success: false, error: "An email is required." };
  if (!country) return { success: false, error: "A country is required." };

  const payload = {
    p_job_id: jobId,
    p_name: fullName,
    p_email: email,
    p_country: country,
    p_cover_letter: coverLetter,
    p_cv_url: input.cvUrl?.trim() || null,
    p_portfolio_url: input.portfolioUrl?.trim() || null,
    p_tokens_staked: tokens,
  };
  const { data, error } = await session.rpc("submit_job_application", payload);
  const rpcError = rpcFailureMessage(data, error);
  if (rpcError) {
    const fallback = await submitJobApplicationFallback({
      jobId,
      workerId: user.id,
      fullName,
      email,
      country,
      coverLetter,
      cvUrl: payload.p_cv_url,
      portfolioUrl: payload.p_portfolio_url,
      tokens,
    });
    if (!fallback.success) {
      return { success: false, error: fallback.error || rpcError || "Could not submit application." };
    }
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/applications");
    revalidatePath("/worker-admin/dashboard");
    revalidatePath("/worker-admin/dashboard/applications");
    revalidatePath("/jobs");
    const rank = await getRank(createAdminClient(), jobId, user.id);
    return {
      success: true,
      tokensStaked: fallback.tokensStaked,
      tokenBalance: fallback.tokenBalance,
      rankPosition: rank.rankPosition,
      applicantCount: rank.applicantCount,
    };
  }

  const result = (data ?? {}) as { tokens_staked?: number; token_balance?: number };
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/applications");
  revalidatePath("/worker-admin/dashboard");
  revalidatePath("/worker-admin/dashboard/applications");
  revalidatePath("/jobs");
  const rank = await getRank(createAdminClient(), jobId, user.id);
  return {
    success: true,
    tokensStaked: Number(result.tokens_staked ?? tokens),
    tokenBalance: result.token_balance != null ? Number(result.token_balance) : undefined,
    rankPosition: rank.rankPosition,
    applicantCount: rank.applicantCount,
  };
}

async function submitJobApplicationFallback(input: {
  jobId: string;
  workerId: string;
  fullName: string;
  email: string;
  country: string;
  coverLetter: string;
  cvUrl: string | null;
  portfolioUrl: string | null;
  tokens: number;
}): Promise<{ success: true; tokensStaked: number; tokenBalance: number } | { success: false; error: string }> {
  const admin = createAdminClient();
  const { data: job, error: jobError } = await admin.from("jobs").select("*").eq("id", input.jobId).maybeSingle();
  if (jobError || !job) return { success: false, error: jobError?.message || "Job not found." };
  const minTokens = jobMinTokens(job);
  if (input.tokens < minTokens) {
    return { success: false, error: `Minimum tokens required is ${minTokens}.` };
  }

  const { data: existing } = await admin
    .from("applications")
    .select("id")
    .eq("job_id", input.jobId)
    .eq("worker_id", input.workerId)
    .maybeSingle();
  if (existing) return { success: false, error: "You already applied to this job." };

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("token_balance, total_tokens_spent, status")
    .eq("id", input.workerId)
    .maybeSingle();
  if (profileError || !profile) return { success: false, error: profileError?.message || "Profile not found." };
  if (profile.status && profile.status !== "active") {
    return { success: false, error: "Your account cannot apply right now." };
  }
  const balance = Number(profile.token_balance ?? 0);
  if (balance < input.tokens) {
    return { success: false, error: `Insufficient tokens. Minimum required is ${minTokens}.` };
  }

  const inserted = await insertApplicationRow(admin, input);
  if (!inserted.ok) return { success: false, error: inserted.error };

  const debit = await admin
    .from("profiles")
    .update({
      token_balance: balance - input.tokens,
      total_tokens_spent: Number(profile.total_tokens_spent ?? 0) + input.tokens,
    })
    .eq("id", input.workerId)
    .eq("token_balance", profile.token_balance);
  if (debit.error) {
    await admin.from("applications").delete().eq("id", inserted.id);
    return { success: false, error: debit.error.message };
  }

  return { success: true, tokensStaked: input.tokens, tokenBalance: balance - input.tokens };
}

function mapLeaderboardRows(data: unknown): JobBidLeaderboardRow[] {
  return (Array.isArray(data) ? data : []).map((row, index) => {
    const item = row as Record<string, unknown>;
    return {
      rank: Number(item.rank ?? index + 1),
      anonymizedName: String(item.anonymized_name ?? item.anonymizedName ?? "Applicant *****"),
      tokensStaked: Number(item.tokens_staked ?? item.tokensStaked ?? 0),
    };
  });
}

async function leaderboardFromApplications(jobId: string): Promise<JobBidLeaderboardRow[]> {
  const admin = createAdminClient();
  const { data: job } = await admin.from("jobs").select("slots_needed").eq("id", jobId).maybeSingle();
  const slots = Math.max(1, Math.floor(Number(job?.slots_needed ?? 5) || 5));
  const { data: rows } = await admin
    .from("applications")
    .select("applicant_name, tokens_staked, created_at, worker_id, status")
    .eq("job_id", jobId)
    .neq("status", "rejected")
    .order("tokens_staked", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(slots);
  const workerIds = [...new Set((rows ?? []).map((row) => String(row.worker_id)).filter(Boolean))];
  const names = new Map<string, string>();
  if (workerIds.length > 0) {
    const { data: profiles } = await admin.from("profiles").select("id, full_name").in("id", workerIds);
    for (const profile of profiles ?? []) names.set(String(profile.id), profile.full_name || "Applicant");
  }
  return (rows ?? []).map((row, index) => ({
    rank: index + 1,
    anonymizedName: anonymizeApplicantName(row.applicant_name || names.get(String(row.worker_id)) || "Applicant"),
    tokensStaked: Number(row.tokens_staked ?? 0),
  }));
}

export async function getJobLeaderboard(jobId: string): Promise<JobBidLeaderboardRow[]> {
  const id = jobId.trim();
  if (!id) return [];
  const session = await createServerSupabaseClient();
  const { data, error } = await session.rpc("get_job_leaderboard", { p_job_id: id });
  if (!error) return mapLeaderboardRows(data);

  const admin = createAdminClient();
  const { data: fallback, error: fallbackError } = await admin.rpc("get_job_leaderboard", { p_job_id: id });
  if (!fallbackError) return mapLeaderboardRows(fallback);
  return leaderboardFromApplications(id);
}

/** @deprecated Use submitJobApplication */
export async function applyWithStake(input: {
  jobId: string;
  tokensStaked?: number;
}): Promise<ApplicationActionResult> {
  const session = await createServerSupabaseClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) return { success: false, error: "You need to sign in." };
  const { data: profile } = await session
    .from("profiles")
    .select("full_name, email, country")
    .eq("id", user.id)
    .maybeSingle();
  return submitJobApplication({
    jobId: input.jobId,
    fullName: profile?.full_name || "Worker",
    email: profile?.email || user.email || "",
    country: profile?.country || "",
    coverLetter: "I would like to apply for this project.",
    tokens: Math.max(MIN_STAKE_TOKENS, Math.floor(Number(input.tokensStaked ?? MIN_STAKE_TOKENS))),
  });
}

export async function boostApplicationStake(input: {
  applicationId: string;
  additionalTokens: number;
}): Promise<ApplicationActionResult> {
  const applicationId = input.applicationId.trim();
  const extra = Math.floor(Number(input.additionalTokens));
  if (!applicationId) return { success: false, error: "An application is required." };
  if (!Number.isFinite(extra) || extra < 1) return { success: false, error: "Add at least 1 token." };

  const session = await createServerSupabaseClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) return { success: false, error: "You need to sign in." };

  const admin = createAdminClient();
  const { data: application } = await admin
    .from("applications")
    .select("id, job_id, tokens_staked, status")
    .eq("id", applicationId)
    .eq("worker_id", user.id)
    .maybeSingle();
  if (!application) return { success: false, error: "Application not found." };
  if (application.status === "hired" || application.status === "rejected") {
    return { success: false, error: "This application can no longer be boosted." };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("token_balance, total_tokens_spent")
    .eq("id", user.id)
    .maybeSingle();
  if ((profile?.token_balance ?? 0) < extra) {
    return { success: false, error: "Insufficient tokens." };
  }

  const nextStake = Number(application.tokens_staked) + extra;
  const { error: updateError } = await admin
    .from("applications")
    .update({ tokens_staked: nextStake, updated_at: new Date().toISOString() })
    .eq("id", applicationId);
  if (updateError) return { success: false, error: updateError.message };

  const { error: debitError } = await admin
    .from("profiles")
    .update({
      token_balance: (profile?.token_balance ?? 0) - extra,
      total_tokens_spent: Number(profile?.total_tokens_spent ?? 0) + extra,
    })
    .eq("id", user.id);
  if (debitError) return { success: false, error: debitError.message };

  const rank = await getRank(admin, application.job_id, user.id);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/applications");
  return { success: true, tokensStaked: nextStake, rankPosition: rank.rankPosition, applicantCount: rank.applicantCount };
}
