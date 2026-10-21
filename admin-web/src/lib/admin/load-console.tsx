import { redirect } from "next/navigation";
import { AdminConsole } from "@/components/admin/AdminConsole";
import { getAdminDashboardData, type AdminDashboardBundle } from "@/lib/admin/dashboard-data";
import { parseOpsPanel, type OpsPanel } from "@/lib/admin/nav";
import { resolveOpsActor } from "@/lib/admin/resolve-actor";
import type { AdminRole } from "@/lib/platform/types";

const EMPTY: AdminDashboardBundle = {
  applications: [],
  platformApplications: [],
  workers: [],
  treasuryDeposits: [],
  jobs: [],
  leaderboard: [],
  payouts: [],
  admins: [],
  analytics: { daily: [], funnel: [] },
  currentRole: "super_admin",
};

export async function loadAdminConsole(
  expected: "super_admin" | "admin",
  panelParam?: string | string[] | null,
) {
  const { role } = await resolveOpsActor();

  if (expected === "super_admin" && role !== "super_admin") {
    redirect(role === "admin" ? "/dashboard" : "/console/v1/login");
  }
  if (expected === "admin" && role !== "admin") {
    redirect(role === "super_admin" ? "/super-admin" : "/console/v1/login");
  }

  const initialPanel: OpsPanel = parseOpsPanel(
    Array.isArray(panelParam) ? panelParam[0] : panelParam,
  );

  try {
    const data = await getAdminDashboardData(role);
    return <AdminConsole data={data} mode={expected} initialPanel={initialPanel} />;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load records.";
    return (
      <div>
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{message}</p>
        <AdminConsole data={{ ...EMPTY, currentRole: role as AdminRole }} mode={expected} initialPanel={initialPanel} />
      </div>
    );
  }
}
