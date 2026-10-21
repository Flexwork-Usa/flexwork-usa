"use client";

import { memo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { WorkerApplication } from "@/components/dashboard/types";
import { Card, activeLabel, badgeClass, orangeButton } from "@/components/dashboard/ui";
import type { ActiveProject } from "@/lib/platform/types";

function ActiveTab({
  projects,
  error,
  restricted = false,
  activeProjects = [],
}: {
  projects: WorkerApplication[];
  error?: string;
  restricted?: boolean;
  activeProjects?: ActiveProject[];
}) {
  const pathname = usePathname();
  const basePath = pathname.startsWith("/worker-admin")
    ? "/worker-admin/dashboard/projects"
    : "/dashboard/projects";

  if (restricted) {
    return (
      <Card className="mt-1 border-amber-200 bg-amber-50 text-sm text-amber-950">
        Active projects are locked while your account is restricted. You can still view your balance and earnings.
        Contact support to restore access.
      </Card>
    );
  }

  const rows =
    activeProjects.length > 0
      ? activeProjects.filter((project) => project.status === "hired")
      : projects
          .filter((project) => project.status.toLowerCase() === "hired")
          .map((project) => ({
            id: project.id,
            jobId: project.jobId || "",
            jobTitle: project.jobTitle,
            company: project.company,
            payType: "hourly" as const,
            payRate: 0,
            status: project.status,
            deadlineAt: null,
            datasetPreview: null,
          }));

  return (
    <div>
      <h2 className="text-lg font-semibold">Active Projects</h2>
      <p className="mt-1 text-sm text-slate-600">Projects you are hired for appear here. Open Launch Task to start work.</p>
      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
      {rows.length === 0 ? (
        <Card className="mt-4 text-sm text-slate-600">You currently have no active projects.</Card>
      ) : (
        <div className="mt-4 space-y-3">
          {rows.map((project) => {
            const label = activeLabel(project.status);
            return (
              <Card key={project.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{project.jobTitle}</h3>
                    <p className="mt-1 text-sm text-slate-600">{project.company || "flexwork-usa"}</p>
                    <p className="mt-1 text-sm text-slate-600 capitalize">
                      {project.payType} · ${project.payRate}
                      {project.payType === "hourly" ? "/hr" : " / quota"}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${badgeClass(label)}`}>{label}</span>
                </div>
                <p className="mt-3 text-sm text-slate-600">
                  {project.deadlineAt
                    ? `Deadline: ${new Date(project.deadlineAt).toLocaleString()}`
                    : "Deadline: flexible / not scheduled"}
                </p>
                <Link href={`${basePath}/${project.id}`} className={`${orangeButton} mt-4 inline-flex`}>
                  Launch Task
                </Link>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default memo(ActiveTab);
