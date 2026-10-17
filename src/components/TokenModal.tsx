"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useApp } from "@/context/AppContext";
import {
  formatMoney,
  primaryButtonClass,
  secondaryButtonClass,
  TOKEN_PACKS,
  TOKEN_PRICE,
  WORKER,
} from "@/lib/format";

export function TokenModal() {
  const { tokenModalOpen, closeTokenModal, role, tokens, buyTokens, setRole } = useApp();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!tokenModalOpen) return;
    dialogRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") closeTokenModal();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tokenModalOpen, closeTokenModal]);

  return (
    <AnimatePresence>
      {tokenModalOpen ? (
        <motion.div
          key="token-modal"
          className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <button
            type="button"
            aria-label="Close buy tokens"
            className="absolute inset-0 bg-black/40"
            onClick={closeTokenModal}
          />
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="token-modal-title"
            tabIndex={-1}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15 }}
            className="relative z-10 max-h-[min(90vh,40rem)] w-full max-w-xl overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-sm outline-none"
          >
            <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4">
              <div>
                <h2 id="token-modal-title" className="text-base font-semibold text-gray-900">
                  Buy Tokens
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  {formatMoney(TOKEN_PRICE)} per token. Tokens are used to apply to affiliate roles.
                </p>
              </div>
              <button
                type="button"
                onClick={closeTokenModal}
                className="rounded-md p-1 text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-5">
              <p className="text-sm text-gray-600">
                Current balance{" "}
                <span className="font-semibold text-gray-900 tabular-nums">{tokens} tokens</span>
                {role === "worker" ? ` · ${WORKER.name}` : ""}
              </p>

              {role !== "worker" ? (
                <div className="mt-4 rounded-lg border border-gray-200 px-4 py-4">
                  <p className="text-sm leading-6 text-gray-600">
                    Purchases are added to {WORKER.name}&apos;s worker balance. Switch to Worker
                    View to continue.
                  </p>
                  <button
                    type="button"
                    className={`${primaryButtonClass} mt-4`}
                    onClick={() => setRole("worker")}
                  >
                    Continue as {WORKER.name}
                  </button>
                </div>
              ) : (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {TOKEN_PACKS.map((pack) => (
                    <div key={pack.tokens} className="rounded-lg border border-gray-200 p-4">
                      <p className="text-sm font-medium text-gray-900">{pack.tokens} tokens</p>
                      <p className="mt-2 text-2xl font-semibold tracking-tight text-gray-900 tabular-nums">
                        {formatMoney(pack.price)}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {formatMoney(TOKEN_PRICE)} each
                      </p>
                      <button
                        type="button"
                        className={`${primaryButtonClass} mt-4 w-full`}
                        onClick={() => buyTokens(pack.tokens, formatMoney(pack.price))}
                      >
                        Pay {formatMoney(pack.price)}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <p className="mt-4 text-xs leading-5 text-gray-500">
                Simulated checkout. No card is charged, and the balance stays in this browser
                session.
              </p>
              {role === "worker" ? (
                <button
                  type="button"
                  className={`${secondaryButtonClass} mt-4`}
                  onClick={closeTokenModal}
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
