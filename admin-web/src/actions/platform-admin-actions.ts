"use server";

import { revalidatePath } from "next/cache";
import { invalidateAdminCaches } from "@/lib/admin/cache";
import {
  canManageRole,
  encodeJobMetaTags,
  jobMinTokens,
  payTypeFromRate,
} from "@/lib/platform/rules";
import type { AdminRole, ApplicationStatus, JobHiringStatus, PayoutStatus, WorkerStatus } from "@/lib/platform/types";
import { generateTempPassword, verifyAdmin } from "@/lib/supabase/admin";

function refresh() {
  invalidateAdminCaches();
  revalidatePath("/super-admin");
  revalidatePath("/super-admin/admins");
  revalidatePath("/super-admin/worker-admins");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/admins");
  revalidatePath("/dashboard/worker-admins");
  revalidatePath("/console/v1/x9q7");
}

async function resolveCreatedBy(
  supabase: Awaited<ReturnType<typeof requireOpsAdmin>>["supabase"],
  actorId: string,
) {
  const { data } = await supabase.from("admin_users").select("id").eq("id", actorId).maybeSingle();
  return data?.id ?? null;
}

async function requireOpsAdmin() {
  const ctx = await verifyAdmin();
  const role = (ctx.adminUser.role as AdminRole) ?? "admin";
  if (role !== "super_admin" && role !== "admin") {
    throw new Error("Only super admins and admins can manage operations.");
  }
  return { ...ctx, role };
}

export async function createManagedJob(input: {
  title: string;
  company?: string;
  category?: string;
  description?: string;
  briefDescription: string;
  fullDescription: string;
  tags?: string | string[];
  payType?: "hourly" | "quota";
  payRate: string | number;
  slotsNeeded: number;
  minTokens?: number;
}) {
  const { supabase } = await requireOpsAdmin();
  const title = input.title.trim();
  if (!title) throw new Error("Title is required.");
  const payRate = String(input.payRate).trim();
  if (!payRate) throw new Error("Pay rate is required.");
  const slotsNeeded = Math.max(1, Math.floor(Number(input.slotsNeeded) || 1));
  const minTokens = Math.max(1, Math.floor(Number(input.minTokens ?? 5) || 5));
  const brief = input.briefDescription.trim();
  const full = input.fullDescription.trim();
  const tags = encodeJobMetaTags(input.tags, { minTokens, hiringStatus: "hiring" });
  const livePayload: Record<string, unknown> = {
    title,
    brief_description: brief,
    full_description: full,
    tags,
    pay_rate: payRate,
    slots_needed: slotsNeeded,
  };
  const payload: Record<string, unknown> = {
    ...livePayload,
    tier: "affiliate",
    description: brief || full,
    category: (input.category ?? "General").trim() || "General",
    pay_type: input.payType ?? payTypeFromRate(payRate),
    hiring_status: "hiring",
    token_cost: minTokens,
    min_tokens: minTokens,
    is_active: true,
  };

  const { error } = await supabase.from("jobs").insert(payload);
  if (error) {
    const retry = await supabase.from("jobs").insert(livePayload);
    if (retry.error) throw new Error(retry.error.message);
  }
  refresh();
}

export async function updateManagedJob(input: {
  id: string;
  title: string;
  description?: string;
  briefDescription: string;
  fullDescription: string;
  tags?: string | string[];
  payType?: "hourly" | "quota";
  payRate: string | number;
  slotsNeeded: number;
  minTokens?: number;
  hiringStatus: JobHiringStatus;
  category?: string;
}) {
  const { supabase } = await requireOpsAdmin();
  const title = input.title.trim();
  if (!title) throw new Error("Title is required.");
  const payRate = String(input.payRate).trim();
  const slotsNeeded = Math.max(1, Math.floor(Number(input.slotsNeeded) || 1));
  const minTokens = Math.max(1, Math.floor(Number(input.minTokens ?? 5) || 5));
  const brief = input.briefDescription.trim();
  const full = input.fullDescription.trim();
  const tags = encodeJobMetaTags(input.tags, { minTokens, hiringStatus: input.hiringStatus });
  const livePayload: Record<string, unknown> = {
    title,
    brief_description: brief,
    full_description: full,
    tags,
    pay_rate: payRate,
    slots_needed: slotsNeeded,
  };
  const payload: Record<string, unknown> = {
    ...livePayload,
    description: brief || full,
    category: (input.category ?? "General").trim() || "General",
    pay_type: input.payType ?? payTypeFromRate(payRate),
    min_tokens: minTokens,
    token_cost: minTokens,
    hiring_status: input.hiringStatus,
    is_active: input.hiringStatus === "hiring",
  };

  const { error } = await supabase.from("jobs").update(payload).eq("id", input.id);
  if (error) {
    const { error: liveError } = await supabase.from("jobs").update(livePayload).eq("id", input.id);
    if (liveError) throw new Error(liveError.message);
  }
  refresh();
}

export async function updateJobHiringStatus(jobId: string, status: JobHiringStatus) {
  const { supabase } = await requireOpsAdmin();
  const { data: job } = await supabase.from("jobs").select("tags").eq("id", jobId).maybeSingle();
  const tags = encodeJobMetaTags(job?.tags, { minTokens: jobMinTokens(job ?? {}), hiringStatus: status });
  const { error } = await supabase
    .from("jobs")
    .update({ hiring_status: status, is_active: status === "hiring", tags })
    .eq("id", jobId);
  if (error) {
    const retry = await supabase.from("jobs").update({ tags }).eq("id", jobId);
    if (retry.error) throw new Error(retry.error.message);
  }
  refresh();
}

export async function deleteManagedJob(jobId: string) {
  const { supabase } = await requireOpsAdmin();
  const { error } = await supabase.from("jobs").delete().eq("id", jobId);
  if (error) throw new Error(error.message);
  refresh();
}

export async function reviewTreasuryDeposit(
  depositId: string,
  decision: "approved" | "rejected",
): Promise<{ success: true; status: "finished" | "rejected" } | { success: false; error: string }> {
  const id = depositId.trim();
  if (!id) return { success: false, error: "Deposit id is required." };

  const { supabase } = await requireOpsAdmin();
  const reviewable = ["pending", "waiting"] as const;

  if (decision === "approved") {
    const { data, error } = await supabase.rpc("approve_treasury_deposit", { p_deposit_id: id });
    if (error) {
      const { data: deposit, error: claimError } = await supabase
        .from("treasury_deposits")
        .update({ status: "finished" })
        .eq("id", id)
        .in("status", reviewable)
        .select("*")
        .maybeSingle();
      if (claimError) return { success: false, error: claimError.message || error.message };
      if (!deposit) return { success: false, error: "Deposit is no longer waiting for review." };

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("token_balance")
        .eq("id", deposit.worker_id)
        .maybeSingle();
      if (profileError || !profile) {
        await supabase.from("treasury_deposits").update({ status: deposit.status }).eq("id", id).eq("status", "finished");
        return { success: false, error: profileError?.message || "Worker profile was not found." };
      }
      const next = Number(profile.token_balance ?? 0) + Number(deposit.tokens_issued);
      const { error: creditError } = await supabase
        .from("profiles")
        .update({ token_balance: next })
        .eq("id", deposit.worker_id)
        .eq("token_balance", profile.token_balance);
      if (creditError) {
        await supabase.from("treasury_deposits").update({ status: deposit.status }).eq("id", id).eq("status", "finished");
        return { success: false, error: creditError.message };
      }
    } else if (!data) {
      return { success: false, error: "Deposit approval did not return a result." };
    }
    refresh();
    return { success: true, status: "finished" };
  }

  const { data, error } = await supabase.rpc("reject_treasury_deposit", { p_deposit_id: id });
  if (error) {
    const { data: deposit, error: rejectError } = await supabase
      .from("treasury_deposits")
      .update({ status: "rejected" })
      .eq("id", id)
      .in("status", reviewable)
      .select("id")
      .maybeSingle();
    if (rejectError) return { success: false, error: rejectError.message || error.message };
    if (!deposit) return { success: false, error: "Deposit is no longer waiting for review." };
  } else if (!data) {
    return { success: false, error: "Deposit rejection did not return a result." };
  }

  refresh();
  return { success: true, status: "rejected" };
}

export async function updateWorkerStatus(workerId: string, status: WorkerStatus) {
  const { supabase } = await requireOpsAdmin();
  const { error } = await supabase.from("profiles").update({ status }).eq("id", workerId);
  if (error) throw new Error(error.message);
  refresh();
}

export async function reviewPlatformApplication(
  applicationId: string,
  status: Extract<ApplicationStatus, "hired" | "rejected" | "under_review" | "viewed"> | "hire" | "view" | "review",
) {
  const { supabase } = await requireOpsAdmin();
  const id = applicationId.trim();
  const nextStatus =
    status === "hire" || status === "hired"
      ? "hired"
      : status === "review" || status === "under_review"
        ? "under_review"
        : status === "view" || status === "viewed"
          ? "viewed"
          : status === "rejected"
            ? "rejected"
            : null;
  if (!id) throw new Error("Application id is required.");
  if (!nextStatus) throw new Error("Choose view, review, hire, or reject.");

  const { error } = await supabase.rpc("review_job_application", {
    p_app_id: id,
    p_new_status: nextStatus,
  });
  if (!error) {
    refresh();
    return;
  }

  const { data: app, error: loadError } = await supabase
    .from("applications")
    .select("id, status, worker_id, tokens_staked")
    .eq("id", id)
    .maybeSingle();
  if (loadError) throw new Error(loadError.message);
  if (!app) throw new Error("Application not found.");
  if (app.status === "hired" || app.status === "rejected") {
    throw new Error("This application has already been reviewed.");
  }

  const stamp = new Date().toISOString();
  let claimed = await supabase
    .from("applications")
    .update({ status: nextStatus, updated_at: stamp })
    .eq("id", id)
    .in("status", ["submitted", "viewed", "under_review"])
    .select("id, worker_id, tokens_staked")
    .maybeSingle();
  if (claimed.error) {
    claimed = await supabase
      .from("applications")
      .update({ status: nextStatus })
      .eq("id", id)
      .in("status", ["submitted", "viewed", "under_review"])
      .select("id, worker_id, tokens_staked")
      .maybeSingle();
    if (claimed.error) throw new Error(claimed.error.message);
  }
  if (!claimed.data) throw new Error("This application has already been reviewed.");

  if (nextStatus === "rejected") {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("token_balance")
      .eq("id", claimed.data.worker_id)
      .maybeSingle();
    if (profileError) throw new Error(profileError.message);
    if (!profile) throw new Error("Worker profile was not found.");
    const refunded = Number(claimed.data.tokens_staked ?? 0);
    const { error: creditError } = await supabase
      .from("profiles")
      .update({ token_balance: Number(profile.token_balance ?? 0) + refunded })
      .eq("id", claimed.data.worker_id);
    if (creditError) throw new Error(creditError.message);
  }
  refresh();
}

export async function simulateWorkerAdminEarnings(input: {
  workerId: string;
  totalEarnings: number;
  totalTokensSpent: number;
}) {
  const { supabase, user } = await requireOpsAdmin();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .update({
      total_earnings: Math.max(0, Number(input.totalEarnings) || 0),
      total_tokens_spent: Math.max(0, Number(input.totalTokensSpent) || 0),
      role: "worker_admin",
    })
    .eq("id", input.workerId)
    .select("id, email, full_name")
    .maybeSingle();
  if (profileError) throw new Error(profileError.message);

  const createdBy = await resolveCreatedBy(supabase, user.id);
  const now = new Date().toISOString();
  const workerAdminPayload: Record<string, unknown> = {
    worker_id: input.workerId,
    email: profile?.email || "",
    full_name: profile?.full_name || "",
    status: "active",
    updated_at: now,
  };
  if (createdBy) workerAdminPayload.created_by = createdBy;
  const { error: workerAdminError } = await supabase.from("worker_admins").upsert(workerAdminPayload);
  if (workerAdminError) {
    const legacyPayload: Record<string, unknown> = {
      worker_id: input.workerId,
      email: profile?.email || "",
      full_name: profile?.full_name || "",
      updated_at: now,
    };
    if (createdBy) legacyPayload.created_by = createdBy;
    const legacy = await supabase.from("worker_admins").upsert(legacyPayload);
    if (legacy.error) throw new Error(legacy.error.message);
  }
  refresh();
}

export async function reviewPayoutRequest(
  payoutId: string,
  decision: Extract<PayoutStatus, "approved" | "rejected">,
): Promise<{ success: true; status: PayoutStatus } | { success: false; error: string }> {
  const { supabase } = await requireOpsAdmin();
  const id = payoutId.trim();
  if (!id) return { success: false, error: "A payout request is required." };
  if (decision !== "approved" && decision !== "rejected") {
    return { success: false, error: "Choose approve or reject." };
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc("review_payout_request", {
    p_payout_id: id,
    p_new_status: decision,
  });
  const rpcFailed =
    Boolean(rpcError?.message) ||
    (rpcData &&
      typeof rpcData === "object" &&
      ((rpcData as { success?: boolean }).success === false ||
        (typeof (rpcData as { error?: string }).error === "string" &&
          (rpcData as { error?: string }).error &&
          (rpcData as { id?: string }).id == null)));

  const { data: row, error: loadError } = await supabase
    .from("payout_requests")
    .select("id, worker_id, amount, status")
    .eq("id", id)
    .maybeSingle();
  if (loadError) return { success: false, error: loadError.message };
  if (!row) return { success: false, error: "Payout request not found." };

  if (row.status === decision) {
    refresh();
    return { success: true, status: decision };
  }
  if (row.status !== "pending") {
    return { success: false, error: `This payout is already ${row.status}.` };
  }

  if (!rpcFailed) {
    const { data: afterRpc } = await supabase
      .from("payout_requests")
      .select("status")
      .eq("id", id)
      .maybeSingle();
    if (afterRpc?.status === decision) {
      refresh();
      return { success: true, status: decision };
    }
  }

  const amount = Number(row.amount ?? 0);
  const { data: updated, error: statusError } = await supabase
    .from("payout_requests")
    .update({ status: decision })
    .eq("id", id)
    .eq("status", "pending")
    .select("id, status")
    .maybeSingle();
  if (statusError) return { success: false, error: statusError.message };
  if (!updated) {
    return { success: false, error: "This payout is no longer pending." };
  }

  if (decision === "rejected") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("pending_earnings")
      .eq("id", row.worker_id)
      .maybeSingle();
    const next = Number(profile?.pending_earnings ?? 0) + amount;
    await supabase.from("profiles").update({ pending_earnings: next }).eq("id", row.worker_id);
    await supabase
      .from("worker_admins")
      .update({ pending_earnings: next, updated_at: new Date().toISOString() })
      .eq("worker_id", row.worker_id);
  } else {
    const { data: profile } = await supabase
      .from("profiles")
      .select("total_earnings")
      .eq("id", row.worker_id)
      .maybeSingle();
    const next = Number(profile?.total_earnings ?? 0) + amount;
    await supabase.from("profiles").update({ total_earnings: next }).eq("id", row.worker_id);
    await supabase
      .from("worker_admins")
      .update({ total_earnings: next, updated_at: new Date().toISOString() })
      .eq("worker_id", row.worker_id);
  }

  refresh();
  return { success: true, status: decision };
}

export async function upsertLeaderboardEntry(input: {
  id?: string;
  workerName: string;
  emailMasked: string;
  country: string;
  skill: string;
  totalEarnings: number;
  rankOrder: number;
}) {
  const { supabase } = await requireOpsAdmin();
  const payload = {
    worker_name: input.workerName.trim(),
    email_masked: input.emailMasked.trim(),
    country: input.country.trim(),
    skill: input.skill.trim(),
    total_earnings: Number(input.totalEarnings) || 0,
    rank_order: Math.max(1, Math.floor(Number(input.rankOrder) || 1)),
    updated_at: new Date().toISOString(),
  };
  if (!payload.worker_name) throw new Error("Worker name is required.");

  if (input.id) {
    const { error } = await supabase.from("leaderboard").update(payload).eq("id", input.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("leaderboard").insert(payload);
    if (error) throw new Error(error.message);
  }
  refresh();
}

export async function deleteLeaderboardEntry(id: string) {
  const { supabase } = await requireOpsAdmin();
  const { error } = await supabase.from("leaderboard").delete().eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
}

export async function approveOnboardingApplication(applicationId: string) {
  const { supabase } = await requireOpsAdmin();
  const id = applicationId.trim();
  if (!id) throw new Error("Application id is required.");

  try {
  const { data: application, error: loadError } = await supabase
    .from("onboarding_applications")
    .select("*")
    .eq("id", id)
    .eq("status", "pending")
    .maybeSingle();
  if (loadError) throw new Error(loadError.message);
  if (!application) throw new Error("Pending application not found.");

  const email = String(application.email).trim().toLowerCase();
  const fullName = String(application.full_name || "Worker");
  const tempPassword = generateTempPassword();
  const loginUrl = process.env.NEXT_PUBLIC_SITE_URL
    ? `${process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/login`
    : "https://flexwork-usa.com/login";

  const { data: rpcResult, error: rpcError } = await supabase.rpc("approve_worker_account", {
    p_application_id: id,
    p_temp_password: tempPassword,
  });
  if (rpcError) {
    console.error("approve_worker_account RPC failed, falling back to direct update:", rpcError);
  }

  let userId: string | undefined;
  if (!rpcError && rpcResult && typeof rpcResult === "object") {
    const payload = rpcResult as { user_id?: string | null; created?: boolean };
    userId = payload.user_id || undefined;
  }

  if (!userId) {
    const { data: existingProfile } = await supabase.from("profiles").select("id").ilike("email", email).maybeSingle();
    userId = existingProfile?.id;
  }

  if (!userId) {
    const { data: listed } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
    const existingAuth = listed?.users?.find((item) => (item.email || "").toLowerCase() === email);
    if (existingAuth) {
      userId = existingAuth.id;
      const { error: passwordError } = await supabase.auth.admin.updateUserById(userId, { password: tempPassword });
      if (passwordError) throw new Error(passwordError.message);
    } else {
      const { data: created, error: createError } = await supabase.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });
      if (createError || !created.user) throw new Error(createError?.message ?? "Could not create worker auth user.");
      userId = created.user.id;
    }
  } else {
    const { error: passwordError } = await supabase.auth.admin.updateUserById(userId, { password: tempPassword });
    if (passwordError) throw new Error(passwordError.message);
  }

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: userId,
    full_name: fullName,
    email,
    country: application.country,
    phone_number: application.phone_number,
    role: "worker",
    status: "active",
    is_approved: true,
    onboarding_status: "approved",
    temp_recovery_pass: tempPassword,
    token_balance: 50,
  });
  if (profileError) throw new Error(profileError.message);

  if (rpcError) {
    await supabase.from("onboarding_applications").update({ status: "approved" }).eq("id", id);
  }

  const welcomeEmail = `Welcome to FlexWork-USA!

Your worker account has been approved.

Login URL: ${loginUrl}
Email: ${email}
Temporary Password: ${tempPassword}

Important:
- Keep these credentials safe.
- Change your password on first login from Dashboard → Account Settings.
- Password changes are limited to once every 24 hours.

— flexwork-usa`;

  refresh();
  return { email, tempPassword, userId, fullName, loginUrl, welcomeEmail };
  } catch (caught) {
    console.error("approveOnboardingApplication failed:", caught);
    throw caught instanceof Error ? caught : new Error("Could not approve worker application.");
  }
}

export async function rejectOnboardingApplication(applicationId: string) {
  const { supabase } = await requireOpsAdmin();
  const id = applicationId.trim();
  if (!id) throw new Error("Application id is required.");

  const { data: application, error: loadError } = await supabase
    .from("onboarding_applications")
    .select("id, email")
    .eq("id", id)
    .eq("status", "pending")
    .maybeSingle();
  if (loadError) throw new Error(loadError.message);
  if (!application) throw new Error("Pending application not found.");

  const { error } = await supabase.from("onboarding_applications").update({ status: "rejected" }).eq("id", id);
  if (error) throw new Error(error.message);

  await supabase
    .from("profiles")
    .update({ is_approved: false, onboarding_status: "rejected" })
    .eq("email", application.email);

  refresh();
}

export async function resetWorkerRecoveryPassword(workerId: string) {
  const { supabase } = await requireOpsAdmin();
  const id = workerId.trim();
  if (!id) throw new Error("Worker id is required.");

  const tempPassword = generateTempPassword();
  const { error: authError } = await supabase.auth.admin.updateUserById(id, { password: tempPassword });
  if (authError) throw new Error(authError.message);

  const { error } = await supabase
    .from("profiles")
    .update({ temp_recovery_pass: tempPassword, last_password_change_at: null })
    .eq("id", id);
  if (error) throw new Error(error.message);

  refresh();
  return { tempPassword };
}

export async function createAdminWithCredentials(input: {
  fullName: string;
  email: string;
  role: AdminRole;
  password?: string;
}) {
  const { supabase, role: actorRole, user } = await requireOpsAdmin();
  const targetRole = input.role;
  if (!canManageRole(actorRole, targetRole)) {
    throw new Error("You cannot assign that admin role.");
  }

  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();
  if (!email) throw new Error("Email is required.");
  if (!fullName) throw new Error("Name is required.");

  const tempPassword = input.password?.trim() || generateTempPassword();
  if (tempPassword.length < 8) throw new Error("Use at least 8 characters for the password.");

  const createdBy = await resolveCreatedBy(supabase, user.id);

  const { data: existingProfile } = await supabase.from("profiles").select("id").ilike("email", email).maybeSingle();
  let userId = existingProfile?.id as string | undefined;
  let createdNewAuthUser = false;

  if (!userId) {
    const { data: listed } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
    const existingAuth = listed?.users?.find((item) => (item.email || "").toLowerCase() === email);
    if (existingAuth) {
      userId = existingAuth.id;
      const { error: passwordError } = await supabase.auth.admin.updateUserById(userId, {
        password: tempPassword,
        user_metadata: { full_name: fullName },
      });
      if (passwordError) throw new Error(passwordError.message);
    } else {
      const { data: created, error: createError } = await supabase.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });
      if (createError || !created.user) {
        throw new Error(createError?.message ?? "Could not create admin auth user.");
      }
      userId = created.user.id;
      createdNewAuthUser = true;
    }
  } else {
    const { error: passwordError } = await supabase.auth.admin.updateUserById(userId, {
      password: tempPassword,
      user_metadata: { full_name: fullName },
    });
    if (passwordError) throw new Error(passwordError.message);
  }

  const adminPayload: Record<string, unknown> = {
    id: userId,
    email,
    role: targetRole,
    updated_at: new Date().toISOString(),
  };
  if (createdBy) adminPayload.created_by = createdBy;

  const { error: adminError } = await supabase.from("admin_users").upsert(adminPayload);
  if (adminError) {
    if (createdNewAuthUser) await supabase.auth.admin.deleteUser(userId);
    throw new Error(adminError.message);
  }

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: userId,
    full_name: fullName,
    email,
    role: targetRole === "worker_admin" ? "worker_admin" : "admin",
    is_approved: true,
    onboarding_status: "approved",
    status: "active",
    temp_recovery_pass: tempPassword,
    token_balance: targetRole === "worker_admin" ? 50 : 0,
  });
  if (profileError) throw new Error(profileError.message);

  if (targetRole === "worker_admin") {
    const now = new Date().toISOString();
    const workerAdminPayload: Record<string, unknown> = {
      worker_id: userId,
      email,
      full_name: fullName,
      status: "active",
      temp_recovery_pass: tempPassword,
      updated_at: now,
    };
    if (createdBy) workerAdminPayload.created_by = createdBy;
    const { error: workerAdminError } = await supabase.from("worker_admins").upsert(workerAdminPayload);
    if (workerAdminError) {
      const legacyPayload: Record<string, unknown> = {
        worker_id: userId,
        email,
        full_name: fullName,
        updated_at: now,
      };
      if (createdBy) legacyPayload.created_by = createdBy;
      const legacy = await supabase.from("worker_admins").upsert(legacyPayload);
      if (legacy.error) throw new Error(legacy.error.message);
    }
  }

  refresh();
  return { email, tempPassword, userId, role: targetRole, fullName };
}

/** @deprecated Use createAdminWithCredentials */
export async function addAdminUser(input: { email: string; role: AdminRole; userId?: string; fullName?: string }) {
  return createAdminWithCredentials({
    email: input.email,
    role: input.role,
    fullName: input.fullName || input.email.split("@")[0] || "Admin",
  });
}

export async function removeAdminUser(adminId: string) {
  const { supabase, role: actorRole } = await requireOpsAdmin();
  const { data: target } = await supabase.from("admin_users").select("id, role").eq("id", adminId).maybeSingle();
  const { data: workerAdminRow } = await supabase
    .from("worker_admins")
    .select("worker_id")
    .eq("worker_id", adminId)
    .maybeSingle();

  const targetRole = (target?.role as AdminRole | undefined) ?? (workerAdminRow ? "worker_admin" : null);
  if (!targetRole) throw new Error("Admin not found.");
  if (!canManageRole(actorRole, targetRole)) {
    throw new Error("You cannot remove that admin.");
  }
  if (targetRole === "super_admin") throw new Error("Super admins cannot be removed this way.");

  if (target) {
    const { error } = await supabase.from("admin_users").delete().eq("id", adminId);
    if (error) throw new Error(error.message);
  }
  if (targetRole === "worker_admin") {
    await supabase.from("worker_admins").delete().eq("worker_id", adminId);
    await supabase.from("profiles").update({ role: "worker" }).eq("id", adminId);
  }
  refresh();
}
