import { Suspense } from "react";
import { WorkerDashboardContent } from "@/app/(site)/dashboard/page";
import { DashboardSkeleton } from "@/components/dashboard/ShimmerCard";

export const metadata = { title: "Buy Tokens · Worker Admin · flexwork-usa" };

export default function WorkerAdminTokensPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <WorkerDashboardContent variant="worker_admin" initialTab="tokens" />
    </Suspense>
  );
}
