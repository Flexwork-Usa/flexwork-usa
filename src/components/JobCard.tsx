"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, ExternalLink } from "lucide-react";
import { ThirdPartyGuide } from "@/components/ThirdPartyGuide";
import { useApp } from "@/context/AppContext";
import { cx, primaryButtonClass, secondaryButtonClass, TIER_META } from "@/lib/format";
import type { ApplicationStatus, Job } from "@/lib/types";

function SuccessBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800">
      <Check className="h-3.5 w-3.5" aria-hidden="true" />
      Applied Successfully!
    </span>
  );
}

function ReviewBadge() {
  return (
    <span className="inline-flex items-center rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-800">
      Under Review
    </span>
  );
}

function StatusMark({ status }: { status: ApplicationStatus }) {
  if (status === "Applied") return <SuccessBadge />;
  return <ReviewBadge />;
}

function Meta({ job }: { job: Job }) {
  return (
    <p className="mt-3 text-xs text-gray-500">
      {job.location}
      <span className="px-1.5 text-gray-300">/</span>
      {job.schedule}
      <span className="px-1.5 text-gray-300">/</span>
      {job.category}
    </p>
  );
}

export function JobCard({ job }: { job: Job }) {
  if (job.tier === 3) return <PartnerCard job={job} />;
  return <ListingCard job={job} />;
}

function ListingCard({ job }: { job: Job }) {
  const { applications, tokens, role, openApplyModal, applyWithTokens, openTokenModal } =
    useApp();
  const application = applications.find(
    (item) => item.jobId === job.id && item.owner === "worker",
  );
  const tier = TIER_META[job.tier];
  const shortOnTokens = role === "worker" && job.tier === 2 && tokens < job.tokenCost;

  return (
    <article className="flex h-full flex-col rounded-xl border border-gray-200 bg-white">
      <div className="flex items-start justify-between gap-4 px-5 pt-5">
        <div>
          <p className="text-xs font-medium tracking-wide text-gray-500 uppercase">
            {tier.label}: {tier.name}
            {job.origin === "admin" ? " · New" : ""}
          </p>
          <h3 className="mt-2 text-base font-semibold tracking-tight text-gray-900">
            {job.title}
          </h3>
          <p className="mt-1 text-sm text-gray-600">{job.company}</p>
        </div>
        <span className="shrink-0 rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-800">
          {job.pay}
        </span>
      </div>
      <p className="px-5 pt-4 text-sm leading-6 text-gray-600">{job.summary}</p>
      <Meta job={job} />
      <div className="mt-auto flex flex-col gap-3 border-t border-gray-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-900">
          {job.tier === 1
            ? "Free to apply"
            : `Requires ${job.tokenCost} Tokens to Apply`}
          {shortOnTokens && !application ? (
            <span className="mt-0.5 block text-xs text-gray-500">
              You have {tokens} tokens
            </span>
          ) : null}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {application ? <StatusMark status={application.status} /> : null}
          {job.tier === 1 ? (
            <button
              type="button"
              className={primaryButtonClass}
              disabled={Boolean(application)}
              onClick={() => openApplyModal(job.id)}
            >
              {application ? "Applied" : "Quick Apply"}
            </button>
          ) : (
            <>
              {shortOnTokens && !application ? (
                <button type="button" className={secondaryButtonClass} onClick={openTokenModal}>
                  Buy Tokens
                </button>
              ) : null}
              <button
                type="button"
                className={primaryButtonClass}
                disabled={Boolean(application)}
                onClick={() => applyWithTokens(job.id)}
              >
                {application ? "Applied" : `Apply with ${job.tokenCost} Tokens`}
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

function PartnerCard({ job }: { job: Job }) {
  const { applications, role, trackPartnerApplication, notify } = useApp();
  const [open, setOpen] = useState(false);
  const application = applications.find(
    (item) => item.jobId === job.id && item.owner === "worker",
  );
  const tier = TIER_META[3];

  return (
    <article className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="grid gap-6 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div>
          <p className="text-xs font-medium tracking-wide text-gray-500 uppercase">
            {tier.label}: {tier.name}
            {job.origin === "admin" ? " · New" : ""}
          </p>
          <h3 className="mt-2 text-lg font-semibold tracking-tight text-gray-900">
            {job.company}
          </h3>
          <p className="mt-1 text-sm font-medium text-gray-900">{job.title}</p>
          <p className="mt-1 text-sm text-gray-600">
            {job.category}
            <span className="px-1.5 text-gray-300">/</span>
            {job.pay}
          </p>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-gray-600">{job.summary}</p>
          <Meta job={job} />
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:flex-row lg:w-64 lg:flex-col">
          {job.platformUrl ? (
            <a
              href={job.platformUrl}
              target="_blank"
              rel="noreferrer"
              className={primaryButtonClass}
            >
              Open Platform & Apply
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
          ) : (
            <button type="button" className={primaryButtonClass} disabled>
              Open Platform & Apply
            </button>
          )}
          <button
            type="button"
            className={secondaryButtonClass}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? "Hide Preparation & KYC Guide" : "View Preparation & KYC Guide"}
            <ChevronDown
              className={cx("h-4 w-4 transition-transform", open && "rotate-180")}
              aria-hidden="true"
            />
          </button>
          {application ? (
            <div className="flex justify-start">
              <StatusMark status={application.status} />
            </div>
          ) : (
            <button
              type="button"
              className={cx(secondaryButtonClass, "text-gray-600")}
              onClick={() => {
                if (role !== "worker") {
                  notify("Switch to Worker View to track this application.");
                  return;
                }
                trackPartnerApplication(job.id);
              }}
            >
              Track in My Applications
            </button>
          )}
        </div>
      </div>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="guide"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <ThirdPartyGuide platform={job.platform} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </article>
  );
}
