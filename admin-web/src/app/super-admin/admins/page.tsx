import { Suspense } from "react";
import { connection } from "next/server";
import { loadTierAdminsPage } from "@/lib/admin/load-account-pages";

export const metadata = { title: "Admins · Super Admin · flexwork-usa" };

export default function SuperAdminAdminsPage() {
  return (
    <Suspense fallback={<ContentSkeleton />}>
      <SuperAdminAdminsContent />
    </Suspense>
  );
}

async function SuperAdminAdminsContent() {
  await connection();
  return loadTierAdminsPage();
}

function ContentSkeleton() {
  return <div className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-white" />;
}
