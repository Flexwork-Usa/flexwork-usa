"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, TriangleAlert } from "lucide-react";
import { motion } from "framer-motion";
import {
  heartbeatHourlySession,
  pauseHourlySession,
  startHourlySession,
  submitQuotaDeliverable,
} from "@/actions/workspace-actions";
import { Card, Dialog, fieldClass, orangeButton, quietButton } from "@/components/dashboard/ui";
import { formatElapsed, IDLE_WARN_SECONDS } from "@/lib/platform/rules";
import type { ActiveProject } from "@/lib/platform/types";

export function ProjectWorkspace({
  project,
  onClose,
  onChanged,
}: {
  project: ActiveProject;
  onClose: () => void;
  onChanged: () => void;
}) {
  if (project.payType === "quota") {
    return <QuotaWorkspace project={project} onClose={onClose} onChanged={onChanged} />;
  }
  return <HourlyWorkspace project={project} onClose={onClose} onChanged={onChanged} />;
}

function HourlyWorkspace({
  project,
  onClose,
  onChanged,
}: {
  project: ActiveProject;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [logId, setLogId] = useState<string | null>(null);
  const [idleWarn, setIdleWarn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lastActive = useRef(Date.now());

  useEffect(() => {
    const mark = () => {
      lastActive.current = Date.now();
      setIdleWarn(false);
    };
    window.addEventListener("mousemove", mark);
    window.addEventListener("keydown", mark);
    return () => {
      window.removeEventListener("mousemove", mark);
      window.removeEventListener("keydown", mark);
    };
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setElapsed((current) => current + 1);
      if (Date.now() - lastActive.current >= IDLE_WARN_SECONDS * 1000) {
        setIdleWarn(true);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (!running || !logId || elapsed === 0 || elapsed % 30 !== 0) return;
    void heartbeatHourlySession({ logId, elapsedSeconds: elapsed });
  }, [elapsed, logId, running]);

  return (
    <Dialog title={`Launch · ${project.jobTitle}`} onClose={onClose}>
      <div className="space-y-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-orange-200 bg-orange-50 p-4">
          <p className="text-sm text-slate-600">Hourly timer</p>
          <p className="mt-1 font-mono text-3xl font-semibold text-[#C85A17]">{formatElapsed(elapsed)}</p>
          <p className="mt-2 text-sm text-slate-600">${project.payRate}/hr · Start/Pause tracks elapsed seconds.</p>
        </motion.div>

        {idleWarn ? (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            Idle detected. Pause if you step away — prolonged idle time may reduce prorated compensation after deadline.
          </div>
        ) : null}

        <Card className="!shadow-none">
          <h3 className="font-semibold">Dataset viewer</h3>
          <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
            {project.datasetPreview ||
              "Sample task brief:\n1. Open the assigned dataset rows.\n2. Label each record carefully.\n3. Pause the timer during breaks.\n4. Submit when the hourly block is complete."}
          </pre>
        </Card>

        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <div className="flex flex-wrap gap-2">
          {!running ? (
            <button
              type="button"
              className={orangeButton}
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError(null);
                const result = await startHourlySession({ applicationId: project.id, jobId: project.jobId });
                setBusy(false);
                if (!result.success) {
                  setError(result.error);
                  return;
                }
                setLogId(result.logId ?? null);
                setElapsed(result.elapsedSeconds ?? 0);
                setRunning(true);
                lastActive.current = Date.now();
                onChanged();
              }}
            >
              <Play className="h-4 w-4" />
              Start
            </button>
          ) : (
            <button
              type="button"
              className={quietButton}
              disabled={busy || !logId}
              onClick={async () => {
                if (!logId) return;
                setBusy(true);
                setError(null);
                const result = await pauseHourlySession({
                  logId,
                  elapsedSeconds: elapsed,
                  idleWarning: idleWarn,
                });
                setBusy(false);
                if (!result.success) {
                  setError(result.error);
                  return;
                }
                setRunning(false);
                setElapsed(result.elapsedSeconds ?? elapsed);
                onChanged();
              }}
            >
              <Pause className="h-4 w-4" />
              Pause
            </button>
          )}
          <button type="button" className={quietButton} onClick={onClose}>
            Close workspace
          </button>
        </div>
      </div>
    </Dialog>
  );
}

function QuotaWorkspace({
  project,
  onClose,
  onChanged,
}: {
  project: ActiveProject;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [deliverable, setDeliverable] = useState("");
  const [deadlineDays, setDeadlineDays] = useState("7");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const days = Math.min(30, Math.max(1, Math.floor(Number(deadlineDays) || 7)));

  return (
    <Dialog title={`Launch · ${project.jobTitle}`} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError(null);
          setNotice(null);
          const deadlineAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
          const result = await submitQuotaDeliverable({
            applicationId: project.id,
            jobId: project.jobId,
            deliverableText: deliverable,
            deadlineAt,
          });
          setBusy(false);
          if (!result.success) {
            setError(result.error);
            return;
          }
          setNotice("Deliverable submitted for review.");
          setDeliverable("");
          onChanged();
        }}
      >
        <p className="text-sm text-slate-600">
          Quota mode · ${project.payRate} / quota. Choose a deadline between 1 day and 1 month.
        </p>
        <label className="block text-sm font-medium">
          Deadline (days)
          <input className={fieldClass} inputMode="numeric" value={deadlineDays} onChange={(e) => setDeadlineDays(e.target.value)} />
        </label>
        <p className="text-xs text-slate-500">Due in {days} day{days === 1 ? "" : "s"}.</p>
        <label className="block text-sm font-medium">
          Deliverable
          <textarea className={`${fieldClass} h-32 py-2`} required value={deliverable} onChange={(e) => setDeliverable(e.target.value)} placeholder="Paste links, notes, or completion summary" />
        </label>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        {notice ? <p className="text-sm text-emerald-800">{notice}</p> : null}
        <button type="submit" className={orangeButton} disabled={busy}>
          {busy ? "Submitting…" : "Submit deliverable"}
        </button>
      </form>
    </Dialog>
  );
}
