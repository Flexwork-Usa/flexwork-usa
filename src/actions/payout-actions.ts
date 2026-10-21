"use server";

import { revalidatePath } from "next/cache";
import { MIN_PAYOUT_THRESHOLD_MESSAGE, MIN_PAYOUT_USD, PAYOUT_SUBMITTED_MESSAGE } from "@/lib/platform/rules";
import type { PayoutMethod } from "@/lib/platform/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type PayoutActionResult =
  | { success: true; message: string; pendingEarnings: number }
  | { success: false; error: string };

function errorMessage(error: unknown, fallback = "Payout request failed.") {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string" && error.message) {
    return error.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function rpcFailed(data: unknown, error: { message?: string } | null) {
  if (error?.message) return error.message;
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  if (row.success === false) return String(row.error ?? row.message ?? "Payout request failed.");
  if (typeof row.error === "string" && row.error && row.success !== true && row.id == null) return row.error;
  return null;
}

async function availablePending(admin: ReturnType<typeof createAdminClient>, workerId: string) {
  const { data: profile } = await admin
    .from("profiles")
    .select("pending_earnings, status")
    .eq("id", workerId)
    .maybeSingle();
  const { data: workerAdmin } = await admin
    .from("worker_admins")
    .select("pending_earnings")
    .eq("worker_id", workerId)
    .maybeSingle();
  const pending =
    workerAdmin?.pending_earnings != null
      ? Number(workerAdmin.pending_earnings)
      : Number(profile?.pending_earnings ?? 0);
  return { pending, status: profile?.status ?? "active" };
}

async function writePending(admin: ReturnType<typeof createAdminClient>, workerId: string, nextPending: number) {
  const next = Math.max(0, Number(nextPending.toFixed(2)));
  const profileUpdate = await admin.from("profiles").update({ pending_earnings: next }).eq("id", workerId);
  if (profileUpdate.error) return { ok: false as const, error: profileUpdate.error.message };
  await admin
    .from("worker_admins")
    .update({ pending_earnings: next, updated_at: new Date().toISOString() })
    .eq("worker_id", workerId);
  return { ok: true as const, pending: next };
}

function revalidatePayoutPaths() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/payments");
  revalidatePath("/worker-admin/dashboard");
  revalidatePath("/worker-admin/dashboard/payments");
}

export async function requestPayout(input: {
  method: PayoutMethod;
  amount: number;
  address: string;
}): Promise<PayoutActionResult> {
  try {
    const amount = Number(Number(input.amount).toFixed(2));
    const address = input.address.trim();
    if (!Number.isFinite(amount) || amount < MIN_PAYOUT_USD) {
      return { success: false, error: MIN_PAYOUT_THRESHOLD_MESSAGE };
    }
    if (!address) return { success: false, error: "A payout address is required." };
    if (!["crypto", "airtm", "paypal"].includes(input.method)) {
      return { success: false, error: "Choose Crypto, Airtm, or PayPal." };
    }

    const session = await createServerSupabaseClient();
    const {
      data: { user },
    } = await session.auth.getUser();
    if (!user) return { success: false, error: "You need to sign in." };

    const admin = createAdminClient();
    const { pending, status } = await availablePending(admin, user.id);
    if (status && status !== "active") {
      return { success: false, error: "Your account is restricted. Contact support." };
    }
    if (pending < MIN_PAYOUT_USD) return { success: false, error: MIN_PAYOUT_THRESHOLD_MESSAGE };
    if (pending < amount) return { success: false, error: "Requested amount exceeds available earnings." };

    const { data, error } = await session.rpc("submit_payout_request", {
      p_method: input.method,
      p_address: address,
      p_amount: amount,
    });
    const rpcError = rpcFailed(data, error);
    const nextPending = Math.max(0, Number((pending - amount).toFixed(2)));

    if (rpcError) {
      const inserted = await admin
        .from("payout_requests")
        .insert({
          worker_id: user.id,
          method: input.method,
          address,
          amount,
          status: "pending",
        })
        .select("id")
        .maybeSingle();
      if (inserted.error || !inserted.data?.id) {
        return { success: false, error: inserted.error?.message || rpcError };
      }
      const deducted = await writePending(admin, user.id, nextPending);
      if (!deducted.ok) {
        await admin.from("payout_requests").delete().eq("id", inserted.data.id);
        return { success: false, error: deducted.error };
      }
      revalidatePayoutPaths();
      return { success: true, message: PAYOUT_SUBMITTED_MESSAGE, pendingEarnings: deducted.pending };
    }

    const after = await availablePending(admin, user.id);
    if (after.pending > nextPending + 0.009) {
      const deducted = await writePending(admin, user.id, nextPending);
      if (!deducted.ok) return { success: false, error: deducted.error };
      revalidatePayoutPaths();
      return { success: true, message: PAYOUT_SUBMITTED_MESSAGE, pendingEarnings: deducted.pending };
    }

    revalidatePayoutPaths();
    const payload = (data ?? {}) as { pending_earnings?: number };
    return {
      success: true,
      message: PAYOUT_SUBMITTED_MESSAGE,
      pendingEarnings: payload.pending_earnings != null ? Number(payload.pending_earnings) : after.pending,
    };
  } catch (error) {
    return { success: false, error: errorMessage(error) };
  }
}

export async function savePayoutMethods(input: {
  method: PayoutMethod;
  usdtAddress: string;
  airtmEmail: string;
  paypalEmail: string;
}): Promise<PayoutActionResult> {
  if (!["crypto", "airtm", "paypal"].includes(input.method)) {
    return { success: false, error: "Choose Crypto, Airtm, or PayPal." };
  }

  const session = await createServerSupabaseClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) return { success: false, error: "You need to sign in." };

  const usdtAddress = input.usdtAddress.trim();
  const airtmEmail = input.airtmEmail.trim();
  const paypalEmail = input.paypalEmail.trim();
  if (input.method === "crypto" && !usdtAddress) {
    return { success: false, error: "Enter your USDT wallet address." };
  }
  if (input.method === "airtm" && !airtmEmail) {
    return { success: false, error: "Enter your Airtm email." };
  }
  if (input.method === "paypal" && !paypalEmail) {
    return { success: false, error: "Enter your PayPal email." };
  }

  const admin = createAdminClient();
  const payload = {
    payout_method: input.method,
    payout_usdt_address: usdtAddress || null,
    payout_airtm_email: airtmEmail || null,
    payout_paypal_email: paypalEmail || null,
  };
  const { error } = await admin.from("profiles").update(payload).eq("id", user.id);
  if (error) return { success: false, error: error.message };

  const { pending } = await availablePending(admin, user.id);
  revalidatePayoutPaths();
  return { success: true, message: "Payout methods saved.", pendingEarnings: pending };
}
