import { Suspense } from "react";
import { WorkerDashboardContent } from "@/app/(site)/dashboard/page";
import { DashboardSkeleton } from "@/components/dashboard/ShimmerCard";

export const metadata = { title: "Payments · Worker Admin · flexwork-usa" };

export default function WorkerAdminPaymentsPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <WorkerDashboardContent variant="worker_admin" initialTab="payments" />
    </Suspense>
  );
}
