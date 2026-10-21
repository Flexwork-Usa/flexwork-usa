export function isAppShellPath(pathname: string | null | undefined) {
  const path = pathname || "";
  return path.startsWith("/dashboard") || path.startsWith("/worker-admin");
}

export function hidesSiteChrome(pathname: string | null | undefined) {
  const path = pathname || "";
  return (
    isAppShellPath(path) ||
    path === "/login" ||
    path.startsWith("/console/v1/login") ||
    path === "/onboarding-pending" ||
    path === "/account-restricted"
  );
}
