import { Suspense } from "react";
import { connection } from "next/server";
import { ProjectLaunchPage } from "@/components/dashboard/ProjectLaunchPage";

export const metadata = { title: "Launch Task · flexwork-usa" };

export default function DashboardProjectPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="px-4 py-10 text-sm text-slate-600">Loading workspace…</div>}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  return <ProjectLaunchPage applicationId={id} variant="worker" />;
}
