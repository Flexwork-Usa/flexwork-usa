import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isRestrictedStatus, parsePayAmount, payTypeFromRate } from "@/lib/platform/rules";
import type { ActiveProject } from "@/lib/platform/types";

export async function loadHiredProject(applicationId: string): Promise<
  | { ok: true; project: ActiveProject; userId: string; isWorkerAdmin: boolean; restricted: boolean }
  | { ok: false; error: string; status: 401 | 403 | 404; restricted?: boolean }
> {
  const id = applicationId.trim();
  if (!id) return { ok: false, error: "Missing project id.", status: 404 };

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in required.", status: 401 };

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("status").eq("id", user.id).maybeSingle();
  if (isRestrictedStatus(profile?.status)) {
    return {
      ok: false,
      error: "Your account is restricted. Contact support to restore project access.",
      status: 403,
      restricted: true,
    };
  }

  const embedded = await admin
    .from("applications")
    .select("id, job_id, worker_id, status, jobs(*)")
    .eq("id", id)
    .maybeSingle();
  const application = embedded.error
    ? (
        await admin
          .from("applications")
          .select("id, job_id, worker_id, status")
          .eq("id", id)
          .maybeSingle()
      ).data
    : embedded.data;
  const error = embedded.error && !application ? embedded.error : null;

  if (error) return { ok: false, error: error.message, status: 404 };
  if (!application) return { ok: false, error: "Project not found.", status: 404 };
  if (application.worker_id !== user.id) return { ok: false, error: "Not your project.", status: 403 };
  if (application.status !== "hired") {
    return { ok: false, error: "This application is not hired yet.", status: 403 };
  }

  const nested = (application as { jobs?: unknown }).jobs;
  let job = Array.isArray(nested) ? nested[0] : nested;
  if (!job) {
    const enrichedJob = await admin
      .from("jobs")
      .select("id, title, company, pay_type, pay_rate, description, brief_description, full_description")
      .eq("id", application.job_id)
      .maybeSingle();
    job = enrichedJob.error
      ? (
          await admin
            .from("jobs")
            .select("id, title, pay_rate, brief_description, full_description")
            .eq("id", application.job_id)
            .maybeSingle()
        ).data
      : enrichedJob.data;
  }

  const { data: workerAdmin } = await admin
    .from("worker_admins")
    .select("worker_id")
    .eq("worker_id", user.id)
    .maybeSingle();

  return {
    ok: true,
    userId: user.id,
    isWorkerAdmin: Boolean(workerAdmin?.worker_id),
    restricted: false,
    project: {
      id: String(application.id),
      jobId: String(application.job_id),
      jobTitle: job?.title || "Platform job",
      company: (job as { company?: string | null } | null)?.company || "flexwork-usa",
      payType: ((job as { pay_type?: string | null } | null)?.pay_type as "hourly" | "quota") || payTypeFromRate(String(job?.pay_rate || "")),
      payRate: parsePayAmount(job?.pay_rate),
      status: "hired",
      deadlineAt: null,
      datasetPreview:
        (job as { full_description?: string | null; brief_description?: string | null; description?: string | null } | null)
          ?.full_description ||
        (job as { brief_description?: string | null } | null)?.brief_description ||
        (job as { description?: string | null } | null)?.description ||
        null,
    },
  };
}
