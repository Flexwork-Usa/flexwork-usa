import {
  BriefcaseBusiness,
  ClipboardList,
  Crown,
  LayoutDashboard,
  Send,
  Shield,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type OpsPanel =
  | "overview"
  | "jobs"
  | "deposits"
  | "workers"
  | "applications"
  | "payouts"
  | "leaderboard"
  | "onboarding";

export type OpsNavKey = OpsPanel | "worker-admins" | "admins";

export type OpsNavItem = {
  key: OpsNavKey;
  label: string;
  href: string;
  icon: LucideIcon;
};

export function opsHomePath(mode: "super_admin" | "admin") {
  return mode === "super_admin" ? "/super-admin" : "/dashboard";
}

export function buildOpsNav(mode: "super_admin" | "admin"): OpsNavItem[] {
  const home = opsHomePath(mode);
  const workerAdminsHref = `${home}/worker-admins`;
  const adminsHref = `${home}/admins`;

  return [
    { key: "overview", label: "Overview", href: home, icon: LayoutDashboard },
    { key: "jobs", label: "Job Manager", href: `${home}?panel=jobs`, icon: BriefcaseBusiness },
    { key: "deposits", label: "Deposit Auditor", href: `${home}?panel=deposits`, icon: Wallet },
    { key: "workers", label: "Workers", href: `${home}?panel=workers`, icon: Users },
    { key: "applications", label: "Applications", href: `${home}?panel=applications`, icon: Send },
    { key: "worker-admins", label: "Worker Admins", href: workerAdminsHref, icon: Users },
    { key: "admins", label: "Admins", href: adminsHref, icon: Shield },
    { key: "payouts", label: "Payouts", href: `${home}?panel=payouts`, icon: Wallet },
    { key: "leaderboard", label: "Leaderboard", href: `${home}?panel=leaderboard`, icon: Crown },
    { key: "onboarding", label: "Onboarding", href: `${home}?panel=onboarding`, icon: ClipboardList },
  ];
}

export function parseOpsPanel(value: string | null | undefined): OpsPanel {
  switch (value) {
    case "jobs":
    case "deposits":
    case "workers":
    case "applications":
    case "payouts":
    case "leaderboard":
    case "onboarding":
    case "overview":
      return value;
    default:
      return "overview";
  }
}
