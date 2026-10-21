import { Suspense } from "react";
import { WorkerDashboardContent } from "@/app/(site)/dashboard/page";
import { DashboardSkeleton } from "@/components/dashboard/ShimmerCard";

export const metadata = { title: "Payments & Invoices · flexwork-usa" };

export default function PaymentsPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <WorkerDashboardContent variant="worker" initialTab="payments" />
    </Suspense>
  );
}
