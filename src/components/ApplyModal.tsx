"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Upload, X } from "lucide-react";
import { useApp } from "@/context/AppContext";
import {
  fieldClass,
  primaryButtonClass,
  secondaryButtonClass,
  WORKER,
} from "@/lib/format";
import type { Job } from "@/lib/types";

export function ApplyModal() {
  const { applyJob, closeApplyModal } = useApp();

  useEffect(() => {
    if (!applyJob) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") closeApplyModal();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [applyJob, closeApplyModal]);

  return (
    <AnimatePresence>
      {applyJob ? (
        <ApplyDialog key={applyJob.id} job={applyJob} onClose={closeApplyModal} />
      ) : null}
    </AnimatePresence>
  );
}

function ApplyDialog({ job, onClose }: { job: Job; onClose: () => void }) {
  const { role, setRole, submitApplication, applications } = useApp();
  const [name, setName] = useState(WORKER.name);
  const [email, setEmail] = useState(WORKER.email);
  const [resumeName, setResumeName] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const alreadyApplied = applications.some((item) => item.jobId === job.id);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || !email.includes("@")) {
      setError("Enter the name and email on the application.");
      return;
    }
    if (!resumeName) {
      setError("Attach a resume to continue.");
      return;
    }
    setError("");
    submitApplication({
      jobId: job.id,
      applicantName: name.trim(),
      applicantEmail: email.trim(),
      resumeName,
    });
    setSent(true);
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <button
        type="button"
        aria-label="Close application"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="apply-modal-title"
        tabIndex={-1}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.15 }}
        className="relative z-10 max-h-[min(90vh,44rem)] w-full max-w-lg overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-sm outline-none"
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4">
          <div>
            <h2 id="apply-modal-title" className="text-base font-semibold text-gray-900">
              Quick Apply
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              {job.title}
              <span className="px-1.5 text-gray-300">/</span>
              {job.company}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-500 hover:bg-gray-50 hover:text-gray-900"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {role !== "worker" ? (
          <div className="px-5 py-5">
            <p className="text-sm leading-6 text-gray-600">
              Curated applications are filed as {WORKER.name}. Switch to Worker View to continue
              with the prefilled profile.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                className={primaryButtonClass}
                onClick={() => setRole("worker")}
              >
                Continue as {WORKER.name}
              </button>
              <button type="button" className={secondaryButtonClass} onClick={onClose}>
                Cancel
              </button>
            </div>
          </div>
        ) : sent || alreadyApplied ? (
          <div className="px-5 py-8 text-center">
            <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 text-emerald-800">
              <Check className="h-5 w-5" aria-hidden="true" />
            </span>
            <p className="mt-4 text-base font-semibold text-gray-900">Application filed</p>
            <p className="mt-1 text-sm text-gray-600">{job.title} · Status: Applied</p>
            <button type="button" className={`${primaryButtonClass} mt-6`} onClick={onClose}>
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="px-5 py-5">
            <div className="grid gap-4">
              <label className="block text-sm font-medium text-gray-900" htmlFor="apply-name">
                Full name
                <input
                  id="apply-name"
                  className={fieldClass}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                />
              </label>
              <label className="block text-sm font-medium text-gray-900" htmlFor="apply-email">
                Email
                <input
                  id="apply-email"
                  type="email"
                  className={fieldClass}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                />
              </label>
              <p className="text-sm text-gray-600">
                Location <span className="font-medium text-gray-900">{WORKER.location}</span>
              </p>
            </div>

            <div className="mt-5">
              <p className="text-sm font-medium text-gray-900">Resume</p>
              <label className="mt-1.5 flex cursor-pointer flex-col items-center rounded-lg border border-dashed border-gray-300 px-4 py-6 text-center hover:border-gray-400">
                <Upload className="h-4 w-4 text-gray-500" aria-hidden="true" />
                <span className="mt-2 text-sm font-medium text-gray-900">
                  {resumeName || "Choose a file"}
                </span>
                <span className="mt-1 text-xs text-gray-500">
                  PDF or Word. The file stays on this device.
                </span>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) setResumeName(file.name);
                  }}
                />
              </label>
              <button
                type="button"
                className={`${secondaryButtonClass} mt-3`}
                onClick={() => setResumeName(WORKER.sampleResume)}
              >
                Use sample resume
              </button>
            </div>

            {error ? <p className="mt-4 text-sm text-gray-900">{error}</p> : null}

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button type="button" className={secondaryButtonClass} onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className={primaryButtonClass}>
                Submit application
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </motion.div>
  );
}
