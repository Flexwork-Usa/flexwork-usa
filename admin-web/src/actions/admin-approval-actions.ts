"use server";

import { verifyAdmin } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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

  const { supabase } = await verifyAdmin();

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
  });

  if (createError || !created.user) {
    throw new Error(createError?.message ?? "Could not create the auth user.");
  }

  const userId = created.user.id;

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: userId,
    full_name: fullName,
    email,
    country,
    phone_number: phoneNumber,
    wallet_usdt_tron: walletUsdtTron,
    wallet_usdt_eth: walletUsdtEth,
    wallet_usdc_eth: walletUsdcEth,
    token_balance: 50,
    status: "active",
    role: "worker",
    is_approved: true,
    onboarding_status: "approved",
    temp_recovery_pass: tempPassword,
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

export type UpdateAdminCredentialsResult = { success: true; message: string } | { success: false; error: string };

export async function updateAdminAccountCredentials(
  newPassword?: string,
  newEmail?: string,
): Promise<UpdateAdminCredentialsResult> {
  try {
    const { user, supabase } = await verifyAdmin();
    const password = newPassword?.trim() ?? "";
    const email = newEmail?.trim() ?? "";

    if (!password && !email) {
      return { success: false, error: "Enter a new password or a new email." };
    }
    if (password && password.length < 8) {
      return { success: false, error: "Use at least 8 characters." };
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { success: false, error: "Enter a valid email." };
    }

    const session = await createServerSupabaseClient();
    const payload: { password?: string; email?: string } = {};
    if (password) payload.password = password;
    if (email) payload.email = email;

    const { error } = await session.auth.updateUser(payload);
    if (error) return { success: false, error: error.message };

    if (email) {
      const { error: syncError } = await supabase
        .from("admin_users")
        .update({ email, updated_at: new Date().toISOString() })
        .eq("id", user.id);
      if (syncError) return { success: false, error: syncError.message };
    }

    if (email && password) return { success: true, message: "Email and password updated." };
    if (email) return { success: true, message: "Email updated. Check the inbox if a confirmation is required." };
    return { success: true, message: "Password updated." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Access restricted to platform administrators";
    return { success: false, error: message };
  }
}
