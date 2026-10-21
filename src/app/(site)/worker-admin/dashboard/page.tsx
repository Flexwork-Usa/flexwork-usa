import { Suspense } from "react";
import { WorkerDashboardContent } from "@/app/(site)/dashboard/page";
import { DashboardSkeleton } from "@/components/dashboard/ShimmerCard";

export const metadata = {
  title: "Worker Admin · flexwork-usa",
};

export default function WorkerAdminDashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <WorkerDashboardContent variant="worker_admin" />
    </Suspense>
  );
}
