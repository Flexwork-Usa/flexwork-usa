import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";
import { AdminOperationsLayout } from "@/components/admin/AdminOperationsLayout";
import { resolveOpsActor, shellMode } from "@/lib/admin/resolve-actor";

export async function OpsSegmentLayout({
  expected,
  children,
}: {
  expected: "super_admin" | "admin";
  children: ReactNode;
}) {
  const { adminEmail, role } = await resolveOpsActor();

  if (expected === "super_admin" && role !== "super_admin") {
    redirect(role === "admin" ? "/dashboard" : "/console/v1/login");
  }
  if (expected === "admin" && role !== "admin") {
    redirect(role === "super_admin" ? "/super-admin" : "/console/v1/login");
  }

  const mode = shellMode(role);

  return (
    <Suspense fallback={<OpsChromeFallback mode={mode} adminEmail={adminEmail} />}>
      <AdminOperationsLayout
        mode={mode}
        adminEmail={adminEmail}
        roleLabel={role.replaceAll("_", " ")}
      >
        {children}
      </AdminOperationsLayout>
    </Suspense>
  );
}

function OpsChromeFallback({
  mode,
  adminEmail,
}: {
  mode: "super_admin" | "admin";
  adminEmail: string;
}) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white lg:block">
          <div className="border-b border-slate-200 px-4 py-4">
            <p className="text-sm font-semibold">flexwork-usa</p>
            <p className="text-xs capitalize text-slate-500">
              {mode === "super_admin" ? "Super Admin" : "Admin"}
            </p>
          </div>
          <div className="space-y-2 p-3">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        </aside>
        <div className="min-w-0 flex-1 px-4 py-6 sm:px-6">
          <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
          <p className="mt-2 text-sm text-slate-500">{adminEmail}</p>
          <div className="mt-6 h-64 animate-pulse rounded-2xl border border-slate-200 bg-white" />
        </div>
      </div>
    </div>
  );
}
