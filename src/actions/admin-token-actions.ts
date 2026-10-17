"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { TOKEN_PRICE } from "@/lib/format";

export type CreditTokensInput = {
  userId: string;
  usdAmount: number;
  customTokenCount?: number | null;
  referenceNote: string;
};

export type CreditTokensResult = {
  success: true;
  userId: string;
  tokensAdded: number;
  newBalance: number;
};

export async function creditTokensToWorker({
  userId,
  usdAmount,
  customTokenCount,
  referenceNote,
}: CreditTokensInput): Promise<CreditTokensResult> {
  const workerId = userId.trim();
  const note = referenceNote.trim();

  if (!workerId) {
    throw new Error("A worker is required.");
  }
  if (!Number.isFinite(usdAmount) || usdAmount < 0) {
    throw new Error("USD amount must be zero or greater.");
  }

  const tokens =
    customTokenCount != null
      ? customTokenCount
      : Math.floor(usdAmount / TOKEN_PRICE);

  if (!Number.isInteger(tokens) || tokens < 1) {
    throw new Error("Token credit must be a positive whole number.");
  }

  const supabase = createAdminClient();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("token_balance")
    .eq("id", workerId)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }
  if (!profile) {
    throw new Error("Worker profile was not found.");
  }

  const currentBalance = profile.token_balance ?? 0;
  const newBalance = currentBalance + tokens;

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ token_balance: newBalance })
    .eq("id", workerId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  const { error: transactionError } = await supabase.from("token_transactions").insert({
    user_id: workerId,
    amount: tokens,
    description: `Admin deposit credit ($${usdAmount} USD - Ref: ${note})`,
  });

  if (transactionError) {
    await supabase
      .from("profiles")
      .update({ token_balance: currentBalance })
      .eq("id", workerId);
    throw new Error(transactionError.message);
  }

  return {
    success: true,
    userId: workerId,
    tokensAdded: tokens,
    newBalance,
  };
}
