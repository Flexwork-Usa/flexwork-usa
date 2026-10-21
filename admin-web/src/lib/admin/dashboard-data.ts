import { unstable_cache } from "next/cache";
import { cache } from "react";
import { ADMIN_DASHBOARD_TAG, ADMIN_DATA_REVALIDATE_SECONDS } from "@/lib/admin/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapPayoutRequestRow } from "@/lib/platform/payouts";
import {
  jobHiringStatus,
  jobMinTokens,
  jobTags,
  parseApplicantExtras,
  parsePayAmount,
  payTypeFromRate,
  visibleJobTags,
} from "@/lib/platform/rules";
import type {
  AdminAccount,
  AdminRole,
  AnalyticsBundle,
  ApplicationStatus,
  LeaderboardEntry,
  ManagedJob,
  ManagedWorker,
  PlatformApplicationRow,
  PayoutRequest,
  TreasuryDeposit,
  WorkerStatus,
} from "@/lib/platform/types";
import type { PendingApplication } from "@/lib/admin/types";

export type AdminDashboardBundle = {
  applications: PendingApplication[];
  platformApplications: PlatformApplicationRow[];
  workers: ManagedWorker[];
  treasuryDeposits: TreasuryDeposit[];
  jobs: ManagedJob[];
  leaderboard: LeaderboardEntry[];
  payouts: PayoutRequest[];
  admins: AdminAccount[];
  analytics: AnalyticsBundle;
  currentRole: AdminRole;
};

/** Request-deduped + cross-request cached dashboard bundle for fast page hops. */
export const getAdminDashboardData = cache(async (currentRole: AdminRole = "super_admin") => {
  return unstable_cache(
    () => loadAdminDashboardData(currentRole),
    ["admin-dashboard-bundle", currentRole],
    { revalidate: ADMIN_DATA_REVALIDATE_SECONDS, tags: [ADMIN_DASHBOARD_TAG] },
  )();
});

async function loadAdminDashboardData(currentRole: AdminRole): Promise<AdminDashboardBundle> {
  const supabase = createAdminClient();
  // Do not block the main query fan-out on expiry maintenance.
  void supabase.rpc("expire_treasury_deposits").then(
    () => undefined,
    () => undefined,
  );

  const [
    applicationsResult,
    platformAppsResult,
    workersResult,
    depositsResult,
    jobsResult,
    leaderboardResult,
    appCountsResult,
    payoutsResult,
    adminsResult,
    workerAdminsResult,
    funnelResult,
    dailyResult,
  ] = await Promise.all([
    supabase
      .from("onboarding_applications")
      .select("id, full_name, email, country, phone_number, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
    supabase
      .from("applications")
      .select("*")
      .order("tokens_staked", { ascending: false })
      .limit(200),
    supabase
      .from("profiles")
      .select(
        "id, full_name, email, country, token_balance, status, role, total_earnings, total_tokens_spent, temp_recovery_pass",
      )
      .eq("role", "worker")
      .order("created_at", { ascending: false }),
    supabase.from("treasury_deposits").select("*").order("created_at", { ascending: false }).limit(100),
    supabase
      .from("jobs")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase.from("leaderboard").select("*").order("rank_order", { ascending: true }).limit(50),
    supabase.from("applications").select("job_id, worker_id, tokens_staked"),
    supabase.from("payout_requests").select("*").order("created_at", { ascending: false }).limit(100),
    supabase.from("admin_users").select("id, email, role, created_at").order("created_at", { ascending: true }),
    supabase
      .from("worker_admins")
      .select("worker_id, email, full_name, created_by, created_at, updated_at")
      .order("created_at", { ascending: true }),
    supabase.from("admin_pipeline_funnel").select("status, count"),
    supabase.from("admin_daily_activity").select("day, jobs_applied, payouts"),
  ]);

  let workersData = workersResult.data;
  if (workersResult.error) {
    const legacy = await supabase
      .from("profiles")
      .select("id, full_name, email, country, token_balance, role")
      .eq("role", "worker")
      .order("created_at", { ascending: false });
    if (legacy.error) throw new Error(legacy.error.message);
    workersData = (legacy.data ?? []).map((row) => ({
      ...row,
      status: "active",
      role: row.role ?? "worker",
      total_earnings: 0,
      total_tokens_spent: 0,
      temp_recovery_pass: null,
    }));
  }

  let platformAppsData = platformAppsResult.data;
  if (platformAppsResult.error) {
    const legacyApps = await supabase
      .from("applications")
      .select("id, job_id, worker_id, tokens_staked, status, created_at, updated_at, applicant_name, applicant_email, applicant_country, cover_letter, cv_url, portfolio_url")
      .order("tokens_staked", { ascending: false })
      .limit(200);
    if (!legacyApps.error) platformAppsData = legacyApps.data;
  }

  let jobsData = jobsResult.data;
  if (jobsResult.error) {
    const live = await supabase
      .from("jobs")
      .select("id, title, brief_description, full_description, pay_rate, tags, slots_needed, created_at")
      .order("created_at", { ascending: false });
    if (live.error) throw new Error(live.error.message);
    jobsData = live.data;
  }

  if (applicationsResult.error) throw new Error(applicationsResult.error.message);

  const jobCounts = new Map<string, number>();
  const workerAppCounts = new Map<string, number>();
  const workerSpend = new Map<string, number>();
  for (const row of appCountsResult.data ?? []) {
    const jobId = String((row as { job_id: string }).job_id);
    const workerId = String((row as { worker_id: string }).worker_id);
    const staked = Number((row as { tokens_staked?: number }).tokens_staked ?? 0);
    jobCounts.set(jobId, (jobCounts.get(jobId) ?? 0) + 1);
    workerAppCounts.set(workerId, (workerAppCounts.get(workerId) ?? 0) + 1);
    workerSpend.set(workerId, (workerSpend.get(workerId) ?? 0) + staked);
  }

  const nameById = new Map((workersData ?? []).map((row) => [row.id, row.full_name || row.email || "Worker"]));
  for (const row of workerAdminsResult.error ? [] : workerAdminsResult.data ?? []) {
    nameById.set(String(row.worker_id), row.full_name || row.email || "Worker Admin");
  }

  const jobs: ManagedJob[] = (jobsData ?? []).map((row) => {
    const jobRow = row as {
      id: string;
      title: string;
      company?: string | null;
      category?: string | null;
      description?: string | null;
      brief_description?: string | null;
      full_description?: string | null;
      tags?: unknown;
      min_tokens?: number | null;
      token_cost?: number | null;
      pay_type?: string | null;
      pay_rate?: string | number | null;
      slots_needed?: number | null;
      hiring_status?: string | null;
      is_active?: boolean | null;
      created_at?: string | null;
    };
    const applicationCount = jobCounts.get(String(jobRow.id)) ?? 0;
    const createdAt = jobRow.created_at ?? new Date().toISOString();
    const slotsNeeded = jobRow.slots_needed ?? 10;
    const computed = jobTags({ createdAt, slotsNeeded, applicationCount });
    const payLabel = String(jobRow.pay_rate || "");
    const payRate = parsePayAmount(jobRow.pay_rate);
    const brief = String(jobRow.brief_description || jobRow.description || "");
    const full = String(jobRow.full_description || jobRow.description || "");
    const hiringStatus = jobHiringStatus(jobRow);
    return {
      id: String(jobRow.id),
      title: jobRow.title,
      company: String(jobRow.company || "flexwork-usa"),
      category: jobRow.category ?? "General",
      description: brief,
      briefDescription: brief,
      fullDescription: full,
      tags: visibleJobTags(jobRow.tags),
      minTokens: jobMinTokens(jobRow),
      payType: (jobRow.pay_type as "hourly" | "quota") ?? payTypeFromRate(payLabel),
      payRate,
      payLabel: payLabel || (jobRow.pay_type === "quota" ? `$${payRate} / quota` : `$${payRate}/hr`),
      slotsNeeded,
      hiringStatus,
      createdAt,
      applicationCount,
      isNew: computed.isNew,
      isHighDemand: computed.isHighDemand,
    };
  });

  const funnelStatuses = ["submitted", "viewed", "under_review", "hired", "rejected"];
  const funnelMap = new Map((funnelResult.data ?? []).map((row) => [String(row.status), Number(row.count)]));

  const workerAdminIds = new Set(
    (workerAdminsResult.error ? [] : workerAdminsResult.data ?? []).map((row) => String(row.worker_id)),
  );

  // Regular workers only — never mix public.worker_admins into the Workers table
  const regularWorkers = (workersData ?? []).filter((row) => !workerAdminIds.has(String(row.id)));

  const opsAdmins: AdminAccount[] = (adminsResult.error ? [] : adminsResult.data ?? [])
    .filter((row) => row.role !== "worker_admin")
    .map((row) => ({
      id: row.id,
      email: row.email,
      fullName: null,
      role: (row.role as AdminRole) ?? "admin",
      status: "active" as WorkerStatus,
      tempRecoveryPass: null,
      createdAt: row.created_at,
      createdBy: null,
    }));

  const jobTitleById = new Map((jobsData ?? []).map((row) => [String(row.id), row.title]));
  const profileNameById = new Map(
    (workersData ?? []).map((row) => [String(row.id), { name: row.full_name || row.email || "Worker", email: row.email }]),
  );
  for (const row of workerAdminsResult.error ? [] : workerAdminsResult.data ?? []) {
    profileNameById.set(String(row.worker_id), {
      name: row.full_name || row.email || "Worker Admin",
      email: row.email,
    });
  }

  const platformApplications: PlatformApplicationRow[] = (platformAppsData ?? []).map((row) => {
    const worker = profileNameById.get(String(row.worker_id));
    const extra = row as {
      applicant_name?: string | null;
      applicant_email?: string | null;
      applicant_country?: string | null;
      email?: string | null;
      country?: string | null;
      cover_letter?: string | null;
      cv_url?: string | null;
      portfolio_url?: string | null;
      created_at?: string | null;
      submitted_at?: string | null;
      updated_at?: string | null;
    };
    const parsed = parseApplicantExtras(extra.cover_letter);
    return {
      id: String(row.id),
      jobId: String(row.job_id),
      jobTitle: jobTitleById.get(String(row.job_id)) || "Platform job",
      workerId: String(row.worker_id),
      workerName: extra.applicant_name || worker?.name || "Worker",
      workerEmail: extra.applicant_email || extra.email || parsed.email || worker?.email || null,
      country: extra.applicant_country || extra.country || parsed.country || null,
      coverLetter: parsed.coverLetter || extra.cover_letter || null,
      cvUrl: extra.cv_url || null,
      portfolioUrl: extra.portfolio_url || null,
      tokensStaked: Number(row.tokens_staked ?? 0),
      status: (row.status as ApplicationStatus) ?? "submitted",
      submittedAt: String(extra.submitted_at || extra.created_at || extra.updated_at || ""),
    };
  });

  return {
    applications: (applicationsResult.data ?? []).map((row) => ({
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      country: row.country,
      phoneNumber: row.phone_number,
      createdAt: row.created_at,
    })),
    platformApplications,
    workers: regularWorkers.map((row) => ({
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      country: row.country,
      tokenBalance: Number(row.token_balance ?? 0),
      status: (row.status as WorkerStatus) ?? "active",
      jobsApplied: workerAppCounts.get(row.id) ?? 0,
      totalTokensSpent: Number(row.total_tokens_spent ?? workerSpend.get(row.id) ?? 0),
      totalEarnings: Number(row.total_earnings ?? 0),
      isWorkerAdmin: false,
      tempRecoveryPass: (row as { temp_recovery_pass?: string | null }).temp_recovery_pass ?? null,
    })),
    treasuryDeposits: depositsResult.error
      ? []
      : (depositsResult.data ?? []).map((row) => ({
          id: row.id,
          workerId: row.worker_id,
          usdtAmount: Number(row.usdt_amount),
          tokensIssued: Number(row.tokens_issued),
          depositAddress: row.deposit_address,
          memoCode: row.memo_code,
          txHash: row.tx_hash ?? row.transaction_hash ?? null,
          status: row.status,
          expiresAt: row.expires_at,
          createdAt: row.created_at,
          network:
            row.network === "TRC20" || row.network === "BEP20" || row.network === "ERC20"
              ? row.network
              : undefined,
        })),
    jobs,
    leaderboard: leaderboardResult.error
      ? []
      : (leaderboardResult.data ?? []).map((row) => ({
          id: row.id,
          workerName: row.worker_name,
          emailMasked: row.email_masked,
          country: row.country,
          skill: row.skill,
          totalEarnings: Number(row.total_earnings),
          rankOrder: row.rank_order,
        })),
    payouts: payoutsResult.error
      ? []
      : (payoutsResult.data ?? []).map((row) => {
          const workerId = String(row.worker_id);
          const profile = profileNameById.get(workerId);
          return mapPayoutRequestRow(row as Record<string, unknown>, {
            name: profile?.name || nameById.get(row.worker_id) || nameById.get(workerId) || "Worker",
            email: profile?.email ?? null,
          });
        }),
    admins: opsAdmins,
    analytics: {
      daily: dailyResult.error
        ? []
        : (dailyResult.data ?? []).map((row) => ({
            day: String(row.day).slice(0, 10),
            jobsApplied: Number(row.jobs_applied ?? 0),
            payouts: Number(row.payouts ?? 0),
          })),
      funnel: funnelStatuses.map((status) => ({ status, count: funnelMap.get(status) ?? 0 })),
    },
    currentRole,
  };
}

