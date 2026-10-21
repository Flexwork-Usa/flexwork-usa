import { redirect } from "next/navigation";
import { EmptyQueueWorkspace } from "@/components/dashboard/EmptyQueueWorkspace";
import { loadHiredProject } from "@/lib/workspace/load-project";

export async function ProjectLaunchPage({
  applicationId,
  variant,
}: {
  applicationId: string;
  variant: "worker" | "worker_admin";
}) {
  const home = variant === "worker_admin" ? "/worker-admin/dashboard" : "/dashboard";
  const result = await loadHiredProject(applicationId);

  if (!result.ok) {
    if (result.status === 401) redirect("/login");
    if (result.restricted) {
      redirect("/account-restricted");
    }
    redirect(`${home}?tab=active`);
  }

  if (variant === "worker" && result.isWorkerAdmin) {
    redirect(`/worker-admin/dashboard/projects/${applicationId}`);
  }
  if (variant === "worker_admin" && !result.isWorkerAdmin) {
    redirect(`/dashboard/projects/${applicationId}`);
  }

  return <EmptyQueueWorkspace project={result.project} backHref={`${home}?tab=active`} />;
}
