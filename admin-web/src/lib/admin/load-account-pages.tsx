import { TierAdminsManager } from "@/components/admin/TierAdminsManager";
import { WorkerAdminsManager } from "@/components/admin/WorkerAdminsManager";
import { getTierAdmins, getWorkerAdmins } from "@/lib/admin/accounts-data";
import { resolveOpsActor, shellMode } from "@/lib/admin/resolve-actor";

export async function loadWorkerAdminsPage() {
  const { adminEmail } = await resolveOpsActor();

  try {
    const accounts = await getWorkerAdmins();
    return <WorkerAdminsManager accounts={accounts} />;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load Worker Admins.";
    return (
      <div>
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{message}</p>
        <WorkerAdminsManager accounts={[]} />
        <p className="sr-only">{adminEmail}</p>
      </div>
    );
  }
}

export async function loadTierAdminsPage() {
  const { adminEmail, role } = await resolveOpsActor();
  const canManage = role === "super_admin";
  void shellMode(role);

  try {
    const accounts = await getTierAdmins();
    return <TierAdminsManager accounts={accounts} actorEmail={adminEmail} canManage={canManage} />;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load Admins.";
    return (
      <div>
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{message}</p>
        <TierAdminsManager accounts={[]} actorEmail={adminEmail} canManage={canManage} />
      </div>
    );
  }
}
