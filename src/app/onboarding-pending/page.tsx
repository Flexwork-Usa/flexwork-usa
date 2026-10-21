import { connection } from "next/server";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/SignOutButton";
import { AuthPage } from "@/components/auth/AuthPage";
import { provisionWorkerProfile } from "@/lib/auth/provision-profile";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata = { title: "Pending approval · flexwork-usa" };

export default async function OnboardingPendingPage() {
  await connection();
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await provisionWorkerProfile(user);

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, is_approved, onboarding_status")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.is_approved && profile.onboarding_status !== "pending_approval") {
    redirect("/dashboard");
  }

  const name = profile?.full_name ? `, ${profile.full_name}` : "";
  const email = profile?.email ? ` (${profile.email})` : "";

  return (
    <AuthPage
      title="Application under review"
      subtitle={`Thanks${name}. Your worker account${email} is waiting on admin approval.`}
      panelTitle="You're in the review queue."
      panelBody="You can sign in, but jobs and the dashboard stay locked until an administrator approves your application."
      highlights={[
        "Keep this email handy — we use it to unlock your dashboard",
        "Jobs, tokens, and payouts open after approval",
        "No extra steps from you unless we ask for more details",
      ]}
    >
      <p className="text-sm leading-6 text-slate-600">
        We will unlock access as soon as your onboarding status is approved. You can safely sign out and come back
        later.
      </p>
      <div className="mt-6">
        <SignOutButton className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 hover:bg-slate-50" />
      </div>
    </AuthPage>
  );
}
