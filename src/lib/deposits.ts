import { TOKEN_PRICE } from "@/lib/format";

export const WALLET_TYPES = ["USDT (TRC-20)", "USDT (ERC-20)", "USDC (ERC-20)"] as const;

export type WalletType = (typeof WALLET_TYPES)[number];

export const DEPOSIT_PLANS = [
  { title: "Plan 1", amountUsd: 20, tokens: 100 },
  { title: "Plan 2", amountUsd: 50, tokens: 250 },
  { title: "Plan 3", amountUsd: 100, tokens: 500 },
  { title: "Plan 4", amountUsd: 500, tokens: 2500 },
  { title: "Plan 5", amountUsd: 1000, tokens: 5000 },
] as const;

export const CUSTOM_PLAN_TITLE = "Custom Plan";
export const CUSTOM_PLAN_MINIMUM_USD = 100;

export function tokensForUsd(amountUsd: number) {
  const cents = Math.round(amountUsd * 100);
  if (!Number.isFinite(cents) || cents < 0) return 0;
  return Math.floor(cents / Math.round(TOKEN_PRICE * 100));
}

export function explorerUrl(walletType: string, transactionHash: string) {
  const hash = transactionHash.trim();
  if (!hash) return null;
  const kind = walletType.toLowerCase();
  if (kind.includes("trc")) return `https://tronscan.org/#/transaction/${encodeURIComponent(hash)}`;
  if (kind.includes("erc")) return `https://etherscan.io/tx/${encodeURIComponent(hash)}`;
  return null;
}

export function isWalletType(value: string): value is WalletType {
  return WALLET_TYPES.some((type) => type === value);
}

export function expectedDeposit(planTitle: string, amountUsd: number, tokens: number) {
  const preset = DEPOSIT_PLANS.find((plan) => plan.title === planTitle);
  if (preset) {
    return preset.amountUsd === amountUsd && preset.tokens === tokens ? preset : null;
  }

  if (planTitle !== CUSTOM_PLAN_TITLE) return null;
  if (!Number.isFinite(amountUsd) || amountUsd < CUSTOM_PLAN_MINIMUM_USD) return null;

  const expectedTokens = tokensForUsd(amountUsd);
  if (expectedTokens < 1 || expectedTokens !== tokens) return null;

  return { title: CUSTOM_PLAN_TITLE, amountUsd, tokens: expectedTokens };
}
