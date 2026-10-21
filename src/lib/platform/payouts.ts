import type { PayoutMethod, PayoutRequest, PayoutStatus } from "@/lib/platform/types";

export function parsePayoutMethod(value: unknown): PayoutMethod {
  return value === "airtm" || value === "paypal" || value === "crypto" ? value : "crypto";
}

export function parsePayoutStatus(value: unknown): PayoutStatus {
  if (value === "approved" || value === "rejected") return value;
  if (value === "paid") return "approved";
  return "pending";
}

export function mapPayoutRequestRow(row: Record<string, unknown>): PayoutRequest {
  const createdAt = String(row.created_at ?? new Date().toISOString());
  const recordedAt = row.reviewed_at ?? row.updated_at ?? row.created_at;
  return {
    id: String(row.id),
    workerId: String(row.worker_id ?? ""),
    method: parsePayoutMethod(row.method ?? row.payment_method),
    address: String(row.address ?? row.payout_details ?? row.destination ?? ""),
    amount: Number(row.amount ?? row.amount_usd ?? 0),
    status: parsePayoutStatus(row.status),
    createdAt,
    recordedAt: recordedAt ? String(recordedAt) : createdAt,
  };
}
