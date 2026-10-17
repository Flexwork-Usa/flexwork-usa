import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { OperationsDesk } from "@/components/admin/OperationsDesk";
import { getAdminDashboardData } from "@/lib/admin/dashboard-data";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata = {
  title: "flexwork-usa",
};

export default function ConsolePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <p className="text-sm text-gray-600">Loading…</p>
        </div>
      }
    >
      <ConsoleContent />
    </Suspense>
  );
}

async function ConsoleContent() {
  await connection();

  const session = await createServerSupabaseClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) redirect("/");

  const { data: profile, error: profileError } = await session
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || profile?.role !== "admin") redirect("/");

  try {
    const data = await getAdminDashboardData();
    return (
      <OperationsDesk applications={data.applications} profiles={data.profiles} deposits={data.deposits} />
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load records.";
    return <OperationsDesk applications={[]} profiles={[]} deposits={[]} loadError={message} />;
  }
}
