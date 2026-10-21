import { Suspense } from "react";
import { connection } from "next/server";
import { loadAdminConsole } from "@/lib/admin/load-console";

export const metadata = { title: "Admin · flexwork-usa" };

export default function AdminDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}) {
  return (
    <Suspense fallback={<ContentSkeleton />}>
      <AdminDashboardContent searchParams={searchParams} />
    </Suspense>
  );
}

async function AdminDashboardContent({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}) {
  await connection();
  const params = searchParams instanceof Promise ? await searchParams : searchParams;
  return loadAdminConsole("admin", params?.panel);
}

function ContentSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-white" />
    </div>
  );
}
