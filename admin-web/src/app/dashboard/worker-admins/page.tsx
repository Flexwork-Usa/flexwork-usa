import { Suspense } from "react";
import { connection } from "next/server";
import { loadWorkerAdminsPage } from "@/lib/admin/load-account-pages";

export const metadata = { title: "Worker Admins · flexwork-usa" };

export default function DashboardWorkerAdminsPage() {
  return (
    <Suspense fallback={<ContentSkeleton />}>
      <DashboardWorkerAdminsContent />
    </Suspense>
  );
}

async function DashboardWorkerAdminsContent() {
  await connection();
  return loadWorkerAdminsPage();
}

function ContentSkeleton() {
  return <div className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-white" />;
}
