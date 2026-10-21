import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSuperAdminIdentity } from "@/lib/admin/auth-bypass";

const SUPER_ADMIN_PATH = "/super-admin";
const ADMIN_DASHBOARD_PATH = "/dashboard";
const LOGIN_PATH = "/console/v1/login";
const LEGACY_CONSOLE = "/console/v1/x9q7";

function redirectTo(request: NextRequest, path: string, source: NextResponse) {
  const redirect = NextResponse.redirect(new URL(path, request.url));
  source.cookies.getAll().forEach((cookie) => {
    redirect.cookies.set(cookie);
  });
  return redirect;
}

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isMutation = request.method !== "GET" && request.method !== "HEAD";
  const isLogin = path === LOGIN_PATH || path === "/login";
  const isSuperAdminRoute = path.startsWith(SUPER_ADMIN_PATH);
  const isAdminDashboard = path.startsWith(ADMIN_DASHBOARD_PATH);
  const isLegacy = path.startsWith(LEGACY_CONSOLE);

  // TODO: Re-enable Super Admin authentication before production
  if (!user) {
    if (isLogin) return response;
    // Local bypass: allow unauthenticated access to the Super Admin console
    if (isSuperAdminRoute) return response;
    if (path === "/" || isLegacy) {
      return redirectTo(request, SUPER_ADMIN_PATH, response);
    }
    if (isAdminDashboard) {
      return redirectTo(request, LOGIN_PATH, response);
    }
    return response;
  }

  const { data: adminUser } = await supabase
    .from("admin_users")
    .select("id, email, role")
    .eq("id", user.id)
    .maybeSingle();

  const email = adminUser?.email || user.email || "";
  const role = adminUser?.role ?? null;
  const superAdmin = isSuperAdminIdentity(email, role);

  // TODO: Re-enable Super Admin authentication before production
  if (superAdmin) {
    if (!isMutation && (isLogin || path === "/" || isLegacy || isAdminDashboard)) {
      return redirectTo(request, SUPER_ADMIN_PATH, response);
    }
    return response;
  }

  if (path === "/" || isLegacy) {
    if (adminUser && role === "admin") return redirectTo(request, ADMIN_DASHBOARD_PATH, response);
    return redirectTo(request, LOGIN_PATH, response);
  }

  if (isLogin) {
    if (adminUser && role === "admin") return redirectTo(request, ADMIN_DASHBOARD_PATH, response);
    return response;
  }

  if (isSuperAdminRoute) {
    return redirectTo(request, role === "admin" ? ADMIN_DASHBOARD_PATH : LOGIN_PATH, response);
  }

  if (isAdminDashboard) {
    if (!adminUser || role !== "admin") {
      await supabase.auth.signOut();
      return redirectTo(request, LOGIN_PATH, response);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/dashboard",
    "/dashboard/:path*",
    "/super-admin",
    "/super-admin/:path*",
    "/console/v1/login",
    "/console/v1/x9q7",
    "/console/v1/x9q7/:path*",
  ],
};
