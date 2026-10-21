"use server";

import { revalidatePath } from "next/cache";
import { verifyAdmin } from "@/lib/supabase/admin";
import type { InspectorApplication, InspectorDeposit, WorkerInspectorData } from "@/lib/admin/types";

type DepositClaim = {
  id: string;
  user_id: string | null;
  amount_usd: number | string;
  tokens_to_credit: number;
  transaction_hash: string;
};

type ProfileDetail = {
  id: string;
  full_name: string | null;
  email: string | null;
  country: string | null;
  phone_number: string | null;
  created_at: string | null;
  token_balance: number | null;
};

type DepositHistoryRow = {
  id: string;
  amount_usd: number | string;
  tokens_to_credit: number;
  wallet_type: string;
  transaction_hash: string;
  status: string;
  created_at: string;
};

type ApplicationHistoryRow = {
  id: string;
  status: string;
  tokens_spent: number | null;
  created_at: string;
  jobs: { title: string | null; tier: number | null } | { title: string | null; tier: number | null }[] | null;
};

async function requireAdmin() {
  const { supabase } = await verifyAdmin();
  return supabase;
}

function refresh() {
  revalidatePath("/console/v1/x9q7");
  revalidatePath("/dashboard");
}

export async function approveDepositAndCredit(depositId: string) {
  const id = depositId.trim();
  if (!id) throw new Error("A deposit is required.");

  const admin = await requireAdmin();
  const { data: claimed, error: claimError } = await admin
    .from("wallet_deposits")
    .update({ status: "approved", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending")
    .select("id, user_id, amount_usd, tokens_to_credit, transaction_hash")
    .maybeSingle()
    .returns<DepositClaim>();

  if (claimError) throw new Error(claimError.message);
  if (!claimed?.user_id) throw new Error("This deposit is no longer pending.");

  const tokens = claimed.tokens_to_credit;
  if (!Number.isInteger(tokens) || tokens < 1) {
    await admin.from("wallet_deposits").update({ status: "pending" }).eq("id", id).eq("status", "approved");
    throw new Error("This deposit does not have a token amount to credit.");
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("token_balance")
    .eq("id", claimed.user_id)
    .maybeSingle();

  if (profileError || !profile) {
    await admin.from("wallet_deposits").update({ status: "pending" }).eq("id", id).eq("status", "approved");
    throw new Error(profileError?.message || "Worker profile was not found.");
  }

  const currentBalance = profile.token_balance ?? 0;
  const newBalance = currentBalance + tokens;
  const { data: updated, error: balanceError } = await admin
    .from("profiles")
    .update({ token_balance: newBalance })
    .eq("id", claimed.user_id)
    .eq("token_balance", currentBalance)
    .select("token_balance")
    .maybeSingle();

  if (balanceError || !updated) {
    await admin.from("wallet_deposits").update({ status: "pending" }).eq("id", id).eq("status", "approved");
    throw new Error(balanceError?.message || "The balance changed. Try again.");
  }

  const amount = Number(claimed.amount_usd);
  const { error: ledgerError } = await admin.from("token_transactions").insert({
    user_id: claimed.user_id,
    amount: tokens,
    description: `Deposit approved ($${Number.isFinite(amount) ? amount.toFixed(2) : claimed.amount_usd} USD - Tx: ${claimed.transaction_hash})`,
  });

  if (ledgerError) {
    await admin
      .from("profiles")
      .update({ token_balance: currentBalance })
      .eq("id", claimed.user_id)
      .eq("token_balance", newBalance);
    await admin.from("wallet_deposits").update({ status: "pending" }).eq("id", id).eq("status", "approved");
    throw new Error(ledgerError.message);
  }

  refresh();
  return { userId: claimed.user_id, tokensAdded: tokens, newBalance };
}

export async function rejectDeposit({ depositId, note }: { depositId: string; note?: string }) {
  const id = depositId.trim();
  if (!id) throw new Error("A deposit is required.");
  const adminNote = note?.trim() ?? "";
  if (adminNote.length > 500) throw new Error("The note is too long.");

  const admin = await requireAdmin();
  const { data, error } = await admin
    .from("wallet_deposits")
    .update({
      status: "rejected",
      admin_note: adminNote || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("This deposit is no longer pending.");

  refresh();
  return { success: true as const };
}

export async function loadWorkerInspector(userId: string): Promise<WorkerInspectorData> {
  const id = userId.trim();
  if (!id) throw new Error("A worker is required.");

  const admin = await requireAdmin();
  const [profileResult, depositResult, applicationResult] = await Promise.all([
    admin
      .from("profiles")
      .select("id, full_name, email, country, phone_number, created_at, token_balance")
      .eq("id", id)
      .maybeSingle()
      .returns<ProfileDetail>(),
    admin
      .from("wallet_deposits")
      .select("id, amount_usd, tokens_to_credit, wallet_type, transaction_hash, status, created_at")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .returns<DepositHistoryRow[]>(),
    admin
      .from("job_applications")
      .select("id, status, tokens_spent, created_at, jobs(title, tier)")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .returns<ApplicationHistoryRow[]>(),
  ]);

  if (profileResult.error) throw new Error(profileResult.error.message);
  if (!profileResult.data) throw new Error("Worker profile was not found.");
  if (depositResult.error) throw new Error(depositResult.error.message);
  if (applicationResult.error) throw new Error(applicationResult.error.message);

  const profile = profileResult.data;
  const deposits: InspectorDeposit[] = (depositResult.data ?? []).map((row) => ({
    id: row.id,
    amountUsd: Number(row.amount_usd),
    tokens: row.tokens_to_credit,
    walletType: row.wallet_type,
    transactionHash: row.transaction_hash,
    status: row.status,
    createdAt: row.created_at,
  }));

  const applications: InspectorApplication[] = (applicationResult.data ?? []).map((row) => {
    const job = Array.isArray(row.jobs) ? row.jobs[0] : row.jobs;
    return {
      id: row.id,
      jobTitle: job?.title || "Job",
      tier: job?.tier ?? null,
      tokensSpent: row.tokens_spent ?? 0,
      status: row.status,
      appliedAt: row.created_at,
    };
  });

  return {
    id: profile.id,
    fullName: profile.full_name || "Worker",
    email: profile.email || "",
    country: profile.country || "",
    phoneNumber: profile.phone_number || "",
    joinedAt: profile.created_at,
    tokenBalance: profile.token_balance ?? 0,
    deposits,
    applications,
  };
}
