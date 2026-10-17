"use client";

import { useState } from "react";
import { JobCard } from "@/components/JobCard";
import { useApp } from "@/context/AppContext";
import { cx, TIER_META, WORKER } from "@/lib/format";
import type { JobTier } from "@/lib/types";

type Filter = "all" | JobTier;

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All Jobs" },
  { id: 1, label: "Tier 1: Curated" },
  { id: 2, label: "Tier 2: Affiliate" },
  { id: 3, label: "Tier 3: Third-Party AI" },
];

export function Marketplace() {
  const { jobs, role, tokens } = useApp();
  const [filter, setFilter] = useState<Filter>("all");
  const tiers: JobTier[] = filter === "all" ? [1, 2, 3] : [filter];

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Remote roles</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
            Curated listings are free to apply. Affiliate roles spend tokens. Partner platforms
            open in a new tab, with a preparation guide on the card.
          </p>
        </div>
        <p className="text-sm text-gray-500">
          {role === "worker"
            ? `Applying as ${WORKER.name} · ${tokens} tokens`
            : role === "admin"
              ? "Admin preview"
              : "Browsing as a guest"}
        </p>
      </div>

      <dl className="mt-6 grid grid-cols-1 divide-y divide-gray-200 rounded-xl border border-gray-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {([1, 2, 3] as JobTier[]).map((tier) => {
          const count = jobs.filter((job) => job.tier === tier).length;
          const meta = TIER_META[tier];
          return (
            <div key={tier} className="px-4 py-4">
              <dt className="text-xs font-medium tracking-wide text-gray-500 uppercase">
                {meta.label}: {meta.name}
              </dt>
              <dd className="mt-1 text-sm font-medium text-gray-900">
                {count} {count === 1 ? "role" : "roles"}
                <span className="ml-2 font-normal text-gray-500">{meta.blurb}</span>
              </dd>
            </div>
          );
        })}
      </dl>

      <div className="mt-6 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div
          role="tablist"
          aria-label="Job tiers"
          className="flex w-max gap-1 rounded-lg border border-gray-200 p-1"
        >
          {FILTERS.map((item) => {
            const active = filter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(item.id)}
                className={cx(
                  "rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
                  active
                    ? "bg-black text-white"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-8 space-y-10">
        {tiers.map((tier) => {
          const list = jobs.filter((job) => job.tier === tier);
          const meta = TIER_META[tier];
          return (
            <section key={tier} aria-label={`${meta.label}: ${meta.name}`}>
              <div className="mb-4 flex items-baseline justify-between gap-4">
                <h2 className="text-sm font-semibold text-gray-900">
                  {meta.label}: {meta.name}
                </h2>
                <p className="text-sm text-gray-500">{meta.blurb}</p>
              </div>
              {list.length === 0 ? (
                <p className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-sm text-gray-500">
                  No roles in this tier yet.
                </p>
              ) : (
                <div
                  className={
                    tier === 3 ? "grid gap-4" : "grid gap-4 md:grid-cols-2"
                  }
                >
                  {list.map((job) => (
                    <JobCard key={job.id} job={job} />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
