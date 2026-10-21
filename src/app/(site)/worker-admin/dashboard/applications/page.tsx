import { Suspense } from "react";
import { WorkerDashboardContent } from "@/app/(site)/dashboard/page";
import { DashboardSkeleton } from "@/components/dashboard/ShimmerCard";

export const metadata = { title: "Applied Projects · flexwork-usa" };

export default function WorkerAdminApplicationsPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <WorkerDashboardContent variant="worker_admin" initialTab="applied" />
    </Suspense>
  );
}
