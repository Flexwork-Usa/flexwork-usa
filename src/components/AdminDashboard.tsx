"use client";

import { useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { useApp } from "@/context/AppContext";
import { fieldClass, formatWhen, primaryButtonClass, TIER_META } from "@/lib/format";
import type { ApplicationStatus, JobTier, NewJobInput, PlatformId } from "@/lib/types";

const EMPTY: NewJobInput = {
  title: "",
  company: "",
  tier: 1,
  tokenCost: 10,
  pay: "",
  summary: "",
  platform: "outlier",
  platformUrl: "https://outlier.ai/",
};

const PLATFORM_DEFAULTS: Record<PlatformId, { platformUrl: string }> = {
  outlier: { platformUrl: "https://outlier.ai/" },
  handshake: { platformUrl: "https://ai.joinhandshake.com/get-started" },
};

export function AdminDashboard() {
  const { jobs, applications, addJob, setApplicationStatus } = useApp();
  const [form, setForm] = useState<NewJobInput>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof NewJobInput, string>>>({});

  function update<K extends keyof NewJobInput>(key: K, value: NewJobInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <section>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Admin</h1>
          <p className="mt-2 text-sm text-gray-600">
            Post a role and review applications from this session.
          </p>
        </div>
        <p className="text-sm text-gray-500 tabular-nums">
          {jobs.length} jobs · {applications.length} applications
        </p>
      </div>

      <form
        className="mt-6 rounded-xl border border-gray-200 p-5"
        onSubmit={(event) => {
          event.preventDefault();
          const nextErrors: Partial<Record<keyof NewJobInput, string>> = {};
          if (!form.title.trim()) nextErrors.title = "Enter a title.";
          if (!form.company.trim()) nextErrors.company = "Enter a company.";
          if (!form.pay.trim()) nextErrors.pay = "Enter a pay rate.";
          if (form.tier === 2 && (!Number.isFinite(form.tokenCost) || form.tokenCost < 1)) {
            nextErrors.tokenCost = "Enter a token cost of at least 1.";
          }
          if (form.tier === 3 && !form.platformUrl?.trim()) {
            nextErrors.platformUrl = "Enter the platform URL.";
          }
          setErrors(nextErrors);
          if (Object.keys(nextErrors).length > 0) return;

          addJob({
            ...form,
            title: form.title.trim(),
            company: form.company.trim(),
            pay: form.pay.trim(),
            summary: form.summary.trim(),
            tokenCost: form.tier === 2 ? form.tokenCost : 0,
            platform: form.tier === 3 ? form.platform : undefined,
            platformUrl: form.tier === 3 ? form.platformUrl?.trim() : undefined,
          });
          setForm(EMPTY);
        }}
      >
        <h2 className="text-sm font-semibold text-gray-900">Add New Job</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-gray-900" htmlFor="job-title">
            Title
            <input
              id="job-title"
              className={fieldClass}
              value={form.title}
              onChange={(event) => update("title", event.target.value)}
              placeholder="Remote Research Assistant"
            />
            {errors.title ? <span className="mt-1 block text-sm text-red-700">{errors.title}</span> : null}
          </label>
          <label className="block text-sm font-medium text-gray-900" htmlFor="job-company">
            Company
            <input
              id="job-company"
              className={fieldClass}
              value={form.company}
              onChange={(event) => update("company", event.target.value)}
              placeholder="Northline Operations"
            />
            {errors.company ? (
              <span className="mt-1 block text-sm text-red-700">{errors.company}</span>
            ) : null}
          </label>
          <label className="block text-sm font-medium text-gray-900" htmlFor="job-tier">
            Tier
            <select
              id="job-tier"
              className={fieldClass}
              value={form.tier}
              onChange={(event) => update("tier", Number(event.target.value) as JobTier)}
            >
              <option value={1}>Tier 1: Curated</option>
              <option value={2}>Tier 2: Affiliate</option>
              <option value={3}>Tier 3: Third-Party AI</option>
            </select>
          </label>
          <label className="block text-sm font-medium text-gray-900" htmlFor="job-pay">
            Pay rate
            <input
              id="job-pay"
              className={fieldClass}
              value={form.pay}
              onChange={(event) => update("pay", event.target.value)}
              placeholder="$25/hr"
            />
            {errors.pay ? <span className="mt-1 block text-sm text-red-700">{errors.pay}</span> : null}
          </label>
          <label className="block text-sm font-medium text-gray-900 sm:col-span-2" htmlFor="job-tokens">
            Token cost
            <input
              id="job-tokens"
              className={fieldClass}
              type="number"
              min={1}
              value={form.tokenCost}
              disabled={form.tier !== 2}
              onChange={(event) => update("tokenCost", Number(event.target.value))}
            />
            <span className="mt-1 block text-xs font-normal text-gray-500">
              Used when the tier is Affiliate.
            </span>
            {errors.tokenCost ? (
              <span className="mt-1 block text-sm text-red-700">{errors.tokenCost}</span>
            ) : null}
          </label>
          <label className="block text-sm font-medium text-gray-900 sm:col-span-2" htmlFor="job-summary">
            Description
            <textarea
              id="job-summary"
              className={`${fieldClass} min-h-24`}
              value={form.summary}
              onChange={(event) => update("summary", event.target.value)}
              placeholder="What the contractor will do."
            />
          </label>
          {form.tier === 3 ? (
            <>
              <label className="block text-sm font-medium text-gray-900" htmlFor="job-platform">
                Platform
                <select
                  id="job-platform"
                  className={fieldClass}
                  value={form.platform}
                  onChange={(event) => {
                    const platform = event.target.value as PlatformId;
                    setForm((current) => ({
                      ...current,
                      platform,
                      platformUrl: PLATFORM_DEFAULTS[platform].platformUrl,
                    }));
                  }}
                >
                  <option value="outlier">Outlier AI</option>
                  <option value="handshake">Handshake</option>
                </select>
              </label>
              <label className="block text-sm font-medium text-gray-900" htmlFor="job-url">
                Platform URL
                <input
                  id="job-url"
                  className={fieldClass}
                  value={form.platformUrl}
                  onChange={(event) => update("platformUrl", event.target.value)}
                  placeholder="https://outlier.ai"
                />
                {errors.platformUrl ? (
                  <span className="mt-1 block text-sm text-red-700">{errors.platformUrl}</span>
                ) : null}
              </label>
            </>
          ) : null}
        </div>
        <button type="submit" className={`${primaryButtonClass} mt-5`}>
          Post job
        </button>
      </form>

      <div className="mt-10">
        <h2 className="text-base font-semibold tracking-tight text-gray-900">Incoming applications</h2>
        <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-gray-200 text-xs font-medium text-gray-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Applicant</th>
                <th className="px-4 py-2.5 font-medium">Role</th>
                <th className="px-4 py-2.5 font-medium">Tier</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Tokens</th>
                <th className="px-4 py-2.5 font-medium">Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {applications.map((application) => (
                <tr key={application.id}>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {application.applicantName}
                    <span className="mt-0.5 block text-xs font-normal text-gray-500">
                      {application.applicantEmail}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-900">
                    {application.jobTitle}
                    <span className="mt-0.5 block text-xs text-gray-500">{application.company}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {TIER_META[application.tier].label}: {TIER_META[application.tier].name}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-start gap-2">
                      <StatusBadge status={application.status} />
                      <select
                        aria-label={`Status for ${application.applicantName}`}
                        className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-900"
                        value={application.status}
                        onChange={(event) =>
                          setApplicationStatus(
                            application.id,
                            event.target.value as ApplicationStatus,
                          )
                        }
                      >
                        <option value="Applied">Applied</option>
                        <option value="Under Review">Under Review</option>
                      </select>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-900 tabular-nums">{application.tokensSpent}</td>
                  <td className="px-4 py-3 text-gray-600">{formatWhen(application.appliedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
