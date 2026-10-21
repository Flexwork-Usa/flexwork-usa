export const EARNINGS_RANGE_DAYS = 30;

export type EarningsInputPoint = { day: string; amount: number };
export type EarningsSeriesPoint = { day: string; amount: number; total: number };
export type EarningsEvent = {
  amount: number;
  status: string;
  createdAt: string;
  recordedAt?: string | null;
};

export function localDayKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function toDayKey(value: string) {
  const trimmed = String(value ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return "";
  return localDayKey(parsed);
}

export function startOfLocalDay(value: Date) {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function roundMoney(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function isPaidEarningsStatus(status: string) {
  const text = status.toLowerCase();
  return text === "approved" || text === "paid";
}

export function buildWorkerEarningsSeries({
  payouts = [],
  rpcEarnings = [],
  earnedThisMonth = 0,
  now = new Date(),
  rangeDays = EARNINGS_RANGE_DAYS,
}: {
  payouts?: EarningsEvent[];
  rpcEarnings?: EarningsInputPoint[];
  earnedThisMonth?: number;
  now?: Date;
  rangeDays?: number;
}): EarningsSeriesPoint[] {
  const today = startOfLocalDay(now);
  const start = startOfLocalDay(now);
  start.setDate(start.getDate() - (rangeDays - 1));
  const startKey = localDayKey(start);
  const todayKey = localDayKey(today);
  const monthKey = todayKey.slice(0, 7);
  const byDay = new Map<string, number>();

  const paidPayouts = payouts.filter((item) => isPaidEarningsStatus(item.status) && roundMoney(item.amount) > 0);
  const source = paidPayouts.length > 0
    ? paidPayouts.map((item) => ({
        day: toDayKey(item.recordedAt || item.createdAt),
        amount: roundMoney(item.amount),
      }))
    : rpcEarnings.map((item) => ({
        day: toDayKey(item.day),
        amount: roundMoney(item.amount),
      }));

  for (const item of source) {
    if (!item.day || item.day < startKey || item.day > todayKey || item.amount <= 0) continue;
    byDay.set(item.day, roundMoney((byDay.get(item.day) ?? 0) + item.amount));
  }

  let monthSum = 0;
  for (const [day, amount] of byDay) {
    if (day.startsWith(monthKey)) monthSum = roundMoney(monthSum + amount);
  }
  const residual = roundMoney(Math.max(0, Number(earnedThisMonth) || 0) - monthSum);
  if (residual > 0) {
    byDay.set(todayKey, roundMoney((byDay.get(todayKey) ?? 0) + residual));
  }

  const series: EarningsSeriesPoint[] = [];
  const cursor = new Date(start);
  let running = 0;
  for (let i = 0; i < rangeDays; i += 1) {
    const day = localDayKey(cursor);
    const amount = byDay.get(day) ?? 0;
    running = roundMoney(running + amount);
    series.push({ day, amount, total: running });
    cursor.setDate(cursor.getDate() + 1);
  }
  return series;
}
