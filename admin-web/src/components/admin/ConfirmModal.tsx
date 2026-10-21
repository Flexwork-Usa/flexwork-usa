"use client";

import type { ReactNode } from "react";
import { primaryButtonClass, secondaryButtonClass } from "@/lib/format";

export function ConfirmModal({
  title = "Confirm action",
  message = "Are you sure you want to perform this action?",
  confirmLabel = "Confirm",
  busy = false,
  onConfirm,
  onCancel,
  children,
}: {
  title?: string;
  message?: string;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">{message}</p>
        {children}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className={secondaryButtonClass} onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="button" className={primaryButtonClass} onClick={() => void onConfirm()} disabled={busy}>
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
