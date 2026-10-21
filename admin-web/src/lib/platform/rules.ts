import { TOKEN_PRICE } from "@/lib/format";
import type { ManagedJob } from "@/lib/platform/types";

export const SIGNUP_TOKEN_BONUS = 50;
export const MIN_STAKE_TOKENS = 5;
export const JOB_TAG_OPTIONS = ["Hiring", "New", "Urgent"] as const;

const MIN_TOKEN_TAG = /^__min:(\d+)$/i;
const STATUS_TAG = /^__status:(hiring|paused|closed)$/i;

export function parseJobTags(value: unknown): string[] {
  const parts = Array.isArray(value) ? value : String(value ?? "").split(/[,|]/);
  return [...new Set(parts.map((item) => String(item).trim()).filter(Boolean))];
}

export function isMetaJobTag(tag: string) {
  return MIN_TOKEN_TAG.test(tag) || STATUS_TAG.test(tag);
}

export function visibleJobTags(value: unknown): string[] {
  return parseJobTags(value).filter((tag) => !isMetaJobTag(tag));
}

export function encodeJobMetaTags(
  tags: unknown,
  meta: { minTokens?: number; hiringStatus?: "hiring" | "paused" | "closed" },
): string[] {
  const next = visibleJobTags(tags);
  next.push(`__min:${Math.max(1, Math.floor(Number(meta.minTokens ?? MIN_STAKE_TOKENS) || MIN_STAKE_TOKENS))}`);
  if (meta.hiringStatus) next.push(`__status:${meta.hiringStatus}`);
  return next;
}

export function jobMinTokens(row: { min_tokens?: number | null; token_cost?: number | null; tags?: unknown }) {
  const direct = row.min_tokens ?? row.token_cost;
  if (direct != null && Number(direct) > 0) return Math.max(1, Math.floor(Number(direct)));
  const match = parseJobTags(row.tags)
    .map((tag) => tag.match(MIN_TOKEN_TAG))
    .find(Boolean);
  return match ? Math.max(1, Number(match[1])) : MIN_STAKE_TOKENS;
}

export function jobHiringStatus(
  row: { hiring_status?: string | null; is_active?: boolean | null; tags?: unknown },
): "hiring" | "paused" | "closed" {
  if (row.hiring_status === "hiring" || row.hiring_status === "paused" || row.hiring_status === "closed") {
    return row.hiring_status;
  }
  const match = parseJobTags(row.tags)
    .map((tag) => tag.match(STATUS_TAG))
    .find(Boolean);
  if (match) return match[1] as "hiring" | "paused" | "closed";
  if (row.is_active === false) return "closed";
  return "hiring";
}

export function encodeApplicantExtras(email: string, country: string, coverLetter: string) {
  return `Email: ${email.trim()}\nCountry: ${country.trim()}\n\n${coverLetter.trim()}`;
}

export function parseApplicantExtras(coverLetter: string | null | undefined) {
  const text = coverLetter ?? "";
  const email = text.match(/^Email:\s*(.*)$/im)?.[1]?.trim() || null;
  const country = text.match(/^Country:\s*(.*)$/im)?.[1]?.trim() || null;
  const body = text.replace(/^(Email|Country):\s*.+\r?\n?/gim, "").replace(/^\s+/, "");
  return { email, country, coverLetter: body };
}

export function payTypeFromRate(value: string): "hourly" | "quota" {
  return /quota|task|project/i.test(value) ? "quota" : "hourly";
}

export function parsePayAmount(value: string | number | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const match = String(value ?? "").replace(/,/g, "").match(/(\d+(\.\d+)?)/);
  return match ? Number(match[1]) : 0;
}
export const DEPOSIT_SESSION_MINUTES = 15;
export const PASSWORD_LOCK_HOURS = 24;
export const NEW_JOB_HOURS = 12;
export const MIN_PAYOUT_USD = 50;
export const CRYPTO_NETWORKS = ["TRC20", "BEP20"] as const;

export function canManageRole(actor: string, target: string) {
  if (actor === "super_admin") return target === "admin" || target === "worker_admin";
  if (actor === "admin") return target === "worker_admin";
  return false;
}

export function tokensFromUsdt(usdtAmount: number) {
  const cents = Math.round(usdtAmount * 100);
  if (!Number.isFinite(cents) || cents <= 0) return 0;
  return Math.floor(cents / Math.round(TOKEN_PRICE * 100));
}

export function jobTags(job: Pick<ManagedJob, "createdAt" | "slotsNeeded" | "applicationCount">) {
  const created = new Date(job.createdAt).getTime();
  const isNew = Number.isFinite(created) && Date.now() - created <= NEW_JOB_HOURS * 60 * 60 * 1000;
  const isHighDemand = job.slotsNeeded > 0 && job.applicationCount >= Math.ceil(job.slotsNeeded * 0.8);
  return { isNew, isHighDemand };
}

export function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const visible = local.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(local.length - 2, 2))}@${domain}`;
}

export function secondsUntil(iso: string) {
  const target = new Date(iso).getTime();
  if (!Number.isFinite(target)) return 0;
  return Math.max(0, Math.floor((target - Date.now()) / 1000));
}

export function formatCountdown(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
