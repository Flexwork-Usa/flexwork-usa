import { connection } from "next/server";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/SignOutButton";
import { AuthPage } from "@/components/auth/AuthPage";
import { accountStatusLabel, isActiveAccountStatus } from "@/lib/auth/account-gate";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata = { title: "Account restricted · flexwork-usa" };

export default async function AccountRestrictedPage() {
  await connection();
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, status, token_balance")
    .eq("id", user.id)
    .maybeSingle();

  if (isActiveAccountStatus(profile?.status)) {
    redirect("/dashboard");
  }

  const status = accountStatusLabel(profile?.status);
  const name = profile?.full_name ? `, ${profile.full_name}` : "";
  const tokens = Number(profile?.token_balance ?? 0);

  return (
    <AuthPage
      title="Account access paused"
      subtitle={`This account${name} is ${status}. Work portals stay locked until an administrator restores access.`}
      panelTitle="Your workspace is on hold."
      panelBody="Jobs, applications, and payouts are unavailable while this account is not active. Your profile and token balance are still on file."
      highlights={[
        `Current status: ${status}`,
        `Token balance: ${tokens}`,
        "Sign out now and come back after support restores access",
      ]}
    >
      <p className="text-sm leading-6 text-slate-600">
        If this looks wrong, contact support with the email on this account
        {profile?.email ? ` (${profile.email})` : ""}.
      </p>
      <div className="mt-6">
        <SignOutButton className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 hover:bg-slate-50" />
      </div>
    </AuthPage>
  );
}
