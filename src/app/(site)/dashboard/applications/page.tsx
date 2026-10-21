import { Suspense } from "react";
import { WorkerDashboardContent } from "@/app/(site)/dashboard/page";
import { DashboardSkeleton } from "@/components/dashboard/ShimmerCard";

export const metadata = { title: "Applied Projects · flexwork-usa" };

export default function ApplicationsPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <WorkerDashboardContent variant="worker" initialTab="applied" />
    </Suspense>
  );
}
