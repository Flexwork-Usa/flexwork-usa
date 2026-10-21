"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Inbox, Pause, Play } from "lucide-react";
import { motion } from "framer-motion";
import {
  heartbeatHourlySession,
  pauseHourlySession,
  startHourlySession,
} from "@/actions/workspace-actions";
import { Card, orangeButton, quietButton } from "@/components/dashboard/ui";
import { formatElapsed, IDLE_WARN_SECONDS } from "@/lib/platform/rules";
import type { ActiveProject } from "@/lib/platform/types";

export function EmptyQueueWorkspace({
  project,
  backHref,
}: {
  project: ActiveProject;
  backHref: string;
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [logId, setLogId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idleWarn, setIdleWarn] = useState(false);
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
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Project workspace</p>
          <h1 className="text-2xl font-semibold tracking-tight">{project.jobTitle}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {project.company || "flexwork-usa"} · {project.payType} · ${project.payRate}
            {project.payType === "hourly" ? "/hr" : " / quota"}
          </p>
        </div>
        <Link href={backHref} className={quietButton}>
          Back to Active Projects
        </Link>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-5 shadow-sm"
      >
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-[#C85A17]/10 p-3 text-[#C85A17]">
            <Inbox className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">No tasks in this project yet</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">
              You currently have no work items assigned. Check back soon or keep your timer ready for when tasks arrive.
            </p>
          </div>
        </div>
      </motion.div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-slate-600">Hourly timer</p>
              <p className="mt-1 font-mono text-3xl font-semibold text-[#C85A17]">{formatElapsed(elapsed)}</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
              {running ? (
                <>
                  <Play className="h-3.5 w-3.5" />
                  Running
                </>
              ) : (
                <>
                  <Pause className="h-3.5 w-3.5" />
                  Paused
                </>
              )}
            </span>
          </div>
          <p className="mt-3 text-sm text-slate-600">
            You can start or pause the timer while you wait. Time is saved automatically.
          </p>
          {idleWarn ? (
            <p className="mt-2 text-sm text-amber-800">Idle detected. Pause if you step away.</p>
          ) : null}
          {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {!running ? (
              <button
                type="button"
                className={orangeButton}
                disabled={busy || project.payType !== "hourly"}
                onClick={async () => {
                  setBusy(true);
                  setError(null);
                  const result = await startHourlySession({
                    applicationId: project.id,
                    jobId: project.jobId,
                  });
                  setBusy(false);
                  if (!result.success) {
                    setError(result.error);
                    return;
                  }
                  setLogId(result.logId ?? null);
                  setElapsed(result.elapsedSeconds ?? 0);
                  setRunning(true);
                  lastActive.current = Date.now();
                  router.refresh();
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
                  router.refresh();
                }}
              >
                <Pause className="h-4 w-4" />
                Pause
              </button>
            )}
          </div>
        </Card>

        <Card>
          <h3 className="font-semibold">Task preview</h3>
          <p className="mt-1 text-sm text-slate-600">New work will appear here when it is ready.</p>
          <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
            {project.datasetPreview?.trim()
              ? `${project.datasetPreview.trim()}\n\n—\nNo tasks are available in this project yet.`
              : "You currently have no tasks assigned.\nCheck back soon."}
          </pre>
        </Card>
      </div>
    </div>
  );
}
