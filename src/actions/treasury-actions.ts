"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { CUSTOM_PLAN_MINIMUM_USD, resolvePurchasePlan } from "@/lib/deposits";
import { DEPOSIT_SESSION_MINUTES } from "@/lib/platform/rules";
import type { TreasuryDeposit, TreasuryNetwork } from "@/lib/platform/types";

export type StartDepositResult =
  | { success: true; deposit: TreasuryDeposit }
  | { success: false; error: string };

export type SubmitTreasuryTxResult =
  | { success: true; deposit: TreasuryDeposit }
  | { success: false; error: string };

export type ActiveDepositResult =
  | { success: true; deposit: TreasuryDeposit | null }
  | { success: false; error: string };

function mapDeposit(row: {
  id: string;
  worker_id: string;
  usdt_amount: number | string;
  tokens_issued: number | string;
  deposit_address: string;
  memo_code: string;
  tx_hash: string | null;
  status: TreasuryDeposit["status"];
  expires_at: string;
  created_at: string;
  network?: string | null;
  plan_title?: string | null;
}): TreasuryDeposit {
  const network =
    row.network === "BEP20" || row.network === "ERC20" || row.network === "TRC20"
      ? row.network
      : inferNetwork(row.deposit_address);
  return {
    id: row.id,
    workerId: row.worker_id,
    usdtAmount: Number(row.usdt_amount),
    tokensIssued: Number(row.tokens_issued),
    depositAddress: row.deposit_address,
    memoCode: row.memo_code,
    txHash: row.tx_hash,
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    network,
    planTitle: row.plan_title ?? null,
  };
}

function inferNetwork(address: string): TreasuryNetwork {
  if (address.trim().startsWith("T")) return "TRC20";
  return "ERC20";
}

function resolveTreasuryNetwork(input?: string | null): TreasuryNetwork {
  if (input === "USDT (TRC-20)" || input === "TRC20") return "TRC20";
  if (input === "USDT (ERC-20)" || input === "USDC (ERC-20)" || input === "ERC20") return "ERC20";
  if (input === "BEP20") return "BEP20";
  return "TRC20";
}

function refreshWorkerPaths() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/payments");
  revalidatePath("/dashboard/tokens");
  revalidatePath("/worker-admin/dashboard");
  revalidatePath("/worker-admin/dashboard/payments");
  revalidatePath("/worker-admin/dashboard/tokens");
}

async function requireUser() {
  const session = await createServerSupabaseClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  return user;
}

async function markLapsedWaiting(admin: ReturnType<typeof createAdminClient>) {
  await admin.from("treasury_deposits").update({ status: "expired" }).eq("status", "waiting").lte("expires_at", new Date().toISOString());
}

async function expireWaiting() {
  const admin = createAdminClient();
  await admin.rpc("expire_treasury_deposits").then(
    () => undefined,
    () => undefined,
  );
  await markLapsedWaiting(admin);
  return admin;
}

export async function expireTreasuryDepositSession(depositId?: string) {
  const user = await requireUser();
  if (!user) return { success: false as const, error: "You need to sign in." };

  const admin = await expireWaiting();
  if (depositId) {
    await admin
      .from("treasury_deposits")
      .update({ status: "expired" })
      .eq("id", depositId)
      .eq("worker_id", user.id)
      .eq("status", "waiting")
      .lte("expires_at", new Date().toISOString());
  }
  refreshWorkerPaths();
  return { success: true as const };
}

export async function getActiveTreasuryDepositSession(): Promise<ActiveDepositResult> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You need to sign in." };

  const admin = await expireWaiting();
  const { data, error } = await admin
    .from("treasury_deposits")
    .select("*")
    .eq("worker_id", user.id)
    .eq("status", "waiting")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!error && data) {
    return { success: true, deposit: mapDeposit(data) };
  }

  // Pre-migration / in-flight: session stored as pending without TXID.
  const legacy = await admin
    .from("treasury_deposits")
    .select("*")
    .eq("worker_id", user.id)
    .eq("status", "pending")
    .is("tx_hash", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (legacy.error && error) return { success: false, error: error.message };
  if (legacy.error) return { success: true, deposit: null };

  return {
    success: true,
    deposit: legacy.data ? mapDeposit({ ...legacy.data, status: "waiting" }) : null,
  };
}

export async function startTreasuryDepositSession(input: {
  usdtAmount: number;
  network?: TreasuryNetwork;
  tokensIssued?: number;
  planTitle?: string;
}): Promise<StartDepositResult> {
  const usdtAmount = Number(input.usdtAmount);
  const plan = resolvePurchasePlan({
    planTitle: input.planTitle,
    usdtAmount,
    tokensIssued: input.tokensIssued,
  });
  if (!plan) {
    return {
      success: false,
      error: `Choose a listed package or a custom amount of at least $${CUSTOM_PLAN_MINIMUM_USD} USDT.`,
    };
  }
  const tokens = plan.tokens;
  if (tokens < 1) return { success: false, error: "This plan does not include any tokens." };

  const user = await requireUser();
  if (!user) return { success: false, error: "You need to sign in." };

  const admin = await expireWaiting();

  const active = await getActiveTreasuryDepositSession();
  if (active.success && active.deposit) {
    return { success: true, deposit: active.deposit };
  }

  const network = resolveTreasuryNetwork(input.network);
  const { data: addresses, error: addressError } = await admin
    .from("treasury_addresses")
    .select("id, network, address")
    .eq("is_active", true)
    .eq("network", network);

  if (addressError) return { success: false, error: addressError.message };
  if (!addresses?.length) {
    return { success: false, error: "No active treasury address is available for this network." };
  }

  const address = addresses[Math.floor(Math.random() * addresses.length)];
  const { data: memoRow } = await admin.rpc("generate_deposit_memo");
  const memoCode =
    typeof memoRow === "string" ? memoRow : `FW-${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`;
  const expiresAt = new Date(Date.now() + DEPOSIT_SESSION_MINUTES * 60 * 1000).toISOString();

  const basePayload = {
    worker_id: user.id,
    usdt_amount: plan.amountUsd,
    tokens_issued: plan.tokens,
    deposit_address: address.address,
    memo_code: memoCode,
    status: "waiting" as const,
    expires_at: expiresAt,
    plan_title: plan.title,
  };

  let insert = await admin
    .from("treasury_deposits")
    .insert({ ...basePayload, network })
    .select("*")
    .single();

  if (insert.error && /plan_title/i.test(insert.error.message)) {
    const { plan_title: _planTitle, ...withoutPlan } = basePayload;
    insert = await admin.from("treasury_deposits").insert({ ...withoutPlan, network }).select("*").single();
  }

  if (insert.error && /network/i.test(insert.error.message)) {
    insert = await admin.from("treasury_deposits").insert(basePayload).select("*").single();
    if (insert.error && /plan_title/i.test(insert.error.message)) {
      const { plan_title: _planTitle, ...withoutPlan } = basePayload;
      insert = await admin.from("treasury_deposits").insert(withoutPlan).select("*").single();
    }
  }

  if (insert.error && /waiting|check.*status|status/i.test(insert.error.message)) {
    insert = await admin
      .from("treasury_deposits")
      .insert({ ...basePayload, status: "pending", network })
      .select("*")
      .single();
    if (insert.error && /network/i.test(insert.error.message)) {
      insert = await admin
        .from("treasury_deposits")
        .insert({ ...basePayload, status: "pending" })
        .select("*")
        .single();
    }
    if (insert.data) {
      refreshWorkerPaths();
      return { success: true, deposit: mapDeposit({ ...insert.data, status: "waiting", network }) };
    }
  }

  if (insert.error || !insert.data) {
    return { success: false, error: insert.error?.message ?? "Could not start deposit session." };
  }

  refreshWorkerPaths();
  return { success: true, deposit: mapDeposit(insert.data) };
}

export async function submitTreasuryTxHash(input: {
  depositId: string;
  txHash: string;
}): Promise<SubmitTreasuryTxResult> {
  const depositId = input.depositId.trim();
  const txHash = input.txHash.trim();
  if (!depositId) return { success: false, error: "A deposit session is required." };
  if (!txHash) return { success: false, error: "Transaction hash is required." };
  if (txHash.length > 200) return { success: false, error: "Transaction hash is too long." };

  const user = await requireUser();
  if (!user) return { success: false, error: "You need to sign in." };

  const admin = await expireWaiting();

  const { data: deposit, error: loadError } = await admin
    .from("treasury_deposits")
    .select("*")
    .eq("id", depositId)
    .eq("worker_id", user.id)
    .maybeSingle();

  if (loadError) return { success: false, error: loadError.message };
  if (!deposit) return { success: false, error: "Deposit session not found." };

  if (deposit.status === "pending" && deposit.tx_hash) {
    return { success: true, deposit: mapDeposit(deposit) };
  }

  const isWaitingSession =
    deposit.status === "waiting" || (deposit.status === "pending" && !deposit.tx_hash);

  if (!isWaitingSession) {
    return { success: false, error: "This deposit session is no longer active." };
  }

  if (new Date(deposit.expires_at).getTime() < Date.now()) {
    if (deposit.status === "waiting") {
      await admin
        .from("treasury_deposits")
        .update({ status: "expired" })
        .eq("id", depositId)
        .eq("status", "waiting");
    }
    return { success: false, error: "This deposit session expired. Start a new one." };
  }

  const { data: updated, error } = await admin
    .from("treasury_deposits")
    .update({
      tx_hash: txHash,
      status: "pending",
    })
    .eq("id", depositId)
    .eq("worker_id", user.id)
    .in("status", ["waiting", "pending"])
    .select("*")
    .maybeSingle();

  if (error || !updated) {
    return { success: false, error: error?.message ?? "This deposit session is no longer waiting." };
  }

  refreshWorkerPaths();
  return { success: true, deposit: mapDeposit(updated) };
}
