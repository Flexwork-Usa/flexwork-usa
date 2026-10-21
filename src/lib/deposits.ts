import { TOKEN_PRICE } from "@/lib/format";
import type { TreasuryNetwork } from "@/lib/platform/types";

export const WALLET_TYPES = ["USDT (TRC-20)", "USDT (ERC-20)", "USDC (ERC-20)"] as const;

export type WalletType = (typeof WALLET_TYPES)[number];

export const PAYMENT_ASSETS: Record<
  WalletType,
  {
    token: "USDT" | "USDC";
    network: TreasuryNetwork;
    title: string;
    subtitle: string;
    logo: string;
    chainLogo: string;
  }
> = {
  "USDT (TRC-20)": {
    token: "USDT",
    network: "TRC20",
    title: "USDT (Tether)",
    subtitle: "Tron TRC-20",
    logo: "/tokens/usdt.svg",
    chainLogo: "/tokens/trx.svg",
  },
  "USDT (ERC-20)": {
    token: "USDT",
    network: "ERC20",
    title: "USDT (ETH)",
    subtitle: "Ethereum ERC-20",
    logo: "/tokens/usdt.svg",
    chainLogo: "/tokens/eth.svg",
  },
  "USDC (ERC-20)": {
    token: "USDC",
    network: "ERC20",
    title: "USDC (ETH)",
    subtitle: "Ethereum ERC-20",
    logo: "/tokens/usdc.svg",
    chainLogo: "/tokens/eth.svg",
  },
};

export function treasuryNetworkForAsset(asset: WalletType): TreasuryNetwork {
  return PAYMENT_ASSETS[asset].network;
}

export function walletTypeFromNetwork(network?: string | null, fallback: WalletType = "USDT (TRC-20)"): WalletType {
  if (network === "TRC20" || network === "USDT (TRC-20)") return "USDT (TRC-20)";
  if (network === "USDC (ERC-20)") return "USDC (ERC-20)";
  if (network === "ERC20" || network === "USDT (ERC-20)") {
    return fallback === "USDC (ERC-20)" ? "USDC (ERC-20)" : "USDT (ERC-20)";
  }
  return WALLET_TYPES.includes(network as WalletType) ? (network as WalletType) : fallback;
}

export const TOKEN_PURCHASE_PLANS = [
  { id: "starter", title: "Starter Tier", amountUsd: 20, tokens: 100, blurb: "$0.20 per token" },
  { id: "growth", title: "Growth Tier", amountUsd: 50, tokens: 250, blurb: "$0.20 per token" },
  { id: "pro", title: "Pro Tier", amountUsd: 100, tokens: 500, blurb: "$0.20 per token" },
  { id: "executive", title: "Executive Tier", amountUsd: 500, tokens: 2500, blurb: "$0.20 per token" },
  { id: "enterprise", title: "Enterprise Tier", amountUsd: 1000, tokens: 5000, blurb: "$0.20 per token" },
] as const;

export type PresetTokenPlan = (typeof TOKEN_PURCHASE_PLANS)[number];

export type TokenPurchasePlan = {
  id: string;
  title: string;
  amountUsd: number;
  tokens: number;
  blurb?: string;
};

export const DEPOSIT_PLANS = TOKEN_PURCHASE_PLANS.map((plan) => ({
  title: plan.title,
  amountUsd: plan.amountUsd,
  tokens: plan.tokens,
}));

export const CUSTOM_PLAN_TITLE = "Custom Amount";
export const CUSTOM_PLAN_MINIMUM_USD = 100;

export function tokensForUsd(amountUsd: number) {
  const cents = Math.round(amountUsd * 100);
  if (!Number.isFinite(cents) || cents < 0) return 0;
  return Math.floor(cents / Math.round(TOKEN_PRICE * 100));
}

export function makeCustomPlan(amountUsd: number): TokenPurchasePlan | null {
  if (!Number.isFinite(amountUsd)) return null;
  const rounded = Math.round(amountUsd * 100) / 100;
  if (rounded < CUSTOM_PLAN_MINIMUM_USD) return null;
  const tokens = tokensForUsd(rounded);
  if (tokens < 1) return null;
  return {
    id: "custom",
    title: CUSTOM_PLAN_TITLE,
    amountUsd: rounded,
    tokens,
    blurb: `${tokens.toLocaleString()} tokens at $0.20 each`,
  };
}

export function resolvePurchasePlan(input: {
  planTitle?: string;
  usdtAmount: number;
  tokensIssued?: number;
}): TokenPurchasePlan | null {
  const usdtAmount = Number(input.usdtAmount);
  const tokens =
    Number.isFinite(input.tokensIssued) && Number(input.tokensIssued) >= 1
      ? Math.floor(Number(input.tokensIssued))
      : tokensForUsd(usdtAmount);

  if (input.planTitle === CUSTOM_PLAN_TITLE) {
    const custom = makeCustomPlan(usdtAmount);
    return custom && custom.tokens === tokens ? custom : null;
  }

  const preset = TOKEN_PURCHASE_PLANS.find(
    (plan) =>
      plan.title === input.planTitle ||
      (plan.amountUsd === usdtAmount && plan.tokens === tokens),
  );
  if (preset) return { ...preset };

  if (!input.planTitle && usdtAmount >= CUSTOM_PLAN_MINIMUM_USD) {
    const custom = makeCustomPlan(usdtAmount);
    if (custom && custom.tokens === tokens) return custom;
  }

  return null;
}

export function explorerUrl(walletType: string, transactionHash: string) {
  const hash = transactionHash.trim();
  if (!hash) return null;
  const kind = walletType.toLowerCase();
  if (kind.includes("trc")) return `https://tronscan.org/#/transaction/${encodeURIComponent(hash)}`;
  if (kind.includes("bep") || kind.includes("bsc")) return `https://bscscan.com/tx/${encodeURIComponent(hash)}`;
  if (kind.includes("erc")) return `https://etherscan.io/tx/${encodeURIComponent(hash)}`;
  return null;
}

export function isWalletType(value: string): value is WalletType {
  return WALLET_TYPES.some((type) => type === value);
}

export function expectedDeposit(planTitle: string, amountUsd: number, tokens: number) {
  return resolvePurchasePlan({ planTitle, usdtAmount: amountUsd, tokensIssued: tokens });
}
