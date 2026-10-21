"use client";

import { memo, useState } from "react";
import { CreditCard, Lock, Wallet } from "lucide-react";
import { TokenLogo } from "@/components/dashboard/CryptoNetworkIcons";
import { Card, Dialog } from "@/components/dashboard/ui";
import {
  CUSTOM_PLAN_MINIMUM_USD,
  CUSTOM_PLAN_TITLE,
  PAYMENT_ASSETS,
  TOKEN_PURCHASE_PLANS,
  WALLET_TYPES,
  makeCustomPlan,
  tokensForUsd,
  type TokenPurchasePlan,
  type WalletType,
} from "@/lib/deposits";
import { TOKEN_PRICE, formatMoney } from "@/lib/format";

const selectPlanButton =
  "inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700";

type PayMethod = "crypto" | "card";

function ComingSoonTag({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-800 ${className}`}
    >
      Coming soon
    </span>
  );
}

const CARD_BRANDS = [
  { src: "/cards/visa.svg", alt: "Visa" },
  { src: "/cards/mastercard.svg", alt: "Mastercard" },
  { src: "/cards/amex.svg", alt: "American Express" },
] as const;

function CardBrandMarks({ className = "h-7 w-11" }: { className?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      {CARD_BRANDS.map((brand) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={brand.alt}
          src={brand.src}
          alt={brand.alt}
          width={44}
          height={28}
          className={`rounded-sm object-contain shadow-sm ${className}`}
        />
      ))}
    </div>
  );
}

function BuyTokensTab({
  onSelectPlan,
}: {
  onSelectPlan: (plan: TokenPurchasePlan, network: WalletType) => void;
}) {
  const [method, setMethod] = useState<PayMethod>("crypto");
  const [network, setNetwork] = useState<WalletType>("USDT (TRC-20)");
  const [customUsd, setCustomUsd] = useState("");
  const [customError, setCustomError] = useState<string | null>(null);
  const [highlighted, setHighlighted] = useState<TokenPurchasePlan | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const customTokens = tokensForUsd(Number(customUsd) || 0);

  function choosePlan(plan: TokenPurchasePlan) {
    setHighlighted(plan);
    if (method === "crypto") {
      onSelectPlan(plan, network);
      return;
    }
    setCheckoutOpen(true);
  }

  function chooseCustom() {
    const plan = makeCustomPlan(Number(customUsd));
    if (!plan) {
      setCustomError(`Custom amounts require at least ${formatMoney(CUSTOM_PLAN_MINIMUM_USD)}.`);
      return;
    }
    setCustomError(null);
    choosePlan(plan);
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => {
            setMethod("crypto");
            setCheckoutOpen(false);
          }}
          className={`rounded-2xl border p-4 text-left transition-colors ${
            method === "crypto" ? "border-[#C85A17] bg-orange-50 ring-2 ring-[#C85A17]/20" : "border-slate-200 bg-white"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#C85A17] text-white">
              <Wallet className="h-5 w-5" aria-hidden />
            </span>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-emerald-800">
              Available
            </span>
          </div>
          <p className="mt-3 text-base font-bold text-slate-900">Pay with crypto</p>
          <p className="mt-1 text-sm text-slate-600">USDT or USDC. Opens a 15-minute payment session.</p>
        </button>

        <button
          type="button"
          onClick={() => setMethod("card")}
          className={`rounded-2xl border p-4 text-left transition-colors ${
            method === "card" ? "border-[#C85A17] bg-orange-50 ring-2 ring-[#C85A17]/20" : "border-slate-200 bg-white"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
              <CreditCard className="h-5 w-5" aria-hidden />
            </span>
            <ComingSoonTag />
          </div>
          <p className="mt-3 text-base font-bold text-slate-900">Pay with card</p>
          <p className="mt-1 text-sm text-slate-600">Visa, Mastercard, and Amex. Checkout is ready — payments are not live yet.</p>
          <div className="mt-3">
            <CardBrandMarks />
          </div>
        </button>
      </section>

      {method === "crypto" ? (
        <section>
          <p className="text-sm font-semibold text-slate-900">Choose token</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {WALLET_TYPES.map((item) => {
              const meta = PAYMENT_ASSETS[item];
              const selected = network === item;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => setNetwork(item)}
                  className={`flex items-center gap-3 rounded-xl border bg-white px-3 py-3 text-left ${
                    selected ? "border-[#C85A17] ring-2 ring-[#C85A17]/20" : "border-slate-200"
                  }`}
                >
                  <TokenLogo asset={item} className="h-8 w-8" />
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">{meta.title}</span>
                    <span className="block text-xs text-slate-500">{meta.subtitle}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      <section>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-slate-900">Choose a plan</p>
            <p className="mt-1 text-sm text-slate-600">{formatMoney(TOKEN_PRICE)} per token</p>
          </div>
          {method === "card" ? <ComingSoonTag /> : null}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {TOKEN_PURCHASE_PLANS.map((plan) => {
            const featured = plan.id === "pro";
            const active = highlighted?.id === plan.id && highlighted.amountUsd === plan.amountUsd;
            return (
              <article
                key={plan.id}
                className={`relative flex flex-col rounded-2xl border bg-white p-5 shadow-sm ${
                  featured ? "border-[#C85A17] ring-1 ring-[#C85A17]/20" : "border-slate-200"
                } ${active && method === "card" ? "ring-2 ring-[#C85A17]/30" : ""}`}
              >
                {featured ? (
                  <p className="absolute -top-2.5 right-4 rounded-full bg-[#C85A17] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    Popular
                  </p>
                ) : null}
                <p className="text-xs font-bold uppercase tracking-wide text-[#C85A17]">{plan.title}</p>
                <p className="mt-3 text-4xl font-bold tabular-nums tracking-tight text-slate-900">
                  {plan.tokens.toLocaleString()}
                </p>
                <p className="text-sm font-medium text-slate-500">tokens</p>
                <p className="mt-4 text-2xl font-bold tabular-nums text-slate-900">{formatMoney(plan.amountUsd)}</p>
                <p className="mt-1 text-sm text-slate-600">{plan.blurb}</p>
                <button
                  type="button"
                  className={`${selectPlanButton} mt-5 ${method === "card" ? "bg-[#C85A17] hover:bg-[#A84810]" : ""}`}
                  onClick={() => choosePlan(plan)}
                >
                  {method === "card" ? "Preview checkout" : "Select Plan"}
                </button>
              </article>
            );
          })}

          <Card className="border-dashed">
            <p className="text-xs font-bold uppercase tracking-wide text-[#C85A17]">{CUSTOM_PLAN_TITLE}</p>
            <p className="mt-2 text-sm text-slate-600">Minimum {formatMoney(CUSTOM_PLAN_MINIMUM_USD)}</p>
            <label className="mt-3 block text-sm font-medium">
              Amount (USD)
              <input
                className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#C85A17] disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                inputMode="decimal"
                value={customUsd}
                placeholder="100"
                onChange={(event) => {
                  setCustomUsd(event.target.value);
                  setCustomError(null);
                }}
              />
            </label>
            <p className="mt-2 text-sm text-slate-600">
              {customTokens > 0 ? `${customTokens.toLocaleString()} tokens at ${formatMoney(TOKEN_PRICE)} each` : "Tokens calculate at $0.20 each"}
            </p>
            {customError ? <p className="mt-2 text-sm text-red-700">{customError}</p> : null}
            <button
              type="button"
              className={`${selectPlanButton} mt-4 ${method === "card" ? "bg-[#C85A17] hover:bg-[#A84810]" : ""}`}
              onClick={chooseCustom}
            >
              {method === "card" ? "Preview checkout" : "Select Plan"}
            </button>
          </Card>
        </div>
      </section>

      {checkoutOpen && highlighted ? (
        <Dialog title="Card checkout" onClose={() => setCheckoutOpen(false)} className="max-w-lg">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              {highlighted.title} · {highlighted.tokens.toLocaleString()} tokens · {formatMoney(highlighted.amountUsd)}
            </p>
            <div className="flex items-center gap-2">
              <CardBrandMarks />
              <ComingSoonTag />
            </div>
          </div>
          <div className="pointer-events-none mt-4 select-none opacity-60">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium sm:col-span-2">
                Cardholder name
                <input className={lockedField} disabled readOnly tabIndex={-1} placeholder="Name on card" value="" />
              </label>
              <label className="block text-sm font-medium sm:col-span-2">
                Card number
                <input
                  className={lockedField}
                  disabled
                  readOnly
                  tabIndex={-1}
                  inputMode="numeric"
                  placeholder="ACCT-000003"
                  value=""
                  autoComplete="off"
                />
              </label>
              <label className="block text-sm font-medium">
                Expiry
                <input className={lockedField} disabled readOnly tabIndex={-1} placeholder="MM / YY" value="" autoComplete="off" />
              </label>
              <label className="block text-sm font-medium">
                CVC
                <input className={lockedField} disabled readOnly tabIndex={-1} placeholder="123" value="" autoComplete="off" />
              </label>
            </div>
            <button
              type="button"
              disabled
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600"
            >
              <Lock className="h-4 w-4" aria-hidden />
              Pay {formatMoney(highlighted.amountUsd)} with card
            </button>
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p>
              Card payments are coming soon. Card details cannot be entered. Use <span className="font-semibold">Pay with crypto</span> to
              buy tokens now.
            </p>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}

const lockedField =
  "mt-1.5 h-11 w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-400";

export default memo(BuyTokensTab);
