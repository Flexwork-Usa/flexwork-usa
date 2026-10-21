import { TOKEN_PRICE } from "@/lib/format";

export const WALLET_TYPES = ["USDT (TRC-20)", "USDT (ERC-20)", "USDC (ERC-20)"] as const;

export type WalletType = (typeof WALLET_TYPES)[number];

export const DEPOSIT_PLANS = [
  { title: "Starter Tier", amountUsd: 20, tokens: 100 },
  { title: "Growth Tier", amountUsd: 50, tokens: 250 },
  { title: "Pro Tier", amountUsd: 100, tokens: 500 },
  { title: "Executive Tier", amountUsd: 500, tokens: 2500 },
  { title: "Enterprise Tier", amountUsd: 1000, tokens: 5000 },
] as const;

export const CUSTOM_PLAN_TITLE = "Custom Amount";
export const CUSTOM_PLAN_MINIMUM_USD = 100;
const LEGACY_CUSTOM_PLAN_TITLES = new Set([CUSTOM_PLAN_TITLE, "Custom Plan"]);

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
  if (kind.includes("bep") || kind.includes("bsc")) return `https://bscscan.com/tx/${encodeURIComponent(hash)}`;
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

  if (!LEGACY_CUSTOM_PLAN_TITLES.has(planTitle)) return null;
  if (!Number.isFinite(amountUsd) || amountUsd < CUSTOM_PLAN_MINIMUM_USD) return null;

  const expectedTokens = tokensForUsd(amountUsd);
  if (expectedTokens < 1 || expectedTokens !== tokens) return null;

  return { title: CUSTOM_PLAN_TITLE, amountUsd, tokens: expectedTokens };
}
