"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ExternalLink, Search, X } from "lucide-react";
import { JobMarketplaceCard } from "@/components/jobs/JobMarketplaceCard";
import { PlatformGuideModal, PlatformMark, TrustpilotBadge } from "@/components/jobs/PlatformGuideModal";
import { CategoryNav } from "@/components/jobs/CategoryNav";
import { matchesTaxonomy, subcategoryIdsForPlatform, subcategoryIdsForText, type TaxonomySelection } from "@/lib/jobs/categories";
import { DIRECTORY, DIRECTORY_CATEGORIES, type ExternalPlatform } from "@/lib/jobs/directory";
import { platformLogos } from "@/lib/jobs/platform-logos";
import { pageFrame } from "@/lib/frame";
import { goTo } from "@/lib/auth/session";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import type { ApplicantProfile, MarketplaceJob } from "@/lib/jobs/types";

const GATE_MESSAGE = "Log in or apply to join flexwork-usa to access platform-executed projects.";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "ai", label: "AI Training" },
  { id: "freelance", label: "Freelance" },
  { id: "surveys", label: "Surveys & Testing" },
  { id: "platform", label: "Platform-Executed" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"] | "external";

const SKILL_WORDS = [
  "annotation",
  "audio",
  "calendar",
  "catalog",
  "data entry",
  "evaluation",
  "labeling",
  "quality",
  "research",
  "speech",
  "survey",
  "writing",
];

const orangeButton =
  "inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#C85A17] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#A84810] disabled:cursor-not-allowed disabled:opacity-60";

const quietButton =
  "inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50";

function skillsFrom(summary: string) {
  const text = summary.toLowerCase();
  return SKILL_WORDS.filter((skill) => text.includes(skill));
}

function filterFromParams(params: { get: (key: string) => string | null }): FilterId {
  const tier = params.get("tier");
  const category = params.get("category");
  if (tier === "platform") return "platform";
  if (tier === "external") {
    if (category === "ai" || category === "freelance" || category === "surveys") return category;
    return "external";
  }
  return "all";
}

export function JobsPageSkeleton() {
  return (
    <div className={`${pageFrame} py-10`}>
      <div className="h-8 w-72 animate-pulse rounded-md bg-slate-200" />
      <div className="mt-3 h-4 w-full max-w-xl animate-pulse rounded-md bg-slate-200" />
      <div className="mt-6 h-11 animate-pulse rounded-lg bg-slate-200" />
      <div className="mt-4 h-11 animate-pulse rounded-lg bg-slate-200" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-white" />
        ))}
      </div>
    </div>
  );
}

export function JobsBoard({
  jobs,
  appliedJobIds,
  signedIn: signedInInitially,
  tokenBalance: tokenBalanceInitially,
  applicant,
  loadError,
}: {
  jobs: MarketplaceJob[];
  appliedJobIds: string[];
  signedIn: boolean;
  tokenBalance: number;
  applicant?: ApplicantProfile | null;
  loadError?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filter = filterFromParams(searchParams);
  const [query, setQuery] = useState("");
  const [applied, setApplied] = useState(() => new Set(appliedJobIds));
  const [signedIn, setSignedIn] = useState(signedInInitially);
  const [tokenBalance, setTokenBalance] = useState(tokenBalanceInitially);
  const [gateJob, setGateJob] = useState<MarketplaceJob | null>(null);
  const [guide, setGuide] = useState<{ platform: ExternalPlatform; site: boolean } | null>(null);
  const [taxonomy, setTaxonomy] = useState<TaxonomySelection>({ categoryId: null, subcategoryId: null });

  const needle = query.trim().toLowerCase();

  const platformJobs = useMemo(() => {
    return jobs.filter((job) => {
      if (job.tier === 3) return false;
      const subcategoryIds = job.subcategoryId
        ? [job.subcategoryId]
        : subcategoryIdsForText(`${job.title} ${job.summary} ${job.category}`);
      if (!matchesTaxonomy(subcategoryIds, taxonomy)) return false;
      if (!needle) return true;
      const haystack = [job.title, job.company, job.summary, job.pay, "platform-executed", skillsFrom(job.summary).join(" ")]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [jobs, needle, taxonomy]);

  const directory = useMemo(() => {
    return DIRECTORY.filter((platform) => {
      if (filter === "ai" || filter === "freelance" || filter === "surveys") {
        if (platform.category !== filter) return false;
      }
      const subcategoryIds = subcategoryIdsForPlatform(
        platform.id,
        `${platform.name} ${platform.categoryLabel} ${platform.skills.join(" ")}`,
      );
      if (!matchesTaxonomy(subcategoryIds, taxonomy)) return false;
      if (!needle) return true;
      const haystack = [platform.name, platform.categoryLabel, platform.location, platform.pay, platform.skills.join(" ")]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [filter, needle, taxonomy]);

  const showPlatform = filter === "all" || filter === "platform";
  const showDirectory = filter !== "platform";
  const visiblePlatform = showPlatform ? platformJobs : [];
  const visibleDirectory = showDirectory ? directory : [];
  const isEmpty = visiblePlatform.length === 0 && visibleDirectory.length === 0;

  function selectFilter(next: (typeof FILTERS)[number]["id"]) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("tier");
    params.delete("category");
    if (next === "platform") params.set("tier", "platform");
    if (next === "ai" || next === "freelance" || next === "surveys") {
      params.set("tier", "external");
      params.set("category", next);
    }
    const queryString = params.toString();
    router.replace(queryString ? `/jobs?${queryString}` : "/jobs", { scroll: false });
  }

  const profile: ApplicantProfile | null = applicant
    ? { ...applicant, tokenBalance }
    : signedIn
      ? { fullName: "", email: "", country: "", tokenBalance }
      : null;

  return (
    <div className="bg-slate-50/50 text-slate-900">
      <main className={`${pageFrame} py-10`}>
        <h1 className="text-3xl font-semibold tracking-tight">Explore Remote Opportunities</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Browse platform-executed projects on flexwork-usa, and a directory of verified external remote-work platforms.
        </p>

        <label className="mt-6 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 shadow-sm focus-within:ring-2 focus-within:ring-[#C85A17]">
          <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by platform, skill, or category"
            className="h-11 w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
          />
        </label>

        <div role="tablist" aria-label="Opportunity categories" className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map((item) => {
            const selected = filter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={selected}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  selected
                    ? "border-[#C85A17] bg-[#C85A17] text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}
                onClick={() => selectFilter(item.id)}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <CategoryNav selection={taxonomy} onChange={setTaxonomy} />

        {loadError ? (
          <p className="mt-6 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900" role="alert">
            {loadError}
          </p>
        ) : null}

        {isEmpty ? (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center">
            <p className="text-base font-medium text-slate-900">No opportunities match this view</p>
            <p className="mt-2 text-sm text-slate-600">Try another platform, skill, or category.</p>
          </div>
        ) : (
          <div className="mt-8 space-y-10">
            {visiblePlatform.length > 0 ? (
              <section aria-labelledby="platform-heading">
                <h2 id="platform-heading" className="text-lg font-semibold tracking-tight text-slate-900">
                  Tier 1: Platform-Executed Projects
                </h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                  Sourced and managed on flexwork-usa. Token-gated client work asks you to sign in. Curated roles stay on this platform.
                </p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {visiblePlatform.map((job) => (
                    <JobMarketplaceCard
                      key={job.id}
                      job={job}
                      applied={applied.has(job.id)}
                      pending={false}
                      signedIn={signedIn}
                      applicant={profile}
                      onNeedSignIn={() => setGateJob(job)}
                      onApplied={(jobId, balance) => {
                        setApplied((current) => new Set(current).add(jobId));
                        if (typeof balance === "number") setTokenBalance(balance);
                      }}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            {visibleDirectory.length > 0 ? (
              <section aria-labelledby="directory-heading">
                <h2 id="directory-heading" className="text-lg font-semibold tracking-tight text-slate-900">
                  Tier 2: External Opportunities Directory
                </h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                  Verified remote-work platforms. No login is required to browse or open a guide.
                </p>
                <div className="mt-6 space-y-8">
                  {DIRECTORY_CATEGORIES.map((category) => {
                    const list = visibleDirectory.filter((platform) => platform.category === category.id);
                    if (list.length === 0) return null;
                    return (
                      <div key={category.id}>
                        <h3 className="text-sm font-semibold text-slate-900">{category.heading}</h3>
                        <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                          {list.map((platform) => (
                            <DirectoryCard
                              key={platform.id}
                              platform={platform}
                              onGuide={() => setGuide({ platform, site: false })}
                              onView={() => setGuide({ platform, site: true })}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}
          </div>
        )}
      </main>

      {gateJob ? (
        <PlatformSignIn
          onClose={() => setGateJob(null)}
          onSignedIn={async (balance) => {
            setSignedIn(true);
            setTokenBalance(balance);
            setGateJob(null);
            router.refresh();
          }}
        />
      ) : null}

      {guide ? (
        <PlatformGuideModal platform={guide.platform} startOnSite={guide.site} onClose={() => setGuide(null)} />
      ) : null}
    </div>
  );
}

function DirectoryCard({
  platform,
  onGuide,
  onView,
}: {
  platform: ExternalPlatform;
  onGuide: () => void;
  onView: () => void;
}) {
  const theme = platform.embeds ? platform.theme : undefined;
  return (
    <article
      className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
      style={theme ? { borderColor: theme.accent, backgroundColor: theme.wash } : undefined}
    >
      {theme ? <div className="h-1.5" style={{ background: theme.stripe }} /> : null}
      <div className="flex h-full flex-col p-5">
        <div className="flex items-start gap-3">
          <PlatformMark logo={platformLogos[platform.id]} initials={platform.initials} color={platform.color} />
          <div className="min-w-0">
            <h3 className="text-lg font-semibold tracking-tight text-slate-900">{platform.name}</h3>
            <p
              className={`mt-1 w-fit rounded-full px-2.5 py-1 text-xs font-medium ${theme ? "" : "bg-slate-100 text-slate-700"}`}
              style={theme ? { backgroundColor: theme.accent, color: theme.ink } : undefined}
            >
              {platform.categoryLabel}
            </p>
          </div>
        </div>
        <dl className="mt-4 space-y-1.5 text-sm text-slate-700">
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Location</dt>
            <dd className="text-right">{platform.location}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Pay</dt>
            <dd className="text-right">{platform.pay}</dd>
          </div>
        </dl>
        <div className="mt-3">
          <TrustpilotBadge platform={platform} />
        </div>
        <div className="mt-auto flex flex-col gap-2 pt-5">
          {platform.embeds ? (
            <button
              type="button"
              className={`${orangeButton} border-0 hover:brightness-95`}
              style={theme ? { backgroundColor: theme.accent, color: theme.ink } : undefined}
              onClick={onView}
            >
              View Platform
            </button>
          ) : (
            <a href={platform.url} target="_blank" rel="noreferrer" className={orangeButton}>
              Visit Platform
              <ExternalLink className="h-4 w-4" aria-hidden />
            </a>
          )}
          <button type="button" className={quietButton} onClick={onGuide}>
            Platform guide
          </button>
        </div>
      </div>
    </article>
  );
}

function PlatformSignIn({
  onClose,
  onSignedIn,
}: {
  onClose: () => void;
  onSignedIn: (balance: number) => void | Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="platform-gate-title"
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-md"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="platform-gate-title" className="text-lg font-semibold tracking-tight text-slate-900">
            Sign in to apply
          </h2>
          <button
            type="button"
            className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-600">{GATE_MESSAGE}</p>
        <form
          className="mt-5 space-y-3"
          onSubmit={async (event) => {
            event.preventDefault();
            setSubmitting(true);
            setError(null);
            try {
              const supabase = createBrowserSupabaseClient();
              const { data, error: signInError } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password,
              });
              if (signInError || !data.user) {
                setError(signInError?.message ?? "Could not sign in.");
                return;
              }
              const { data: profile, error: profileError } = await supabase
                .from("profiles")
                .select("token_balance, is_approved")
                .eq("id", data.user.id)
                .maybeSingle<{ token_balance: number | null; is_approved: boolean | null }>();
              if (profileError) {
                setError(profileError.message);
                return;
              }
              if (!profile?.is_approved) {
                goTo("/onboarding-pending");
                return;
              }
              await onSignedIn(profile.token_balance ?? 0);
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : "Could not sign in.");
            } finally {
              setSubmitting(false);
            }
          }}
        >
          <label className="block text-sm font-medium text-slate-900">
            Email
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-[#C85A17]"
            />
          </label>
          <label className="block text-sm font-medium text-slate-900">
            Password
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-[#C85A17]"
            />
          </label>
          {error ? (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <button type="submit" className={orangeButton} disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <a href="/onboard" className={`${quietButton} mt-3`}>
          Apply to join
        </a>
      </div>
    </div>
  );
}
