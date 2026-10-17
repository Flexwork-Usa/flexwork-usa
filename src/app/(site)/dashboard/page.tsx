import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import {
  WorkerHome,
  type WorkerApplication,
  type WorkerDeposit,
  type WorkerProfileView,
} from "@/components/worker/WorkerHome";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Dashboard · flexwork-usa",
};

type ProfileRow = {
  full_name: string | null;
  email: string | null;
  token_balance: number | null;
  wallet_usdt_tron: string | null;
  wallet_usdt_eth: string | null;
  wallet_usdc_eth: string | null;
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
  status: string;
  created_at: string;
  tokens_spent: number | null;
  jobs: { title: string; company: string | null } | { title: string; company: string | null }[] | null;
};

export default function WorkerDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <p className="text-sm text-gray-600">Loading dashboard…</p>
        </div>
      }
    >
      <WorkerDashboardContent />
    </Suspense>
  );
}

async function WorkerDashboardContent() {
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

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(
      "full_name, email, token_balance, wallet_usdt_tron, wallet_usdt_eth, wallet_usdc_eth, is_approved",
    )
    .eq("id", user.id)
    .maybeSingle()
    .returns<ProfileRow>();

  if (profileError) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <p className="text-sm text-red-700">{profileError.message}</p>
      </div>
    );
  }

  if (!profile?.is_approved) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900">
          Your account is pending admin approval.
        </p>
      </div>
    );
  }

  const { data: applicationRows, error: applicationError } = await supabase
    .from("job_applications")
    .select("id, status, created_at, tokens_spent, jobs(title, company)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .returns<ApplicationRow[]>();

  const view: WorkerProfileView = {
    fullName: profile.full_name || "Worker",
    email: profile.email || user.email || "",
    tokenBalance: profile.token_balance ?? 0,
    walletUsdtTron: profile.wallet_usdt_tron,
    walletUsdtEth: profile.wallet_usdt_eth,
    walletUsdcEth: profile.wallet_usdc_eth,
  };

  const applications: WorkerApplication[] = (applicationRows ?? []).map((row) => {
    const job = Array.isArray(row.jobs) ? row.jobs[0] : row.jobs;
    return {
      id: row.id,
      jobTitle: job?.title || "Job",
      company: job?.company ?? null,
      tokenCost: row.tokens_spent ?? 0,
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

  return (
    <WorkerHome
      profile={view}
      applications={applications}
      applicationsError={applicationError?.message}
      deposits={deposits}
      depositsError={depositsError}
    />
  );
}
