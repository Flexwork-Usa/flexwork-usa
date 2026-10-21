"use server";

import { revalidatePath } from "next/cache";
import { invalidateAdminCaches } from "@/lib/admin/cache";
import { canManageRole } from "@/lib/platform/rules";
import type { AdminRole, WorkerStatus } from "@/lib/platform/types";
import { generateTempPassword, verifyAdmin } from "@/lib/supabase/admin";

function refreshAccounts() {
  invalidateAdminCaches();
  revalidatePath("/super-admin");
  revalidatePath("/super-admin/admins");
  revalidatePath("/super-admin/worker-admins");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/admins");
  revalidatePath("/dashboard/worker-admins");
  revalidatePath("/console/v1/x9q7");
}

async function requireOpsAdmin() {
  const ctx = await verifyAdmin();
  const role = (ctx.adminUser.role as AdminRole) ?? "admin";
  if (role !== "super_admin" && role !== "admin") {
    throw new Error("Only super admins and admins can manage accounts.");
  }
  return { ...ctx, role };
}

async function requireSuperAdmin() {
  const ctx = await requireOpsAdmin();
  if (ctx.role !== "super_admin") {
    throw new Error("Only the Super Admin can manage 2nd-tier Admins.");
  }
  return ctx;
}

async function resolveCreatedBy(
  supabase: Awaited<ReturnType<typeof requireOpsAdmin>>["supabase"],
  actorId: string,
) {
  const { data } = await supabase.from("admin_users").select("id").eq("id", actorId).maybeSingle();
  return data?.id ?? null;
}

async function provisionAuthUser(
  supabase: Awaited<ReturnType<typeof requireOpsAdmin>>["supabase"],
  input: { email: string; fullName: string; tempPassword: string },
) {
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .ilike("email", input.email)
    .maybeSingle();

  let userId = existingProfile?.id as string | undefined;
  let createdNewAuthUser = false;

  if (!userId) {
    const { data: listed } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
    const existingAuth = listed?.users?.find((item) => (item.email || "").toLowerCase() === input.email);
    if (existingAuth) {
      userId = existingAuth.id;
      const { error: passwordError } = await supabase.auth.admin.updateUserById(userId, {
        password: input.tempPassword,
        user_metadata: { full_name: input.fullName },
      });
      if (passwordError) throw new Error(passwordError.message);
    } else {
      const { data: created, error: createError } = await supabase.auth.admin.createUser({
        email: input.email,
        password: input.tempPassword,
        email_confirm: true,
        user_metadata: { full_name: input.fullName },
      });
      if (createError || !created.user) {
        throw new Error(createError?.message ?? "Could not create auth user.");
      }
      userId = created.user.id;
      createdNewAuthUser = true;
    }
  } else {
    const { error: passwordError } = await supabase.auth.admin.updateUserById(userId, {
      password: input.tempPassword,
      user_metadata: { full_name: input.fullName },
    });
    if (passwordError) throw new Error(passwordError.message);
  }

  return { userId, createdNewAuthUser };
}

function upsertWorkerAdminRow(
  supabase: Awaited<ReturnType<typeof requireOpsAdmin>>["supabase"],
  payload: {
    workerId: string;
    email: string;
    fullName: string;
    tempPassword: string;
    createdBy: string | null;
    status?: WorkerStatus;
  },
) {
  const now = new Date().toISOString();
  const fullPayload = {
    worker_id: payload.workerId,
    email: payload.email,
    full_name: payload.fullName,
    status: payload.status ?? "active",
    temp_recovery_pass: payload.tempPassword,
    updated_at: now,
    ...(payload.createdBy ? { created_by: payload.createdBy } : {}),
  };

  return supabase.from("worker_admins").upsert(fullPayload).then(async (result) => {
    if (!result.error) return result;
    // Schema cache / pre-migration fallback: omit status + temp_recovery_pass
    const legacyPayload = {
      worker_id: payload.workerId,
      email: payload.email,
      full_name: payload.fullName,
      updated_at: now,
      ...(payload.createdBy ? { created_by: payload.createdBy } : {}),
    };
    return supabase.from("worker_admins").upsert(legacyPayload);
  });
}

export async function createWorkerAdminAccount(input: {
  fullName: string;
  email: string;
  password?: string;
}) {
  const { supabase, role: actorRole, user } = await requireOpsAdmin();
  if (!canManageRole(actorRole, "worker_admin")) {
    throw new Error("You cannot create Worker Admins.");
  }

  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();
  if (!email) throw new Error("Email is required.");
  if (!fullName) throw new Error("Name is required.");

  const tempPassword = input.password?.trim() || generateTempPassword();
  if (tempPassword.length < 8) throw new Error("Use at least 8 characters for the password.");

  const createdBy = await resolveCreatedBy(supabase, user.id);
  const { userId, createdNewAuthUser } = await provisionAuthUser(supabase, {
    email,
    fullName,
    tempPassword,
  });

  const adminPayload: Record<string, unknown> = {
    id: userId,
    email,
    role: "worker_admin",
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
    role: "worker_admin",
    is_approved: true,
    onboarding_status: "approved",
    status: "active",
    temp_recovery_pass: tempPassword,
    token_balance: 50,
  });
  if (profileError) throw new Error(profileError.message);

  const workerAdminResult = await upsertWorkerAdminRow(supabase, {
    workerId: userId,
    email,
    fullName,
    tempPassword,
    createdBy,
    status: "active",
  });
  if (workerAdminResult.error) throw new Error(workerAdminResult.error.message);

  refreshAccounts();
  return { email, tempPassword, userId, fullName, role: "worker_admin" as const };
}

export async function updateWorkerAdminStatus(workerId: string, status: WorkerStatus) {
  const { supabase, role: actorRole } = await requireOpsAdmin();
  if (!canManageRole(actorRole, "worker_admin")) {
    throw new Error("You cannot update Worker Admin status.");
  }
  if (!["active", "banned", "temp_disabled", "suspended", "under_review"].includes(status)) {
    throw new Error("Invalid status.");
  }

  const id = workerId.trim();
  const now = new Date().toISOString();

  const { error: profileError } = await supabase.from("profiles").update({ status }).eq("id", id);
  if (profileError) throw new Error(profileError.message);

  const withStatus = await supabase
    .from("worker_admins")
    .update({ status, updated_at: now })
    .eq("worker_id", id);
  if (withStatus.error) {
    const legacy = await supabase.from("worker_admins").update({ updated_at: now }).eq("worker_id", id);
    if (legacy.error) throw new Error(legacy.error.message);
  }

  refreshAccounts();
}

export async function resetWorkerAdminRecoveryPassword(workerId: string) {
  const { supabase, role: actorRole } = await requireOpsAdmin();
  if (!canManageRole(actorRole, "worker_admin")) {
    throw new Error("You cannot reset Worker Admin passwords.");
  }

  const id = workerId.trim();
  const tempPassword = generateTempPassword();
  const now = new Date().toISOString();

  const { error: authError } = await supabase.auth.admin.updateUserById(id, { password: tempPassword });
  if (authError) throw new Error(authError.message);

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ temp_recovery_pass: tempPassword, last_password_change_at: null })
    .eq("id", id);
  if (profileError) throw new Error(profileError.message);

  const withPass = await supabase
    .from("worker_admins")
    .update({ temp_recovery_pass: tempPassword, updated_at: now })
    .eq("worker_id", id);
  if (withPass.error) {
    const legacy = await supabase.from("worker_admins").update({ updated_at: now }).eq("worker_id", id);
    if (legacy.error) throw new Error(legacy.error.message);
  }

  refreshAccounts();
  return { tempPassword };
}

export async function removeWorkerAdminAccount(workerId: string) {
  const { supabase, role: actorRole } = await requireOpsAdmin();
  if (!canManageRole(actorRole, "worker_admin")) {
    throw new Error("You cannot remove Worker Admins.");
  }

  const id = workerId.trim();
  const { data: row } = await supabase.from("worker_admins").select("worker_id").eq("worker_id", id).maybeSingle();
  if (!row) throw new Error("Worker Admin not found.");

  await supabase.from("worker_admins").delete().eq("worker_id", id);
  await supabase.from("admin_users").delete().eq("id", id).eq("role", "worker_admin");
  await supabase
    .from("profiles")
    .update({ role: "worker", status: "active" })
    .eq("id", id);

  refreshAccounts();
}

export async function updateWorkerAdminMetrics(input: {
  workerId: string;
  pendingEarnings: number;
  earnedThisMonth: number;
  totalEarnings: number;
}) {
  const { supabase, role: actorRole } = await requireOpsAdmin();
  if (!canManageRole(actorRole, "worker_admin")) {
    throw new Error("You cannot edit Worker Admin metrics.");
  }

  const id = input.workerId.trim();
  if (!id) throw new Error("Worker Admin id is required.");

  const pendingEarnings = Math.max(0, Number(input.pendingEarnings) || 0);
  const earnedThisMonth = Math.max(0, Number(input.earnedThisMonth) || 0);
  const totalEarnings = Math.max(0, Number(input.totalEarnings) || 0);
  const now = new Date().toISOString();

  const { data: row } = await supabase.from("worker_admins").select("worker_id").eq("worker_id", id).maybeSingle();
  if (!row) throw new Error("Worker Admin not found.");

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      pending_earnings: pendingEarnings,
      earned_this_month: earnedThisMonth,
      total_earnings: totalEarnings,
    })
    .eq("id", id);
  if (profileError) throw new Error(profileError.message);

  const fullUpdate = await supabase
    .from("worker_admins")
    .update({
      pending_earnings: pendingEarnings,
      earned_this_month: earnedThisMonth,
      total_earnings: totalEarnings,
      updated_at: now,
    })
    .eq("worker_id", id);

  if (fullUpdate.error) {
    const legacy = await supabase.from("worker_admins").update({ updated_at: now }).eq("worker_id", id);
    if (legacy.error) throw new Error(fullUpdate.error.message);
  }

  refreshAccounts();
  return { pendingEarnings, earnedThisMonth, totalEarnings };
}

export async function createTierAdminAccount(input: {
  fullName: string;
  email: string;
  password?: string;
}) {
  const { supabase, user } = await requireSuperAdmin();

  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();
  if (!email) throw new Error("Email is required.");
  if (!fullName) throw new Error("Name is required.");

  const tempPassword = input.password?.trim() || generateTempPassword();
  if (tempPassword.length < 8) throw new Error("Use at least 8 characters for the password.");

  const createdBy = await resolveCreatedBy(supabase, user.id);
  const { userId, createdNewAuthUser } = await provisionAuthUser(supabase, {
    email,
    fullName,
    tempPassword,
  });

  const adminPayload: Record<string, unknown> = {
    id: userId,
    email,
    role: "admin",
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
    role: "admin",
    is_approved: true,
    onboarding_status: "approved",
    status: "active",
    temp_recovery_pass: tempPassword,
    token_balance: 0,
  });
  if (profileError) throw new Error(profileError.message);

  refreshAccounts();
  return { email, tempPassword, userId, fullName, role: "admin" as const };
}

export async function updateTierAdminRole(adminId: string, role: Extract<AdminRole, "admin" | "super_admin">) {
  const { supabase } = await requireSuperAdmin();
  if (role !== "admin" && role !== "super_admin") {
    throw new Error("Invalid admin role.");
  }

  const id = adminId.trim();
  const { data: target } = await supabase.from("admin_users").select("id, role").eq("id", id).maybeSingle();
  if (!target) throw new Error("Admin not found.");
  if (target.role === "worker_admin") throw new Error("Use the Worker Admins page for 3rd-tier accounts.");

  const { error } = await supabase
    .from("admin_users")
    .update({ role, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);

  // profiles.role stays "admin" for console operators; hierarchy lives on admin_users.role
  await supabase.from("profiles").update({ role: "admin" }).eq("id", id);

  refreshAccounts();
}

export async function updateTierAdminStatus(adminId: string, status: WorkerStatus) {
  const { supabase } = await requireSuperAdmin();
  if (!["active", "banned", "temp_disabled", "suspended", "under_review"].includes(status)) {
    throw new Error("Invalid status.");
  }

  const id = adminId.trim();
  const { data: target } = await supabase.from("admin_users").select("id, role").eq("id", id).maybeSingle();
  if (!target) throw new Error("Admin not found.");
  if (target.role === "super_admin") throw new Error("Cannot change Super Admin status this way.");
  if (target.role === "worker_admin") throw new Error("Use the Worker Admins page for 3rd-tier accounts.");

  const { error } = await supabase.from("profiles").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
  refreshAccounts();
}

export async function resetTierAdminRecoveryPassword(adminId: string) {
  const { supabase } = await requireSuperAdmin();
  const id = adminId.trim();

  const { data: target } = await supabase.from("admin_users").select("id, role").eq("id", id).maybeSingle();
  if (!target) throw new Error("Admin not found.");
  if (target.role === "worker_admin") throw new Error("Use the Worker Admins page for 3rd-tier accounts.");

  const tempPassword = generateTempPassword();
  const { error: authError } = await supabase.auth.admin.updateUserById(id, { password: tempPassword });
  if (authError) throw new Error(authError.message);

  const { error } = await supabase
    .from("profiles")
    .update({ temp_recovery_pass: tempPassword, last_password_change_at: null })
    .eq("id", id);
  if (error) throw new Error(error.message);

  refreshAccounts();
  return { tempPassword };
}

export async function removeTierAdminAccount(adminId: string) {
  const { supabase } = await requireSuperAdmin();
  const id = adminId.trim();

  const { data: target } = await supabase.from("admin_users").select("id, role").eq("id", id).maybeSingle();
  if (!target) throw new Error("Admin not found.");
  if (target.role === "super_admin") throw new Error("Super Admins cannot be removed this way.");
  if (target.role === "worker_admin") throw new Error("Use the Worker Admins page for 3rd-tier accounts.");

  const { error } = await supabase.from("admin_users").delete().eq("id", id);
  if (error) throw new Error(error.message);

  await supabase.from("profiles").update({ role: "worker", status: "active" }).eq("id", id);
  refreshAccounts();
}
