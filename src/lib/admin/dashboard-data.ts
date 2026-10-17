import { createAdminClient } from "@/lib/supabase/admin";
import type { PendingApplication, PendingDeposit, WorkerProfileRow } from "@/lib/admin/types";

type ApplicationRow = {
  id: string;
  full_name: string;
  email: string;
  country: string;
  phone_number: string;
  created_at: string;
};

type DepositQueueRow = {
  id: string;
  user_id: string | null;
  amount_usd: number | string;
  tokens_to_credit: number;
  wallet_type: string;
  transaction_hash: string;
  created_at: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  token_balance: number | null;
  wallet_usdt_tron: string | null;
  wallet_usdt_eth: string | null;
  wallet_usdc_eth: string | null;
};

export async function getAdminDashboardData(): Promise<{
  applications: PendingApplication[];
  profiles: WorkerProfileRow[];
  deposits: PendingDeposit[];
}> {
  const supabase = createAdminClient();

  const [applicationsResult, profilesResult, depositsResult] = await Promise.all([
    supabase
      .from("onboarding_applications")
      .select("id, full_name, email, country, phone_number, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .returns<ApplicationRow[]>(),
    supabase
      .from("profiles")
      .select(
        "id, full_name, email, token_balance, wallet_usdt_tron, wallet_usdt_eth, wallet_usdc_eth",
      )
      .eq("role", "worker")
      .order("created_at", { ascending: false })
      .returns<ProfileRow[]>(),
    supabase
      .from("wallet_deposits")
      .select("id, user_id, amount_usd, tokens_to_credit, wallet_type, transaction_hash, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .returns<DepositQueueRow[]>(),
  ]);

  if (applicationsResult.error) {
    throw new Error(applicationsResult.error.message);
  }
  if (profilesResult.error) {
    throw new Error(profilesResult.error.message);
  }
  if (depositsResult.error) {
    throw new Error(depositsResult.error.message);
  }

  const depositRows = depositsResult.data ?? [];
  const namedIds = [...new Set(depositRows.map((row) => row.user_id).filter((id): id is string => Boolean(id)))];
  const names = new Map<string, string>();
  if (namedIds.length > 0) {
    const { data: nameRows, error: nameError } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", namedIds)
      .returns<Array<{ id: string; full_name: string | null }>>();
    if (nameError) throw new Error(nameError.message);
    for (const row of nameRows ?? []) names.set(row.id, row.full_name || "Worker");
  }

  return {
    applications: (applicationsResult.data ?? []).map((row) => ({
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      country: row.country,
      phoneNumber: row.phone_number,
      createdAt: row.created_at,
    })),
    profiles: (profilesResult.data ?? []).map((row) => ({
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      tokenBalance: row.token_balance ?? 0,
      walletUsdtTron: row.wallet_usdt_tron,
      walletUsdtEth: row.wallet_usdt_eth,
      walletUsdcEth: row.wallet_usdc_eth,
    })),
    deposits: depositRows.map((row) => ({
      id: row.id,
      userId: row.user_id || "",
      workerName: (row.user_id && names.get(row.user_id)) || "Worker",
      amountUsd: Number(row.amount_usd),
      tokens: row.tokens_to_credit,
      walletType: row.wallet_type,
      transactionHash: row.transaction_hash,
      createdAt: row.created_at,
    })),
  };
}
