import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { DashboardSkeleton } from "@/components/dashboard/ShimmerCard";
import {
  WorkerDashboard,
  type WorkerApplication,
  type WorkerDeposit,
  type WorkerProfileView,
} from "@/components/worker/WorkerDashboard";
import { getJobLeaderboard } from "@/actions/application-actions";
import { getActiveJobs, getWorkerApplicationsWithJobs, nestedJob } from "@/lib/jobs/queries";
import type { MarketplaceJob } from "@/lib/jobs/types";
import type {
  ActiveProject,
  ApplicationStatus,
  JobBidLeaderboardRow,
  LeaderboardEntry,
  PayoutRequest,
  PlatformApplication,
  TreasuryDeposit,
} from "@/lib/platform/types";
import { mapPayoutRequestRow } from "@/lib/platform/payouts";
import { ACCOUNT_RESTRICTED_PATH } from "@/lib/auth/account-gate";
import { provisionWorkerProfile } from "@/lib/auth/provision-profile";
import { isRestrictedStatus, parsePayAmount, payTypeFromRate } from "@/lib/platform/rules";
import { isWorkerAdminAccount } from "@/lib/platform/worker-admins";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Dashboard · flexwork-usa",
};

type ProfileRow = {
  full_name: string | null;
  email: string | null;
  country?: string | null;
  phone_number: string | null;
  token_balance: number | null;
  status: string | null;
  onboarding_status: string | null;
  role: string | null;
  total_earnings: number | null;
  pending_earnings?: number | null;
  earned_this_month?: number | null;
  wallet_usdt_tron: string | null;
  wallet_usdt_eth: string | null;
  wallet_usdc_eth: string | null;
  payout_usdt_address?: string | null;
  payout_airtm_email?: string | null;
  payout_paypal_email?: string | null;
  payout_method?: string | null;
  is_approved: boolean | null;
};

type DepositRow = {
  id: string;
  plan_title: string;
  amount_usd: number | string;
  tokens_to_credit: number;
  wallet_type: string;
  transaction_hash: string;
  status: string;
  created_at: string;
};

type ApplicationRow = {
  id: string;
  job_id: string | null;
  status: string;
  created_at: string;
  tokens_staked?: number | null;
  tokens_spent?: number | null;
  jobs: { title: string; company: string | null } | { title: string; company: string | null }[] | null;
};

export default function WorkerDashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <WorkerDashboardContent variant="worker" />
    </Suspense>
  );
}

export async function WorkerDashboardContent({
  variant = "worker",
  initialTab,
}: {
  variant?: "worker" | "worker_admin";
  initialTab?: "overview" | "jobs" | "active" | "applied" | "tokens" | "payments" | "settings" | "support" | "topup";
} = {}) {
  await connection();

  let supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  try {
    supabase = await createServerSupabaseClient();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not reach Supabase.";
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900">{message}</p>
      </div>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await provisionWorkerProfile(user);

  let profile: ProfileRow | null = null;
  let profileError: { message: string } | null = null;
  const enrichedProfile = await supabase
    .from("profiles")
    .select(
      "full_name, email, country, phone_number, token_balance, status, onboarding_status, role, total_earnings, pending_earnings, earned_this_month, wallet_usdt_tron, wallet_usdt_eth, wallet_usdc_eth, payout_usdt_address, payout_airtm_email, payout_paypal_email, payout_method, is_approved",
    )
    .eq("id", user.id)
    .maybeSingle()
    .returns<ProfileRow>();
  if (enrichedProfile.error) {
    const legacy = await supabase
      .from("profiles")
      .select("full_name, email, phone_number, token_balance, role, total_earnings, wallet_usdt_tron, wallet_usdt_eth, wallet_usdc_eth, is_approved")
      .eq("id", user.id)
      .maybeSingle();
    if (legacy.error) profileError = legacy.error;
    else if (legacy.data) {
      profile = {
        ...legacy.data,
        country: "",
        status: "active",
        onboarding_status: legacy.data.is_approved ? "approved" : "pending_approval",
        role: legacy.data.role ?? "worker",
        total_earnings: Number(legacy.data.total_earnings ?? 0),
        pending_earnings: 0,
        earned_this_month: 0,
        payout_usdt_address: null,
        payout_airtm_email: null,
        payout_paypal_email: null,
        payout_method: null,
      };
    }
  } else {
    profile = enrichedProfile.data;
  }

  if (profileError) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <p className="text-sm text-red-700">{profileError.message}</p>
      </div>
    );
  }

  if (isRestrictedStatus(profile?.status)) {
    redirect(ACCOUNT_RESTRICTED_PATH);
  }

  if (!profile?.is_approved || profile.onboarding_status === "pending_approval") {
    redirect("/onboarding-pending");
  }

  const admin = createAdminClient();
  const isWorkerAdmin = (await isWorkerAdminAccount(admin, user.id)) || profile.role === "worker_admin";
  if (variant === "worker" && isWorkerAdmin) {
    redirect("/worker-admin/dashboard");
  }
  if (variant === "worker_admin" && !isWorkerAdmin) {
    const { data: adminUser } = await admin.from("admin_users").select("role").eq("id", user.id).maybeSingle();
    if (adminUser?.role !== "worker_admin") redirect("/dashboard");
  }

  const jobAppsEmbedded = await supabase
    .from("job_applications")
    .select("id, job_id, status, created_at, tokens_staked, jobs(*)")
    .eq("worker_id", user.id)
    .order("created_at", { ascending: false })
    .returns<ApplicationRow[]>();
  const jobAppsByWorker = jobAppsEmbedded.error
    ? await supabase
        .from("job_applications")
        .select("id, job_id, status, created_at, tokens_staked")
        .eq("worker_id", user.id)
        .order("created_at", { ascending: false })
        .returns<ApplicationRow[]>()
    : jobAppsEmbedded;
  const jobAppsPlain =
    jobAppsByWorker.error && /worker_id/i.test(jobAppsByWorker.error.message)
      ? await supabase
          .from("job_applications")
          .select("id, job_id, status, created_at, tokens_staked")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .returns<ApplicationRow[]>()
      : jobAppsByWorker;
  const jobAppsLegacy =
    jobAppsPlain.error && /tokens_staked/i.test(jobAppsPlain.error.message)
      ? await (async () => {
          const byWorker = await supabase
            .from("job_applications")
            .select("id, job_id, status, created_at, tokens_spent")
            .eq("worker_id", user.id)
            .order("created_at", { ascending: false })
            .returns<ApplicationRow[]>();
          if (!byWorker.error) return byWorker;
          return supabase
            .from("job_applications")
            .select("id, job_id, status, created_at, tokens_spent")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .returns<ApplicationRow[]>();
        })()
      : jobAppsPlain;
  const applicationRows = jobAppsLegacy.data;
  const applicationError = jobAppsLegacy.error;

  let pendingEarnings = Number(profile.pending_earnings ?? 0);
  let earnedThisMonth = Number(profile.earned_this_month ?? 0);
  let totalEarnings = Number(profile.total_earnings ?? 0);

  if (isWorkerAdmin) {
    const { data: workerAdminMetrics } = await admin
      .from("worker_admins")
      .select("pending_earnings, earned_this_month, total_earnings")
      .eq("worker_id", user.id)
      .maybeSingle();
    if (workerAdminMetrics) {
      pendingEarnings = Number(workerAdminMetrics.pending_earnings ?? pendingEarnings);
      earnedThisMonth = Number(workerAdminMetrics.earned_this_month ?? earnedThisMonth);
      totalEarnings = Number(workerAdminMetrics.total_earnings ?? totalEarnings);
    }
  }

  const view: WorkerProfileView = {
    fullName: profile.full_name || "Worker",
    email: profile.email || user.email || "",
    phone: profile.phone_number || "",
    tokenBalance: profile.token_balance ?? 0,
    status: profile.status || "active",
    totalEarnings,
    pendingEarnings,
    earnedThisMonth,
    isWorkerAdmin,
    walletUsdtTron: profile.wallet_usdt_tron,
    walletUsdtEth: profile.wallet_usdt_eth,
    walletUsdcEth: profile.wallet_usdc_eth,
    payoutUsdtAddress: profile.payout_usdt_address ?? profile.wallet_usdt_tron,
    payoutAirtmEmail: profile.payout_airtm_email ?? null,
    payoutPaypalEmail: profile.payout_paypal_email ?? null,
    payoutMethod:
      profile.payout_method === "crypto" || profile.payout_method === "airtm" || profile.payout_method === "paypal"
        ? profile.payout_method
        : null,
    country: profile.country || "",
  };

  const applications: WorkerApplication[] = (applicationRows ?? []).map((row) => {
    const job = Array.isArray(row.jobs) ? row.jobs[0] : row.jobs;
    return {
      id: row.id,
      jobId: row.job_id,
      jobTitle: job?.title || "Job",
      company: job?.company ?? null,
      tokenCost: row.tokens_staked ?? row.tokens_spent ?? 0,
      status: row.status,
      appliedAt: row.created_at,
    };
  });

  let deposits: WorkerDeposit[] = [];
  let depositsError: string | undefined;
  try {
    const admin = createAdminClient();
    const { data: depositRows, error: depositQueryError } = await admin
      .from("wallet_deposits")
      .select("id, plan_title, amount_usd, tokens_to_credit, wallet_type, transaction_hash, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .returns<DepositRow[]>();

    if (depositQueryError) {
      depositsError = depositQueryError.message;
    } else {
      deposits = (depositRows ?? []).map((row) => ({
        id: row.id,
        planTitle: row.plan_title,
        amountUsd: Number(row.amount_usd),
        tokens: row.tokens_to_credit,
        walletType: row.wallet_type,
        transactionHash: row.transaction_hash,
        status: row.status,
        createdAt: row.created_at,
      }));
    }
  } catch (error) {
    depositsError = error instanceof Error ? error.message : "Could not load deposits.";
  }

  let jobs: MarketplaceJob[] = [];
  let jobsError: string | undefined;
  try {
    jobs = (await getActiveJobs()).filter((job) => job.tier !== 3);
  } catch (error) {
    jobsError = error instanceof Error ? error.message : "Could not load platform projects.";
  }

  let platformApplications: PlatformApplication[] = [];
  let bidLeaderboards: Record<string, JobBidLeaderboardRow[]> = {};
  let treasuryDeposits: TreasuryDeposit[] = [];
  let leaderboard: LeaderboardEntry[] = [];
  let workspaceProjects: ActiveProject[] = [];
  let payouts: PayoutRequest[] = [];
  let pendingPayoutTotal = 0;
  let analyticsPipeline: Array<{ status: string; count: number }> = [];
  let analyticsEarnings: Array<{ day: string; amount: number }> = [];
  try {
    const admin = createAdminClient();
    await admin.rpc("expire_treasury_deposits").then(
      () => undefined,
      () => undefined,
    );
    const now = new Date().toISOString();
    await admin.from("treasury_deposits").update({ status: "expired" }).eq("status", "waiting").lte("expires_at", now);
    let rankedRows: Awaited<ReturnType<typeof getWorkerApplicationsWithJobs>> = [];
    try {
      rankedRows = await getWorkerApplicationsWithJobs(user.id);
    } catch {
      rankedRows = [];
    }
    platformApplications = rankedRows.map((row) => {
      const job = nestedJob(row.jobs);
      return {
        id: row.id,
        jobId: String(row.job_id),
        jobTitle: job?.title || "Platform job",
        workerId: row.worker_id,
        tokensStaked: Number(row.tokens_staked),
        status: (row.status as ApplicationStatus) ?? "submitted",
        proofData: null,
        submittedAt: String(row.submitted_at || row.created_at || ""),
        rankPosition: 0,
        applicantCount: 0,
      };
    });
    workspaceProjects = rankedRows
      .filter((row) => row.status === "hired")
      .map((row) => {
        const job = nestedJob(row.jobs);
        const payLabel = String(job?.pay_rate || "");
        return {
          id: row.id,
          jobId: String(row.job_id),
          jobTitle: job?.title || "Platform job",
          company: job?.company || "flexwork-usa",
          payType: (job?.pay_type as "hourly" | "quota") || payTypeFromRate(payLabel),
          payRate: parsePayAmount(job?.pay_rate),
          status: "hired" as const,
          deadlineAt: null,
          datasetPreview: job?.full_description || job?.brief_description || job?.description || null,
        };
      });
    const [treasury, board, payoutRows, stats] = await Promise.all([
      admin
        .from("treasury_deposits")
        .select("*")
        .eq("worker_id", user.id)
        .order("created_at", { ascending: false }),
      admin.from("leaderboard").select("*").order("rank_order", { ascending: true }).limit(50),
      admin.from("payout_requests").select("*").eq("worker_id", user.id).order("created_at", { ascending: false }),
      admin.rpc("get_worker_dashboard_stats", { p_worker_id: user.id }),
    ]);

    const statsPayload = stats.data as
      | {
          pipeline?: Array<{ status: string; count: number }>;
          earnings?: Array<{ day: string; amount: number }>;
          pending_earnings?: number;
          earned_this_month?: number;
          total_earnings?: number;
        }
      | null;
    analyticsPipeline = statsPayload?.pipeline ?? [];
    analyticsEarnings = (statsPayload?.earnings ?? [])
      .map((item) => ({
        day: String(item.day),
        amount: Number(item.amount),
      }))
      .filter((item) => Number.isFinite(item.amount) && item.amount > 0);
    if (statsPayload) {
      if (statsPayload.pending_earnings != null) view.pendingEarnings = Number(statsPayload.pending_earnings);
      if (statsPayload.earned_this_month != null) view.earnedThisMonth = Number(statsPayload.earned_this_month);
      if (statsPayload.total_earnings != null) view.totalEarnings = Number(statsPayload.total_earnings);
    }

    const uniqueJobIds = [...new Set(platformApplications.map((item) => item.jobId))];
    await Promise.all(
      uniqueJobIds.map(async (jobId) => {
        bidLeaderboards[jobId] = await getJobLeaderboard(jobId);
      }),
    );

    treasuryDeposits = (treasury.data ?? []).map((row) => ({
      id: row.id,
      workerId: row.worker_id,
      usdtAmount: Number(row.usdt_amount),
      tokensIssued: Number(row.tokens_issued),
      depositAddress: row.deposit_address,
      memoCode: row.memo_code,
      txHash: row.tx_hash,
      status:
        row.status === "waiting" && new Date(row.expires_at).getTime() <= Date.now() ? "expired" : row.status,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      network:
        row.network === "TRC20" || row.network === "BEP20" || row.network === "ERC20"
          ? row.network
          : undefined,
      planTitle: typeof row.plan_title === "string" ? row.plan_title : null,
    }));

    leaderboard = (board.data ?? []).map((row) => ({
      id: row.id,
      workerName: row.worker_name,
      emailMasked: row.email_masked,
      country: row.country,
      skill: row.skill,
      totalEarnings: Number(row.total_earnings),
      rankOrder: row.rank_order,
    }));

    payouts = (payoutRows.data ?? []).map((row) => mapPayoutRequestRow(row as Record<string, unknown>));
    pendingPayoutTotal = payouts
      .filter((item) => item.status === "pending" || item.status === "approved")
      .reduce((sum, item) => sum + item.amount, 0);
  } catch {
    // New schema tables may not be applied yet; dashboard still loads.
  }

  return (
    <WorkerDashboard
      profile={view}
      applications={applications}
      applicationsError={applicationError?.message}
      deposits={deposits}
      depositsError={depositsError}
      jobs={jobs}
      jobsError={jobsError}
      platformApplications={platformApplications}
      bidLeaderboards={bidLeaderboards}
      treasuryDeposits={treasuryDeposits}
      leaderboard={leaderboard}
      workspaceProjects={workspaceProjects}
      payouts={payouts}
      pendingPayoutTotal={pendingPayoutTotal}
      analyticsPipeline={analyticsPipeline}
      analyticsEarnings={analyticsEarnings}
      initialTab={initialTab}
    />
  );
}
