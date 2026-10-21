"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/dashboard/ui";
import type { LeaderboardEntry } from "@/lib/platform/types";
import { formatMoney } from "@/lib/format";

function LeaderboardWidget({ entries }: { entries: LeaderboardEntry[] }) {
  return (
    <Card>
      <h2 className="text-lg font-semibold">Explore Top Workers</h2>
      <p className="mt-1 text-sm text-slate-600">See how fellow workers are performing this month.</p>
      {entries.length === 0 ? <p className="mt-4 text-sm text-slate-600">Top workers will appear here as activity grows.</p> : null}
      <ul className="mt-4 space-y-3">
        {entries.slice(0, 50).map((entry, index) => (
          <motion.li
            key={entry.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(index * 0.02, 0.3) }}
            className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-0"
          >
            <div>
              <p className="text-sm font-semibold">
                #{entry.rankOrder} {entry.workerName}
              </p>
              <p className="text-xs text-slate-600">
                <span aria-hidden="true">{countryFlag(entry.country)} </span>
                {entry.country || "Remote"} · {entry.emailMasked}
              </p>
              {entry.skill ? (
                <span className="mt-1 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">{entry.skill}</span>
              ) : null}
            </div>
            <p className="text-sm font-medium tabular-nums">{formatMoney(entry.totalEarnings)}</p>
          </motion.li>
        ))}
      </ul>
    </Card>
  );
}

function countryFlag(country: string) {
  const name = country.trim().toLowerCase();
  if (!name) return "🌐";
  const map: Record<string, string> = {
    "united states": "🇺🇸",
    usa: "🇺🇸",
    us: "🇺🇸",
    canada: "🇨🇦",
    "united kingdom": "🇬🇧",
    uk: "🇬🇧",
    india: "🇮🇳",
    philippines: "🇵🇭",
    nigeria: "🇳🇬",
    kenya: "🇰🇪",
    mexico: "🇲🇽",
    brazil: "🇧🇷",
    germany: "🇩🇪",
    france: "🇫🇷",
    australia: "🇦🇺",
  };
  return map[name] ?? "🏳️";
}

export default memo(LeaderboardWidget);
