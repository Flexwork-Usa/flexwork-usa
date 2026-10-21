"use client";

import { useEffect, useId, type ReactNode } from "react";
import { X } from "lucide-react";
import { WALLET_TYPES, type WalletType } from "@/lib/deposits";
import type { WorkerProfileView } from "@/components/dashboard/types";

export const orangeButton =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-[#C85A17] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#A84810] disabled:cursor-not-allowed disabled:opacity-60";

export const primaryButton = orangeButton;

export const quietButton =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50";

export const fieldClass =
  "mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-[#C85A17]";

export const OUTPUT_KEY = "flexwork-task-outputs";
export const PREFERENCE_KEY = "flexwork-payment-preference";

const WALLET_FIELDS: Record<WalletType, keyof WorkerProfileView> = {
  "USDT (TRC-20)": "walletUsdtTron",
  "USDT (ERC-20)": "walletUsdtEth",
  "USDC (ERC-20)": "walletUsdcEth",
};

export function assignedAddress(profile: WorkerProfileView, type: WalletType) {
  const value = profile[WALLET_FIELDS[type]];
  return typeof value === "string" ? value.trim() : "";
}

export function appliedLabel(status: string) {
  const text = status.toLowerCase();
  if (text === "rejected") return "Rejected";
  if (text === "hired" || text === "accepted" || text === "approved" || text === "assigned") {
    return "Approved / Assigned";
  }
  return "Pending Admin Review";
}

export function activeLabel(status: string) {
  const text = status.toLowerCase();
  if (text === "completed") return "Completed";
  if (text === "hired") return "Hired · Ready";
  if (text === "reviewing" || text === "under_review") return "Under Review";
  return "In Progress";
}

export function isActiveStatus(status: string) {
  const text = status.toLowerCase();
  return ["accepted", "approved", "assigned", "hired", "in_progress", "reviewing", "under_review", "completed"].includes(
    text,
  );
}

export function badgeClass(label: string) {
  const text = label.toLowerCase();
  if (label === "Rejected" || text === "rejected" || text === "expired") return "bg-red-50 text-red-800";
  if (
    label === "Hired" ||
    label === "Approved / Assigned" ||
    label === "Completed" ||
    text === "finished" ||
    text === "approved" ||
    text === "hired"
  ) {
    return "bg-emerald-50 text-emerald-800";
  }
  if (
    label === "Under Review" ||
    label === "Pending Admin Review" ||
    text === "pending" ||
    text === "waiting"
  ) {
    return "bg-orange-100 text-[#C85A17]";
  }
  return "bg-slate-100 text-slate-700";
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>{children}</section>;
}

export function Dialog({
  title,
  onClose,
  children,
  className = "max-w-lg",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const titleId = useId();
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
          <button type="button" className="rounded-lg border border-slate-200 p-1.5" aria-label="Close" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

export function readStoredPreference() {
  const stored = window.localStorage.getItem(PREFERENCE_KEY);
  return stored && WALLET_TYPES.includes(stored as WalletType) ? (stored as WalletType) : null;
}
