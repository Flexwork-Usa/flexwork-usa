import { Suspense } from "react";
import { connection } from "next/server";
import { loadTierAdminsPage } from "@/lib/admin/load-account-pages";

export const metadata = { title: "Admins · flexwork-usa" };

export default function DashboardAdminsPage() {
  return (
    <Suspense fallback={<ContentSkeleton />}>
      <DashboardAdminsContent />
    </Suspense>
  );
}

async function DashboardAdminsContent() {
  await connection();
  return loadTierAdminsPage();
}

function ContentSkeleton() {
  return <div className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-white" />;
}
