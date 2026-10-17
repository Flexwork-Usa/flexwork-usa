"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export type ApproveWorkerInput = {
  applicationId: string;
  email: string;
  fullName: string;
  country: string;
  phoneNumber: string;
  tempPassword: string;
  walletUsdtTron: string;
  walletUsdtEth: string;
  walletUsdcEth: string;
};

export type ApproveWorkerResult = {
  userId: string;
  emailDraft: string;
};

export async function approveWorkerAndAssignWallets(
  data: ApproveWorkerInput,
): Promise<ApproveWorkerResult> {
  const applicationId = data.applicationId.trim();
  const email = data.email.trim();
  const fullName = data.fullName.trim();
  const country = data.country.trim();
  const phoneNumber = data.phoneNumber.trim();
  const tempPassword = data.tempPassword;
  const walletUsdtTron = data.walletUsdtTron.trim();
  const walletUsdtEth = data.walletUsdtEth.trim();
  const walletUsdcEth = data.walletUsdcEth.trim();

  if (
    !applicationId ||
    !email ||
    !fullName ||
    !country ||
    !phoneNumber ||
    !tempPassword ||
    !walletUsdtTron ||
    !walletUsdtEth ||
    !walletUsdcEth
  ) {
    throw new Error("Every approval field is required.");
  }

  const supabase = createAdminClient();

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
  });

  if (createError || !created.user) {
    throw new Error(createError?.message ?? "Could not create the auth user.");
  }

  const userId = created.user.id;

  const { error: profileError } = await supabase.from("profiles").insert({
    id: userId,
    full_name: fullName,
    email,
    country,
    phone_number: phoneNumber,
    wallet_usdt_tron: walletUsdtTron,
    wallet_usdt_eth: walletUsdtEth,
    wallet_usdc_eth: walletUsdcEth,
    token_balance: 0,
    role: "worker",
    is_approved: true,
  });

  if (profileError) {
    await supabase.auth.admin.deleteUser(userId);
    throw new Error(profileError.message);
  }

  const { error: applicationError } = await supabase
    .from("onboarding_applications")
    .update({ status: "approved" })
    .eq("id", applicationId);

  if (applicationError) {
    throw new Error(applicationError.message);
  }

  const emailDraft = `Welcome to FlexWork-USA!
Your account is approved.
Login Link: https://flexwork-usa.com/login
Email: ${email}
Temp Password: ${tempPassword}

Wallet Addresses for Buying Tokens ($0.20 / token):
USDT (Tron TRC-20): ${walletUsdtTron}
USDT (Ethereum ERC-20): ${walletUsdtEth}
USDC (Ethereum ERC-20): ${walletUsdcEth}`;

  return { userId, emailDraft };
}
