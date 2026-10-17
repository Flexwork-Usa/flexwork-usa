import { Suspense } from "react";
import { connection } from "next/server";
import { JobsBoard, JobsPageSkeleton } from "@/components/jobs/JobsBoard";
import { getActiveJobs, getMyAppliedJobIds } from "@/lib/jobs/queries";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Opportunities · flexwork-usa",
};

export default function JobsPage() {
  return (
    <Suspense
      fallback={<JobsPageSkeleton />}
    >
      <JobsContent />
    </Suspense>
  );
}

async function getWorkerAccess() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { signedIn: false, tokenBalance: 0 };

  const { data, error } = await supabase
    .from("profiles")
    .select("token_balance, is_approved")
    .eq("id", user.id)
    .maybeSingle<{ token_balance: number | null; is_approved: boolean | null }>();

  if (error || !data?.is_approved) return { signedIn: false, tokenBalance: 0 };
  return { signedIn: true, tokenBalance: data.token_balance ?? 0 };
}

async function JobsContent() {
  await connection();

  try {
    const [jobs, appliedJobIds, access] = await Promise.all([
      getActiveJobs(),
      getMyAppliedJobIds(),
      getWorkerAccess(),
    ]);
    return <JobsBoard jobs={jobs} appliedJobIds={appliedJobIds} {...access} />;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load jobs.";
    return <JobsBoard jobs={[]} appliedJobIds={[]} signedIn={false} tokenBalance={0} loadError={message} />;
  }
}
