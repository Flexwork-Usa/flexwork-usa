import type { JobTier } from "@/lib/types";

export const WORKER = {
  name: "John Doe",
  email: "john.doe@flexwork.test",
  location: "Austin, TX",
  sampleResume: "John_Doe_Resume.pdf",
};

export const TOKEN_PRICE = 0.2;

export const TOKEN_PACKS = [
  { tokens: 100, price: 20 },
  { tokens: 250, price: 50 },
  { tokens: 500, price: 100 },
  { tokens: 2500, price: 500 },
  { tokens: 5000, price: 1000 },
] as const;

export const TIER_META: Record<
  JobTier,
  { label: string; name: string; blurb: string }
> = {
  1: {
    label: "Tier 1",
    name: "Curated",
    blurb: "Free to apply",
  },
  2: {
    label: "Tier 2",
    name: "Affiliate",
    blurb: "Token-gated",
  },
  3: {
    label: "Tier 3",
    name: "Third-Party AI",
    blurb: "Apply on the partner platform",
  },
};

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatWhen(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatDelta(delta: number) {
  if (delta > 0) return `+${delta}`;
  if (delta < 0) return `−${Math.abs(delta)}`;
  return "0";
}

export function externalUrl(value?: string) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export const fieldClass =
  "mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-gray-900";

export const primaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-black px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 disabled:hover:bg-gray-100";

export const secondaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900 disabled:cursor-not-allowed disabled:text-gray-400";
