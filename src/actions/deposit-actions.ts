"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { expectedDeposit, isWalletType, type WalletType } from "@/lib/deposits";

export type SubmitDepositInput = {
  planTitle: string;
  amountUsd: number;
  tokens: number;
  walletType: string;
  transactionHash: string;
};

export type SubmitDepositResult = { success: true } | { success: false; error: string };

const WALLET_COLUMN: Record<WalletType, "wallet_usdt_tron" | "wallet_usdt_eth" | "wallet_usdc_eth"> = {
  "USDT (TRC-20)": "wallet_usdt_tron",
  "USDT (ERC-20)": "wallet_usdt_eth",
  "USDC (ERC-20)": "wallet_usdc_eth",
};

export async function submitDepositHash(input: SubmitDepositInput): Promise<SubmitDepositResult> {
  const planTitle = input.planTitle.trim();
  const transactionHash = input.transactionHash.trim();
  const amountUsd = input.amountUsd;
  const tokens = input.tokens;
  const walletType = input.walletType.trim();

  if (!transactionHash) {
    return { success: false, error: "Transaction hash is required." };
  }
  if (transactionHash.length > 200) {
    return { success: false, error: "Transaction hash is too long." };
  }
  if (!isWalletType(walletType)) {
    return { success: false, error: "Choose a deposit wallet." };
  }

  const plan = expectedDeposit(planTitle, amountUsd, tokens);
  if (!plan) {
    return { success: false, error: "Choose a valid deposit plan." };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "You need to sign in." };
  }

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("is_approved, wallet_usdt_tron, wallet_usdt_eth, wallet_usdc_eth")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return { success: false, error: profileError.message };
  }
  if (!profile?.is_approved) {
    return { success: false, error: "Account pending approval or unauthorized." };
  }

  const assigned = profile[WALLET_COLUMN[walletType]];
  if (typeof assigned !== "string" || !assigned.trim()) {
    return { success: false, error: "That wallet is pending assignment." };
  }

  const { data: existing, error: existingError } = await admin
    .from("wallet_deposits")
    .select("id")
    .eq("user_id", user.id)
    .eq("transaction_hash", transactionHash)
    .limit(1);

  if (existingError) {
    return { success: false, error: existingError.message };
  }
  if (existing && existing.length > 0) {
    return { success: false, error: "This transaction hash has already been submitted." };
  }

  const { error } = await admin.from("wallet_deposits").insert({
    user_id: user.id,
    plan_title: plan.title,
    amount_usd: plan.amountUsd,
    tokens_to_credit: plan.tokens,
    wallet_type: walletType,
    transaction_hash: transactionHash,
    status: "pending",
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard");
  return { success: true };
}
