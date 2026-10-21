"use client";

import { useEffect, useMemo, useState } from "react";
import { submitJobApplication } from "@/actions/application-actions";
import { Dialog, fieldClass, orangeButton, quietButton } from "@/components/dashboard/ui";
import type { ApplicantProfile, MarketplaceJob } from "@/lib/jobs/types";
import { BID_BOOST_OPTIONS } from "@/lib/platform/rules";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

function slotsLabel(count: number) {
  return `${count} Worker${count === 1 ? "" : "s"} Needed`;
}

function minStakeLabel(count: number) {
  return `Min Stake: ${count} Token${count === 1 ? "" : "s"}`;
}

function applicantsLabel(count: number) {
  return `${count} Applicant${count === 1 ? "" : "s"}`;
}

export function JobMarketplaceCard({
  job,
  applied,
  pending,
  error,
  signedIn,
  applicant,
  onNeedSignIn,
  onApplied,
}: {
  job: MarketplaceJob;
  applied: boolean;
  pending: boolean;
  error?: string;
  signedIn: boolean;
  applicant?: ApplicantProfile | null;
  onNeedSignIn: () => void;
  onApplied: (jobId: string, tokenBalance?: number) => void;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [extraApplicants, setExtraApplicants] = useState(0);
  const applicantCount = job.applicationCount + extraApplicants;
  const minTokens = Math.max(1, job.minTokens || 5);

  useEffect(() => {
    setExtraApplicants(0);
  }, [job.applicationCount]);

  function openApply() {
    if (!signedIn) {
      onNeedSignIn();
      return;
    }
    setDetailsOpen(false);
    setApplyOpen(true);
  }

  return (
    <>
      <article className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="text-lg font-semibold tracking-tight text-slate-900">{job.title}</h3>
          {job.pay ? (
            <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-[#C85A17]">{job.pay}</span>
          ) : null}
        </div>
        {job.tags.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {job.tags.map((tag) => (
              <li key={tag} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700">
                {tag}
              </li>
            ))}
          </ul>
        ) : null}
        <ul className="mt-3 space-y-1 text-sm font-medium text-slate-700">
          <li>{slotsLabel(job.slotsNeeded)}</li>
          <li>{minStakeLabel(minTokens)}</li>
          <li>{applicantsLabel(applicantCount)}</li>
        </ul>
        <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{job.summary}</p>
        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button type="button" className={`${quietButton} w-full`} onClick={() => setDetailsOpen(true)}>
            More Info
          </button>
          {applied ? (
            <span className="inline-flex w-full items-center justify-center rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-500">
              Applied
            </span>
          ) : (
            <button type="button" className={`${orangeButton} w-full`} disabled={pending} onClick={openApply}>
              {pending ? "Applying…" : "Apply Now"}
            </button>
          )}
        </div>
      </article>

      {detailsOpen ? (
        <Dialog title={job.title} onClose={() => setDetailsOpen(false)} className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            {job.pay ? <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-[#C85A17]">{job.pay}</span> : null}
            <span className="text-sm text-slate-600">{slotsLabel(job.slotsNeeded)}</span>
          </div>
          <div className="mt-4 max-h-[50vh] space-y-3 overflow-y-auto text-sm leading-6 text-slate-700">
            <p className="text-sm font-medium text-slate-900">Full description / Requirements</p>
            <p className="whitespace-pre-wrap">{job.fullDescription || job.summary}</p>
            <p className="text-sm font-medium text-slate-700">{slotsLabel(job.slotsNeeded)}</p>
          </div>
          {applied ? (
            <span className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-500">
              Applied
            </span>
          ) : (
            <button type="button" className={`${orangeButton} mt-5 w-full`} disabled={pending} onClick={openApply}>
              {pending ? "Applying…" : "Apply Now"}
            </button>
          )}
        </Dialog>
      ) : null}

      {applyOpen ? (
        <JobApplyModal
          job={job}
          applicant={applicant}
          pending={pending}
          onClose={() => setApplyOpen(false)}
          onApplied={(balance) => {
            setApplyOpen(false);
            setExtraApplicants((current) => current + 1);
            onApplied(job.id, balance);
          }}
        />
      ) : null}
    </>
  );
}

function JobApplyModal({
  job,
  applicant,
  pending,
  onClose,
  onApplied,
}: {
  job: MarketplaceJob;
  applicant?: ApplicantProfile | null;
  pending: boolean;
  onClose: () => void;
  onApplied: (tokenBalance?: number) => void;
}) {
  const minTokens = Math.max(1, job.minTokens || 5);
  const [fullName, setFullName] = useState(applicant?.fullName ?? "");
  const [applicantEmail, setApplicantEmail] = useState(applicant?.email ?? "");
  const [country, setCountry] = useState(applicant?.country ?? "");
  const [coverLetter, setCoverLetter] = useState("");
  const [cvUrl, setCvUrl] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [boost, setBoost] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const total = minTokens + boost;
  const balance = applicant?.tokenBalance ?? 0;

  const boostOptions = useMemo(() => [...BID_BOOST_OPTIONS], []);

  useEffect(() => {
    if (applicant?.email && !applicantEmail) setApplicantEmail(applicant.email);
    if (applicant?.fullName && !fullName) setFullName(applicant.fullName);
    if (applicant?.country && !country) setCountry(applicant.country);
  }, [applicant?.email, applicant?.fullName, applicant?.country, applicantEmail, fullName, country]);

  useEffect(() => {
    if (applicantEmail) return;
    let cancelled = false;
    (async () => {
      try {
        const supabase = createBrowserSupabaseClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || cancelled) return;
        const { data: profile } = await supabase
          .from("profiles")
          .select("email, full_name, country")
          .eq("id", user.id)
          .maybeSingle();
        if (cancelled) return;
        const nextEmail = profile?.email || user.email || "";
        if (nextEmail) setApplicantEmail(nextEmail);
        if (profile?.full_name) setFullName((current) => current || profile.full_name || "");
        if (profile?.country) setCountry((current) => current || profile.country || "");
      } catch {
        // Keep the empty field editable if profile lookup fails.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applicantEmail]);

  return (
    <Dialog title="Apply for Project" onClose={onClose} className="max-w-xl">
      <form
        className="space-y-3"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError(null);
          const result = await submitJobApplication({
            jobId: job.id,
            fullName,
            email: applicantEmail,
            country,
            coverLetter,
            cvUrl,
            portfolioUrl,
            tokens: total,
          });
          setBusy(false);
          if (!result.success) {
            setError(result.error);
            return;
          }
          onApplied(result.tokenBalance);
        }}
      >
        <p className="text-sm text-slate-600">
          {job.title} · Minimum {minTokens} tokens. Your balance: {balance} tokens.
        </p>
        <label className="block text-sm font-medium">
          Name
          <input className={fieldClass} required value={fullName} onChange={(event) => setFullName(event.target.value)} />
        </label>
        <label className="block text-sm font-medium">
          Email
          <input
            className={fieldClass}
            type="email"
            required
            value={applicantEmail}
            onChange={(event) => setApplicantEmail(event.target.value)}
          />
        </label>
        <label className="block text-sm font-medium">
          Country
          <input className={fieldClass} required value={country} onChange={(event) => setCountry(event.target.value)} />
        </label>
        <label className="block text-sm font-medium">
          Cover Letter
          <textarea className={`${fieldClass} h-28 py-2`} required value={coverLetter} onChange={(event) => setCoverLetter(event.target.value)} />
        </label>
        <label className="block text-sm font-medium">
          CV Upload (file or URL, optional)
          <input className={fieldClass} value={cvUrl} placeholder="https://" onChange={(event) => setCvUrl(event.target.value)} />
          <input
            className="mt-2 block w-full text-sm text-slate-600"
            type="file"
            accept=".pdf,.doc,.docx,application/pdf"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              try {
                const supabase = createBrowserSupabaseClient();
                const path = `cv/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
                const { error: uploadError } = await supabase.storage.from("application-docs").upload(path, file);
                if (uploadError) {
                  setError("Could not upload the file. Paste a CV URL instead.");
                  return;
                }
                const { data } = supabase.storage.from("application-docs").getPublicUrl(path);
                setCvUrl(data.publicUrl);
                setError(null);
              } catch {
                setError("Could not upload the file. Paste a CV URL instead.");
              }
            }}
          />
        </label>
        <label className="block text-sm font-medium">
          Portfolio Link (optional)
          <input className={fieldClass} value={portfolioUrl} placeholder="https://" onChange={(event) => setPortfolioUrl(event.target.value)} />
        </label>
        <div>
          <p className="text-sm font-medium">Boost Application</p>
          <p className="mt-1 text-xs text-slate-500">Add tokens above the {minTokens}-token minimum to raise your rank.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {boostOptions.map((value) => (
              <button
                key={value}
                type="button"
                className={value === boost ? orangeButton : quietButton}
                onClick={() => setBoost(value)}
              >
                {value === 0 ? "No boost" : `+${value} tokens`}
              </button>
            ))}
          </div>
          <label className="mt-3 block text-sm font-medium">
            Additional tokens
            <input
              className={fieldClass}
              type="range"
              min={0}
              max={40}
              step={5}
              value={boost}
              onChange={(event) => setBoost(Number(event.target.value))}
            />
          </label>
          <p className="mt-2 text-sm font-medium text-slate-900">Total bid: {total} tokens</p>
        </div>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <button type="submit" className={`${orangeButton} w-full`} disabled={busy || pending}>
          {busy || pending ? "Submitting…" : `Submit application · ${total} tokens`}
        </button>
      </form>
    </Dialog>
  );
}
