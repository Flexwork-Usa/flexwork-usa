"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { expireTreasuryDepositSession } from "@/actions/treasury-actions";
import type { WorkerDeposit, WorkerProfileView } from "@/components/dashboard/types";
import { Card, badgeClass, orangeButton, quietButton } from "@/components/dashboard/ui";
import { formatMoney, formatWhen } from "@/lib/format";
import { displayTreasuryStatus, formatCountdown, MIN_PAYOUT_USD, secondsUntil } from "@/lib/platform/rules";
import type { PayoutRequest, TreasuryDeposit } from "@/lib/platform/types";

const TABLE_PAGE_SIZE = 5;

function useTablePage<T>(items: T[]) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(items.length / TABLE_PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const rows = items.slice(safePage * TABLE_PAGE_SIZE, safePage * TABLE_PAGE_SIZE + TABLE_PAGE_SIZE);
  return { page: safePage, setPage, pageCount, rows, total: items.length };
}

function TablePager({
  page,
  pageCount,
  total,
  onPage,
}: {
  page: number;
  pageCount: number;
  total: number;
  onPage: (page: number) => void;
}) {
  if (total <= TABLE_PAGE_SIZE) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs text-slate-500">
        Page {page + 1} of {pageCount}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          className={`${quietButton} px-3 py-1.5 text-xs`}
          disabled={page === 0}
          onClick={() => onPage(page - 1)}
        >
          Previous
        </button>
        <button
          type="button"
          className={`${quietButton} px-3 py-1.5 text-xs`}
          disabled={page >= pageCount - 1}
          onClick={() => onPage(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

function PaymentsTab({
  profile,
  deposits,
  depositsError,
  onBuyTokens,
  onCompleteTransaction,
  onOpenPayout,
  payoutNotice,
  treasuryDeposits = [],
  payouts = [],
}: {
  profile: WorkerProfileView;
  deposits: WorkerDeposit[];
  depositsError?: string;
  onBuyTokens?: () => void;
  onCompleteTransaction?: (deposit: TreasuryDeposit) => void;
  onOpenPayout?: () => void;
  payoutNotice?: string | null;
  treasuryDeposits?: TreasuryDeposit[];
  payouts?: PayoutRequest[];
}) {
  const available = Math.max(0, profile.pendingEarnings);
  const orderRows = useMemo(
    () => [
      ...treasuryDeposits.map((deposit) => ({ kind: "treasury" as const, deposit })),
      ...deposits.map((deposit) => ({ kind: "legacy" as const, deposit })),
    ],
    [deposits, treasuryDeposits],
  );
  const payoutPage = useTablePage(payouts);
  const orderPage = useTablePage(orderRows);

  return (
    <div className="space-y-4">
      <Card className="border-orange-100 bg-gradient-to-r from-orange-50 via-white to-white">
        <p className="text-2xl font-semibold tracking-tight text-slate-900">Welcome back, {profile.fullName}!</p>
        <p className="mt-1 text-sm text-slate-600">Track token orders and request a payout from one place.</p>
      </Card>

      <Card className="border-orange-200 bg-orange-50/70">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[#C85A17]">Pending balance</p>
            <p className="mt-2 text-4xl font-semibold tracking-tight tabular-nums">{formatMoney(available)}</p>
            <p className="mt-2 text-sm text-slate-600">Earned balance {formatMoney(profile.totalEarnings)}</p>
          </div>
          {onOpenPayout ? (
            <button type="button" className={orangeButton} onClick={onOpenPayout}>
              Request Payout
            </button>
          ) : null}
        </div>
        {payoutNotice ? <p className="mt-3 text-sm text-red-700">{payoutNotice}</p> : null}
        <p className="mt-3 text-xs text-slate-500">Minimum payout threshold is {formatMoney(MIN_PAYOUT_USD)}.</p>
      </Card>

      <Card>
        <h3 className="font-semibold">Payout requests</h3>
        {payouts.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No payout requests yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="py-2 font-medium">Date</th>
                  <th className="py-2 font-medium">Method</th>
                  <th className="py-2 font-medium">Amount</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {payoutPage.rows.map((payout) => (
                  <tr key={payout.id} className="border-t border-slate-200">
                    <td className="py-3 text-slate-600">{formatWhen(payout.createdAt)}</td>
                    <td className="py-3 capitalize">{payout.method}</td>
                    <td className="py-3 tabular-nums">{formatMoney(payout.amount)}</td>
                    <td className="py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${badgeClass(payout.status)}`}>
                        {payout.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <TablePager
          page={payoutPage.page}
          pageCount={payoutPage.pageCount}
          total={payoutPage.total}
          onPage={payoutPage.setPage}
        />
      </Card>

      <Card>
        <h3 className="font-semibold">Orders & payments</h3>
        <p className="mt-1 text-sm text-slate-600">Every token order, payment status, and date.</p>
        {treasuryDeposits.length === 0 && deposits.length === 0 ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">No orders yet. Top up to buy tokens.</p>
            {onBuyTokens ? (
              <button type="button" className={quietButton} onClick={onBuyTokens}>
                Buy tokens
              </button>
            ) : null}
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="py-2 font-medium">Date</th>
                  <th className="py-2 font-medium">Order</th>
                  <th className="py-2 font-medium">Tokens</th>
                  <th className="py-2 font-medium">Amount</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {orderPage.rows.map((row) =>
                  row.kind === "treasury" ? (
                    <TreasuryOrderRow
                      key={row.deposit.id}
                      deposit={row.deposit}
                      onCompleteTransaction={onCompleteTransaction}
                    />
                  ) : (
                    <tr key={row.deposit.id} className="border-t border-slate-200">
                      <td className="py-3 text-slate-600">{formatWhen(row.deposit.createdAt)}</td>
                      <td className="py-3">{row.deposit.planTitle}</td>
                      <td className="py-3 tabular-nums">{row.deposit.tokens}</td>
                      <td className="py-3 tabular-nums">{formatMoney(row.deposit.amountUsd)}</td>
                      <td className="py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${badgeClass(row.deposit.status)}`}>
                          {row.deposit.status}
                        </span>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
        {depositsError ? <p className="mt-3 text-sm text-red-700">{depositsError}</p> : null}
        <TablePager
          page={orderPage.page}
          pageCount={orderPage.pageCount}
          total={orderPage.total}
          onPage={orderPage.setPage}
        />
      </Card>
    </div>
  );
}

function TreasuryOrderRow({
  deposit,
  onCompleteTransaction,
}: {
  deposit: TreasuryDeposit;
  onCompleteTransaction?: (deposit: TreasuryDeposit) => void;
}) {
  const [status, setStatus] = useState(() => displayTreasuryStatus(deposit.status, deposit.expiresAt));
  const [remaining, setRemaining] = useState(() => secondsUntil(deposit.expiresAt));
  const expiredSent = useRef(false);

  useEffect(() => {
    setStatus(displayTreasuryStatus(deposit.status, deposit.expiresAt));
    expiredSent.current = displayTreasuryStatus(deposit.status, deposit.expiresAt) === "expired";
  }, [deposit]);

  useEffect(() => {
    if (status !== "waiting") return;
    const tick = () => {
      const next = secondsUntil(deposit.expiresAt);
      setRemaining(next);
      if (next > 0) return;
      setStatus("expired");
      if (expiredSent.current) return;
      expiredSent.current = true;
      void expireTreasuryDepositSession(deposit.id);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [deposit.expiresAt, deposit.id, status]);

  const waiting = status === "waiting" && remaining > 0;

  return (
    <tr className="border-t border-slate-200">
      <td className="py-3 text-slate-600">{formatWhen(deposit.createdAt)}</td>
      <td className="py-3">
        {deposit.planTitle || deposit.memoCode}
        {waiting ? (
          <p className="mt-1 font-mono text-xs text-[#C85A17]">Session expires in {formatCountdown(remaining)}</p>
        ) : null}
      </td>
      <td className="py-3 tabular-nums">{deposit.tokensIssued}</td>
      <td className="py-3 tabular-nums">{formatMoney(deposit.usdtAmount)}</td>
      <td className="py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${badgeClass(status)}`}>{status}</span>
          {waiting && onCompleteTransaction ? (
            <button
              type="button"
              className="inline-flex items-center rounded-lg bg-[#C85A17] px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-[#A84810]"
              onClick={() => onCompleteTransaction(deposit)}
            >
              Complete transaction
            </button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

export default memo(PaymentsTab);
