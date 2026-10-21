import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { JobsBoard, JobsPageSkeleton } from "@/components/jobs/JobsBoard";
import { getActiveJobs, getMyAppliedJobIds } from "@/lib/jobs/queries";
import { ACCOUNT_RESTRICTED_PATH } from "@/lib/auth/account-gate";
import { isRestrictedStatus } from "@/lib/platform/rules";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Opportunities · flexwork-usa",
};

export default function JobsPage() {
  return (
    <Suspense fallback={<JobsPageSkeleton />}>
      <JobsContent />
    </Suspense>
  );
}

async function getWorkerAccess() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { signedIn: false, tokenBalance: 0, restricted: false, applicant: null };
  }

  const enriched = await supabase
    .from("profiles")
    .select("token_balance, is_approved, status, full_name, email, country")
    .eq("id", user.id)
    .maybeSingle<{
      token_balance: number | null;
      is_approved: boolean | null;
      status: string | null;
      full_name: string | null;
      email: string | null;
      country: string | null;
    }>();

  if (enriched.error) {
    const legacy = await supabase
      .from("profiles")
      .select("token_balance, is_approved")
      .eq("id", user.id)
      .maybeSingle<{ token_balance: number | null; is_approved: boolean | null }>();
    if (legacy.error || !legacy.data?.is_approved) {
      return { signedIn: false, tokenBalance: 0, restricted: false, applicant: null };
    }
    return {
      signedIn: true,
      tokenBalance: legacy.data.token_balance ?? 0,
      restricted: false,
      applicant: {
        fullName: "",
        email: user.email || "",
        country: "",
        tokenBalance: legacy.data.token_balance ?? 0,
      },
    };
  }

  if (!enriched.data?.is_approved) return { signedIn: false, tokenBalance: 0, restricted: false, applicant: null };
  return {
    signedIn: true,
    tokenBalance: enriched.data.token_balance ?? 0,
    restricted: isRestrictedStatus(enriched.data.status),
    applicant: {
      fullName: enriched.data.full_name || "",
      email: enriched.data.email || user.email || "",
      country: enriched.data.country || "",
      tokenBalance: enriched.data.token_balance ?? 0,
    },
  };
}

async function JobsContent() {
  await connection();

  try {
    const [jobs, appliedJobIds, access] = await Promise.all([
      getActiveJobs(),
      getMyAppliedJobIds(),
      getWorkerAccess(),
    ]);

    if (access.restricted) {
      redirect(ACCOUNT_RESTRICTED_PATH);
    }

    return <JobsBoard jobs={jobs} appliedJobIds={appliedJobIds} {...access} />;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load jobs.";
    return <JobsBoard jobs={[]} appliedJobIds={[]} signedIn={false} tokenBalance={0} applicant={null} loadError={message} />;
  }
}
