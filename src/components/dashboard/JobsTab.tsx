"use client";

import { memo, useMemo, useState } from "react";
import { CategoryNav } from "@/components/jobs/CategoryNav";
import { JobMarketplaceCard } from "@/components/jobs/JobMarketplaceCard";
import { Card } from "@/components/dashboard/ui";
import { matchesTaxonomy, subcategoryIdsForText, type TaxonomySelection } from "@/lib/jobs/categories";
import type { ApplicantProfile, MarketplaceJob } from "@/lib/jobs/types";

function JobsTab({
  jobs,
  error,
  appliedIds,
  pendingJob,
  applyError,
  applicant,
  onNeedSignIn,
  onApplied,
}: {
  jobs: MarketplaceJob[];
  error?: string;
  appliedIds: Set<string>;
  pendingJob: string | null;
  applyError: Record<string, string>;
  applicant?: ApplicantProfile | null;
  onNeedSignIn: () => void;
  onApplied: (jobId: string, tokenBalance?: number) => void;
}) {
  const [taxonomy, setTaxonomy] = useState<TaxonomySelection>({ categoryId: null, subcategoryId: null });
  const visible = useMemo(
    () =>
      jobs.filter((job) =>
        matchesTaxonomy(
          job.subcategoryId ? [job.subcategoryId] : subcategoryIdsForText(`${job.title} ${job.summary} ${job.category}`),
          taxonomy,
        ),
      ),
    [jobs, taxonomy],
  );

  return (
    <div>
      <h2 className="text-lg font-semibold">Discover Featured Tasks</h2>
      <p className="mt-1 text-sm text-slate-600">Open a job for full requirements, then apply with a token bid.</p>
      <CategoryNav selection={taxonomy} onChange={setTaxonomy} />
      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
      {visible.length === 0 ? (
        <Card className="mt-4 text-sm text-slate-600">
          {jobs.length === 0 ? "No platform projects are open right now." : "No platform projects in this category."}
        </Card>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {visible.map((job) => (
            <JobMarketplaceCard
              key={job.id}
              job={job}
              applied={appliedIds.has(job.id)}
              pending={pendingJob === job.id}
              error={applyError[job.id]}
              signedIn
              applicant={applicant}
              onNeedSignIn={onNeedSignIn}
              onApplied={onApplied}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default memo(JobsTab);
