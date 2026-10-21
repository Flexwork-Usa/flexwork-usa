import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  ACCOUNT_RESTRICTED_PATH,
  ONBOARDING_PENDING_PATH,
  WORKER_ADMIN_PATH,
  adminPortalHome,
  isActiveAccountStatus,
  isOpsAdminRole,
  isWorkerPortalRole,
} from "@/lib/auth/account-gate";

const CONSOLE_PATH = "/console/v1/x9q7";

function redirectTo(request: NextRequest, path: string, source: NextResponse) {
  const redirect = NextResponse.redirect(new URL(path, request.url));
  source.cookies.getAll().forEach((cookie) => {
    redirect.cookies.set(cookie);
  });
  return redirect;
}

function nextWithPath(request: NextRequest, path: string) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", path);
  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

function isServerMutation(request: NextRequest) {
  if (request.method !== "GET" && request.method !== "HEAD") return true;
  return request.headers.has("next-action") || request.headers.has("rsc-action-id");
}

async function loadAccountGate(
  supabase: {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          maybeSingle: () => Promise<{ data: Record<string, string | boolean | null> | null }>;
        };
      };
    };
  },
  userId: string,
) {
  const [{ data: profile }, { data: adminUser }, { data: workerAdminRow }] = await Promise.all([
    supabase
      .from("profiles")
      .select("is_approved, onboarding_status, role, status")
      .eq("id", userId)
      .maybeSingle(),
    supabase.from("admin_users").select("role").eq("id", userId).maybeSingle(),
    supabase.from("worker_admins").select("worker_id").eq("worker_id", userId).maybeSingle(),
  ]);

  const opsRole = String(adminUser?.role || profile?.role || "");
  const isOpsAdmin = isOpsAdminRole(opsRole) || isOpsAdminRole(String(profile?.role || ""));
  const isWorkerAdmin =
    Boolean(workerAdminRow?.worker_id) ||
    adminUser?.role === "worker_admin" ||
    profile?.role === "worker_admin";
  const restricted = !isActiveAccountStatus(profile?.status ? String(profile.status) : null);
  const pending = !profile?.is_approved || profile?.onboarding_status === "pending_approval";
  const workerRole = isWorkerPortalRole(profile?.role ? String(profile.role) : isWorkerAdmin ? "worker_admin" : "worker");

  const home = isOpsAdmin
    ? adminPortalHome(opsRole)
    : restricted
      ? ACCOUNT_RESTRICTED_PATH
      : pending
        ? ONBOARDING_PENDING_PATH
        : isWorkerAdmin
          ? WORKER_ADMIN_PATH
          : "/dashboard";

  return { profile, adminUser, isOpsAdmin, isWorkerAdmin, restricted, pending, workerRole, home };
}

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return nextWithPath(request, path);
  }

  let response = nextWithPath(request, path);

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = nextWithPath(request, path);
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (path === "/login" || path.startsWith("/console/v1/login")) {
    if (!user || isServerMutation(request)) return response;
    const gate = await loadAccountGate(supabase, user.id);
    return redirectTo(request, gate.home, response);
  }

  if (path.startsWith(CONSOLE_PATH)) {
    if (isServerMutation(request)) return response;
    if (!user) return redirectTo(request, "/login", response);
    const gate = await loadAccountGate(supabase, user.id);
    if (!gate.isOpsAdmin) return redirectTo(request, gate.home, response);
    return response;
  }

  const workerGuarded =
    path.startsWith("/dashboard") ||
    path.startsWith("/worker-admin") ||
    path === "/jobs" ||
    path === ONBOARDING_PENDING_PATH ||
    path === ACCOUNT_RESTRICTED_PATH;

  if (workerGuarded) {
    if (!user) {
      if (isServerMutation(request)) return response;
      return redirectTo(request, "/login", response);
    }
    const gate = await loadAccountGate(supabase, user.id);

    if (isServerMutation(request)) return response;

    if (gate.isOpsAdmin) {
      return redirectTo(request, gate.home, response);
    }

    if (path === ACCOUNT_RESTRICTED_PATH) {
      if (!gate.restricted) return redirectTo(request, gate.home, response);
      return response;
    }

    if (gate.restricted) {
      return redirectTo(request, ACCOUNT_RESTRICTED_PATH, response);
    }

    if (path === ONBOARDING_PENDING_PATH) {
      if (!gate.pending) return redirectTo(request, gate.home, response);
      return response;
    }

    if (gate.pending && (path.startsWith("/dashboard") || path.startsWith("/worker-admin") || path === "/jobs")) {
      return redirectTo(request, ONBOARDING_PENDING_PATH, response);
    }

    if (path.startsWith("/worker-admin")) {
      if (!gate.isWorkerAdmin) return redirectTo(request, gate.home, response);
      return response;
    }

    if (path.startsWith("/dashboard") && gate.isWorkerAdmin) {
      if (path.startsWith("/dashboard/projects/")) {
        return redirectTo(request, path.replace("/dashboard/projects/", "/worker-admin/dashboard/projects/"), response);
      }
      if (path.startsWith("/dashboard/payments")) {
        return redirectTo(request, "/worker-admin/dashboard/payments", response);
      }
      if (path.startsWith("/dashboard/tokens")) {
        return redirectTo(request, "/worker-admin/dashboard/tokens", response);
      }
      if (path.startsWith("/dashboard/applications")) {
        return redirectTo(request, "/worker-admin/dashboard/applications", response);
      }
      return redirectTo(request, WORKER_ADMIN_PATH, response);
    }

    if ((path.startsWith("/dashboard") || path === "/jobs") && !gate.workerRole && !gate.isWorkerAdmin) {
      return redirectTo(request, gate.home, response);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/login",
    "/dashboard",
    "/dashboard/:path*",
    "/worker-admin/:path*",
    "/jobs",
    "/onboard",
    "/onboarding-pending",
    "/account-restricted",
    "/console/v1/login",
    "/console/v1/x9q7",
    "/console/v1/x9q7/:path*",
  ],
};
