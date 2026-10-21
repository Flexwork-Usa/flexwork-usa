"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type WorkspaceResult = { success: true; elapsedSeconds?: number; logId?: string } | { success: false; error: string };

async function requireWorker(): Promise<
  | { ok: true; user: { id: string }; admin: ReturnType<typeof createAdminClient> }
  | { ok: false; error: string }
> {
  const session = await createServerSupabaseClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) return { ok: false, error: "You need to sign in." };
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("status").eq("id", user.id).maybeSingle();
  if (profile?.status && profile.status !== "active") {
    return { ok: false, error: "Your account is restricted. Contact support." };
  }
  return { ok: true, user, admin };
}

export async function startHourlySession(input: {
  applicationId: string;
  jobId?: string | null;
}): Promise<WorkspaceResult> {
  const ctx = await requireWorker();
  if (!ctx.ok) return { success: false, error: ctx.error };
  const { user, admin } = ctx;

  const { data: existing } = await admin
    .from("hourly_work_logs")
    .select("*")
    .eq("application_id", input.applicationId)
    .eq("worker_id", user.id)
    .eq("is_running", true)
    .maybeSingle();
  if (existing) {
    return { success: true, elapsedSeconds: existing.elapsed_seconds, logId: existing.id };
  }

  const { data: prior } = await admin
    .from("hourly_work_logs")
    .select("*")
    .eq("application_id", input.applicationId)
    .eq("worker_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (prior && !prior.is_running) {
    const { data: resumed, error } = await admin
      .from("hourly_work_logs")
      .update({
        is_running: true,
        started_at: new Date().toISOString(),
        last_heartbeat_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", prior.id)
      .select("*")
      .single();
    if (error || !resumed) return { success: false, error: error?.message ?? "Could not resume timer." };
    revalidatePath("/dashboard");
    revalidatePath("/worker-admin/dashboard");
    return { success: true, elapsedSeconds: resumed.elapsed_seconds, logId: resumed.id };
  }

  const { data: created, error } = await admin
    .from("hourly_work_logs")
    .insert({
      application_id: input.applicationId,
      worker_id: user.id,
      job_id: input.jobId || null,
      is_running: true,
      elapsed_seconds: 0,
    })
    .select("*")
    .single();
  if (error || !created) return { success: false, error: error?.message ?? "Could not start timer." };
  revalidatePath("/dashboard");
  revalidatePath("/worker-admin/dashboard");
  return { success: true, elapsedSeconds: 0, logId: created.id };
}

export async function pauseHourlySession(input: {
  logId: string;
  elapsedSeconds: number;
  idleWarning?: boolean;
}): Promise<WorkspaceResult> {
  const ctx = await requireWorker();
  if (!ctx.ok) return { success: false, error: ctx.error };
  const { user, admin } = ctx;

  const { data: log } = await admin
    .from("hourly_work_logs")
    .select("*")
    .eq("id", input.logId)
    .eq("worker_id", user.id)
    .maybeSingle();
  if (!log) return { success: false, error: "Work session not found." };

  const elapsed = Math.max(Number(log.elapsed_seconds) || 0, Math.floor(input.elapsedSeconds));
  const { error } = await admin
    .from("hourly_work_logs")
    .update({
      is_running: false,
      elapsed_seconds: elapsed,
      ended_at: new Date().toISOString(),
      last_heartbeat_at: new Date().toISOString(),
      idle_warnings: Number(log.idle_warnings ?? 0) + (input.idleWarning ? 1 : 0),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.logId);
  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard");
  revalidatePath("/worker-admin/dashboard");
  return { success: true, elapsedSeconds: elapsed, logId: input.logId };
}

export async function heartbeatHourlySession(input: {
  logId: string;
  elapsedSeconds: number;
}): Promise<WorkspaceResult> {
  const ctx = await requireWorker();
  if (!ctx.ok) return { success: false, error: ctx.error };
  const { user, admin } = ctx;

  const elapsed = Math.max(0, Math.floor(input.elapsedSeconds));
  const { error } = await admin
    .from("hourly_work_logs")
    .update({
      elapsed_seconds: elapsed,
      last_heartbeat_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.logId)
    .eq("worker_id", user.id)
    .eq("is_running", true);
  if (error) return { success: false, error: error.message };
  return { success: true, elapsedSeconds: elapsed, logId: input.logId };
}

export async function submitQuotaDeliverable(input: {
  applicationId: string;
  jobId?: string | null;
  deliverableText: string;
  deadlineAt?: string | null;
}): Promise<WorkspaceResult> {
  const ctx = await requireWorker();
  if (!ctx.ok) return { success: false, error: ctx.error };
  const { user, admin } = ctx;

  const text = input.deliverableText.trim();
  if (!text) return { success: false, error: "Add your deliverable before submitting." };

  const { error } = await admin.from("quota_submissions").insert({
    application_id: input.applicationId,
    worker_id: user.id,
    job_id: input.jobId || null,
    deliverable_text: text,
    deadline_at: input.deadlineAt || null,
    status: "submitted",
  });
  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard");
  revalidatePath("/worker-admin/dashboard");
  return { success: true };
}
