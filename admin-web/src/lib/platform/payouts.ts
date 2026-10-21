import type { PayoutMethod, PayoutRequest, PayoutStatus } from "@/lib/platform/types";

export function parsePayoutMethod(value: unknown): PayoutMethod {
  return value === "airtm" || value === "paypal" || value === "crypto" ? value : "crypto";
}

export function parsePayoutStatus(value: unknown): PayoutStatus {
  if (value === "approved" || value === "rejected") return value;
  if (value === "paid") return "approved";
  return "pending";
}

export function mapPayoutRequestRow(
  row: Record<string, unknown>,
  worker?: { name: string; email: string | null },
): PayoutRequest {
  return {
    id: String(row.id),
    workerId: String(row.worker_id ?? ""),
    workerName: worker?.name || "Worker",
    workerEmail: worker?.email ?? null,
    method: parsePayoutMethod(row.method ?? row.payment_method),
    address: String(row.address ?? row.payout_details ?? row.destination ?? ""),
    amount: Number(row.amount ?? row.amount_usd ?? 0),
    status: parsePayoutStatus(row.status),
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}
