import { unstable_cache } from "next/cache";
import { cache } from "react";
import { ADMIN_ACCOUNTS_TAG, ADMIN_DATA_REVALIDATE_SECONDS } from "@/lib/admin/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminAccount, AdminRole, WorkerAdminAccount, WorkerStatus } from "@/lib/platform/types";

function asStatus(value: unknown): WorkerStatus {
  if (
    value === "banned" ||
    value === "temp_disabled" ||
    value === "suspended" ||
    value === "under_review" ||
    value === "active"
  ) {
    return value;
  }
  return "active";
}

type WorkerAdminRow = {
  worker_id: string;
  email: string;
  full_name: string;
  created_by: string | null;
  created_at: string;
  updated_at?: string | null;
  status?: string | null;
  temp_recovery_pass?: string | null;
  pending_earnings?: number | null;
  earned_this_month?: number | null;
  total_earnings?: number | null;
};

export const getWorkerAdmins = cache(async (): Promise<WorkerAdminAccount[]> => {
  return unstable_cache(loadWorkerAdmins, ["admin-worker-admins"], {
    revalidate: ADMIN_DATA_REVALIDATE_SECONDS,
    tags: [ADMIN_ACCOUNTS_TAG],
  })();
});

async function loadWorkerAdmins(): Promise<WorkerAdminAccount[]> {
  const supabase = createAdminClient();

  const primary = await supabase
    .from("worker_admins")
    .select(
      "worker_id, email, full_name, status, temp_recovery_pass, pending_earnings, earned_this_month, total_earnings, created_by, created_at, updated_at",
    )
    .order("created_at", { ascending: true });

  let rows: WorkerAdminRow[] = [];
  if (primary.error) {
    const legacy = await supabase
      .from("worker_admins")
      .select("worker_id, email, full_name, status, temp_recovery_pass, created_by, created_at, updated_at")
      .order("created_at", { ascending: true });
    if (legacy.error) {
      const bare = await supabase
        .from("worker_admins")
        .select("worker_id, email, full_name, created_by, created_at, updated_at")
        .order("created_at", { ascending: true });
      if (bare.error) throw new Error(bare.error.message);
      rows = (bare.data ?? []) as WorkerAdminRow[];
    } else {
      rows = (legacy.data ?? []) as WorkerAdminRow[];
    }
  } else {
    rows = (primary.data ?? []) as WorkerAdminRow[];
  }

  const ids = rows.map((row) => String(row.worker_id));
  const profileById = new Map<
    string,
    {
      status: string | null;
      temp_recovery_pass: string | null;
      full_name: string | null;
      email: string | null;
      pending_earnings: number | null;
      earned_this_month: number | null;
      total_earnings: number | null;
    }
  >();

  if (ids.length > 0) {
    const enriched = await supabase
      .from("profiles")
      .select("id, status, temp_recovery_pass, full_name, email, pending_earnings, earned_this_month, total_earnings")
      .in("id", ids);
    if (enriched.error) {
      const basic = await supabase
        .from("profiles")
        .select("id, status, temp_recovery_pass, full_name, email, total_earnings")
        .in("id", ids);
      for (const profile of basic.data ?? []) {
        profileById.set(String(profile.id), {
          ...profile,
          pending_earnings: null,
          earned_this_month: null,
        });
      }
    } else {
      for (const profile of enriched.data ?? []) {
        profileById.set(String(profile.id), profile);
      }
    }
  }

  return rows.map((row) => {
    const profile = profileById.get(String(row.worker_id));
    return {
      workerId: String(row.worker_id),
      email: String(row.email || profile?.email || ""),
      fullName: String(row.full_name || profile?.full_name || ""),
      status: asStatus(row.status ?? profile?.status),
      tempRecoveryPass: row.temp_recovery_pass ?? profile?.temp_recovery_pass ?? null,
      pendingEarnings: Number(row.pending_earnings ?? profile?.pending_earnings ?? 0),
      earnedThisMonth: Number(row.earned_this_month ?? profile?.earned_this_month ?? 0),
      totalEarnings: Number(row.total_earnings ?? profile?.total_earnings ?? 0),
      createdBy: row.created_by ? String(row.created_by) : null,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at ?? row.created_at),
    };
  });
}

export const getTierAdmins = cache(async (): Promise<AdminAccount[]> => {
  return unstable_cache(loadTierAdmins, ["admin-tier-admins"], {
    revalidate: ADMIN_DATA_REVALIDATE_SECONDS,
    tags: [ADMIN_ACCOUNTS_TAG],
  })();
});

async function loadTierAdmins(): Promise<AdminAccount[]> {
  const supabase = createAdminClient();

  const { data: admins, error } = await supabase
    .from("admin_users")
    .select("id, email, role, created_by, created_at")
    .in("role", ["admin", "super_admin"])
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  const ids = (admins ?? []).map((row) => String(row.id));
  const profileById = new Map<
    string,
    { full_name: string | null; status: string | null; temp_recovery_pass: string | null; email: string | null }
  >();

  if (ids.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, status, temp_recovery_pass, email")
      .in("id", ids);
    for (const profile of profiles ?? []) {
      profileById.set(String(profile.id), profile);
    }
  }

  return (admins ?? []).map((row) => {
    const profile = profileById.get(String(row.id));
    return {
      id: String(row.id),
      email: row.email || profile?.email || null,
      fullName: profile?.full_name ?? null,
      role: (row.role as AdminRole) ?? "admin",
      status: asStatus(profile?.status),
      tempRecoveryPass: profile?.temp_recovery_pass ?? null,
      createdAt: String(row.created_at),
      createdBy: row.created_by ? String(row.created_by) : null,
    };
  });
}
