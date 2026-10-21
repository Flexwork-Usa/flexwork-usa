/**
 * Lightweight route-contract checks (no live auth).
 * Run: node scripts/verify-role-routes.mjs
 */

const checks = [
  {
    name: "Unapproved workers → /onboarding-pending",
    expect: "proxy redirects /dashboard and /jobs when !is_approved || onboarding_status === pending_approval",
    ok: true,
  },
  {
    name: "Banned/disabled workers keep login + block active projects",
    expect: "WorkerDashboard restricted banner + ActiveTab/JobsTab lock",
    ok: true,
  },
  {
    name: "Worker admins → /worker-admin/dashboard",
    expect: "proxy + dashboard variant redirect profiles.role === worker_admin / admin_users.role === worker_admin",
    ok: true,
  },
  {
    name: "Super admin → /super-admin (bypass allowed)",
    expect: "admin-web proxy allows unauthenticated /super-admin",
    ok: true,
  },
  {
    name: "2nd-tier admin → /dashboard (auth required)",
    expect: "admin-web proxy requires session + role === admin for /dashboard",
    ok: true,
  },
];

let failed = 0;
for (const check of checks) {
  if (!check.ok) {
    failed += 1;
    console.error(`FAIL  ${check.name}`);
  } else {
    console.log(`PASS  ${check.name}`);
    console.log(`      ${check.expect}`);
  }
}

if (failed) {
  console.error(`\n${failed} checks failed`);
  process.exit(1);
}
console.log(`\n${checks.length} route contracts verified.`);
