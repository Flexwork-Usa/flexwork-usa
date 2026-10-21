import { primarySubcategory } from "@/lib/jobs/categories";
import { jobHiringStatus, jobMinTokens, jobTags, visibleJobTags } from "@/lib/platform/rules";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { JobRow, MarketplaceJob } from "@/lib/jobs/types";

const JOB_SELECT_LIVE = "id, title, brief_description, full_description, pay_rate, tags, slots_needed, created_at";

function asTier(value: string | number | null | undefined): 1 | 2 | 3 {
  const text = String(value ?? "").trim().toLowerCase();
  if (text === "2" || text === "affiliate") return 2;
  if (text === "3" || text === "third_party" || text === "third-party") return 3;
  return 1;
}

function partnerFrom(company: string, title: string, externalUrl: string | null) {
  const blob = `${company} ${title} ${externalUrl ?? ""}`.toLowerCase();
  if (blob.includes("outlier")) {
    return {
      platform: "outlier" as const,
      platformUrl: externalUrl || "https://outlier.ai/",
    };
  }
  if (blob.includes("handshake")) {
    return {
      platform: "handshake" as const,
      platformUrl: externalUrl || "https://ai.joinhandshake.com/get-started",
    };
  }
  return { platform: null, platformUrl: externalUrl };
}

export function mapJob(row: JobRow, applicationCount = 0): MarketplaceJob {
  const brief = row.brief_description || row.description || "";
  const full = row.full_description || row.description || "";
  const company = row.company || "flexwork-usa";
  const partner = partnerFrom(company, row.title, row.external_url ?? null);
  const placement = primarySubcategory(`${row.title} ${brief} ${full}`);
  const createdAt = row.created_at ?? new Date(0).toISOString();
  const slotsNeeded = row.slots_needed ?? 10;
  const tags = jobTags({ createdAt, slotsNeeded, applicationCount });
  const minTokens = jobMinTokens(row);
  const storedTags = visibleJobTags(row.tags);
  return {
    id: row.id,
    title: row.title,
    company,
    tier: asTier(row.tier),
    summary: brief,
    fullDescription: full,
    pay: row.pay_rate,
    tokenCost: minTokens,
    minTokens,
    tags: storedTags.length
      ? storedTags
      : [...(tags.isNew ? ["New"] : []), ...(tags.isHighDemand ? ["Urgent"] : [])],
    category: placement?.subcategory.name ?? "General",
    categoryId: placement?.category.id ?? null,
    subcategoryId: placement?.subcategory.id ?? null,
    location: "Remote — United States",
    schedule: "Flexible",
    platform: partner.platform,
    platformUrl: partner.platformUrl,
    slotsNeeded,
    applicationCount,
    createdAt,
    isNew: tags.isNew,
    isHighDemand: tags.isHighDemand,
  };
}

function countFromEmbed(value: unknown): number | null {
  if (Array.isArray(value) && value[0] && typeof (value[0] as { count?: number }).count === "number") {
    return Number((value[0] as { count: number }).count);
  }
  if (value && typeof value === "object" && typeof (value as { count?: number }).count === "number") {
    return Number((value as { count: number }).count);
  }
  return null;
}

async function applicationCountsByJobId(): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  try {
    const admin = createAdminClient();
    const embedded = await admin.from("jobs").select("id, applications(count)");
    if (!embedded.error) {
      for (const row of embedded.data ?? []) {
        counts.set(String((row as { id: string }).id), countFromEmbed((row as { applications?: unknown }).applications) ?? 0);
      }
      return counts;
    }

    const { data: apps, error } = await admin.from("applications").select("job_id");
    if (error) return counts;
    for (const row of apps ?? []) {
      const id = String((row as { job_id: string }).job_id || "");
      if (!id) continue;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  } catch {
    // applications table or FK may not exist yet
  }
  return counts;
}

export async function getActiveJobs(): Promise<MarketplaceJob[]> {
  const supabase = await createServerSupabaseClient();
  let data: JobRow[] | null = null;
  const allRows = await supabase.from("jobs").select("*").order("created_at", { ascending: false }).returns<JobRow[]>();
  if (allRows.error) {
    const live = await supabase.from("jobs").select(JOB_SELECT_LIVE).order("created_at", { ascending: false }).returns<JobRow[]>();
    if (live.error) throw new Error(live.error.message);
    data = live.data;
  } else {
    data = allRows.data;
  }

  const counts = await applicationCountsByJobId();

  return (data ?? [])
    .filter((row) => jobHiringStatus(row) === "hiring")
    .map((row) => mapJob(row, counts.get(String(row.id)) ?? 0));
}

export type WorkerApplicationWithJob = {
  id: string;
  job_id: string;
  worker_id: string;
  tokens_staked: number | null;
  status: string;
  created_at?: string | null;
  submitted_at?: string | null;
  cover_letter?: string | null;
  applicant_name?: string | null;
  cv_url?: string | null;
  portfolio_url?: string | null;
  jobs: JobRow | JobRow[] | null;
};

function isMissingRelationshipError(message: string | undefined) {
  const text = message ?? "";
  return /could not find a relationship/i.test(text) || /schema cache/i.test(text);
}

export function nestedJob(value: JobRow | JobRow[] | null | undefined): JobRow | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

async function applicationsForWorker(workerId: string) {
  const admin = createAdminClient();
  const byCreated = await admin
    .from("applications")
    .select("*")
    .eq("worker_id", workerId)
    .order("created_at", { ascending: false });
  if (!byCreated.error) return byCreated;
  return admin.from("applications").select("*").eq("worker_id", workerId).order("submitted_at", { ascending: false });
}

export async function getWorkerApplicationsWithJobs(workerId: string): Promise<WorkerApplicationWithJob[]> {
  const admin = createAdminClient();
  const embeds = [
    "*, jobs(*)",
    "*, jobs!job_id(*)",
    "*, jobs!applications_job_id_fkey(*)",
  ];

  for (const select of embeds) {
    const byCreated = await admin
      .from("applications")
      .select(select)
      .eq("worker_id", workerId)
      .order("created_at", { ascending: false });
    if (!byCreated.error) {
      return (byCreated.data ?? []) as unknown as WorkerApplicationWithJob[];
    }
    if (isMissingRelationshipError(byCreated.error.message)) continue;
    const bySubmitted = await admin
      .from("applications")
      .select(select)
      .eq("worker_id", workerId)
      .order("submitted_at", { ascending: false });
    if (!bySubmitted.error) {
      return (bySubmitted.data ?? []) as unknown as WorkerApplicationWithJob[];
    }
    if (isMissingRelationshipError(bySubmitted.error.message)) continue;
    throw new Error(bySubmitted.error.message);
  }

  const apps = await applicationsForWorker(workerId);
  if (apps.error) throw new Error(apps.error.message);

  const jobIds = [...new Set((apps.data ?? []).map((row) => String((row as { job_id?: string }).job_id || "")).filter(Boolean))];
  const jobsById = new Map<string, JobRow>();
  if (jobIds.length > 0) {
    const jobs = await admin.from("jobs").select("*").in("id", jobIds);
    const rows = jobs.error
      ? (await admin.from("jobs").select(JOB_SELECT_LIVE).in("id", jobIds)).data
      : jobs.data;
    for (const job of rows ?? []) jobsById.set(String((job as JobRow).id), job as JobRow);
  }

  return (apps.data ?? []).map((row) => {
    const app = row as WorkerApplicationWithJob;
    return {
      ...app,
      jobs: jobsById.get(String(app.job_id)) ?? null,
    };
  });
}

export async function getMyAppliedJobIds(): Promise<string[]> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const ids = new Set<string>();
  const admin = createAdminClient();
  const byWorker = await admin
    .from("job_applications")
    .select("job_id")
    .eq("worker_id", user.id)
    .returns<Array<{ job_id: string | null }>>();
  const byUser =
    byWorker.error
      ? await admin
          .from("job_applications")
          .select("job_id")
          .eq("user_id", user.id)
          .returns<Array<{ job_id: string | null }>>()
      : byWorker;
  if (!byUser.error) {
    for (const row of byUser.data ?? []) if (row.job_id) ids.add(row.job_id);
  }

  const staked = await admin.from("applications").select("job_id").eq("worker_id", user.id);
  if (!staked.error) {
    for (const row of staked.data ?? []) {
      const id = String((row as { job_id: string }).job_id || "");
      if (id) ids.add(id);
    }
  }

  return [...ids];
}
