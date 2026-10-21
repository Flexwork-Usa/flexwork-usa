"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import {
  buildOpsNav,
  opsHomePath,
  parseOpsPanel,
  type OpsNavKey,
  type OpsPanel,
} from "@/lib/admin/nav";
import { AdminSignOutButton } from "@/components/admin/AdminSignOutButton";

type OpsNavContextValue = {
  mode: "super_admin" | "admin";
  panel: OpsPanel;
  setPanel: (panel: OpsPanel) => void;
  activeKey: OpsNavKey;
};

const OpsNavContext = createContext<OpsNavContextValue | null>(null);

export function useOpsNav() {
  const value = useContext(OpsNavContext);
  if (!value) {
    throw new Error("useOpsNav must be used within AdminOperationsLayout");
  }
  return value;
}

/** Safe hook when console content may render outside the frame (tests / legacy). */
export function useOpsNavOptional() {
  return useContext(OpsNavContext);
}

const TITLE_BY_KEY: Record<OpsNavKey, { title: string; subtitle?: string }> = {
  overview: { title: "Operations", subtitle: undefined },
  jobs: { title: "Job Manager" },
  deposits: { title: "Deposit Auditor" },
  workers: { title: "Workers" },
  applications: { title: "Applications" },
  payouts: { title: "Payouts" },
  leaderboard: { title: "Leaderboard" },
  onboarding: { title: "Onboarding" },
  "worker-admins": {
    title: "Worker Admins",
    subtitle: "3rd-tier accounts from public.worker_admins (separate from Workers)",
  },
  admins: { title: "Admins", subtitle: "2nd-tier Admin management" },
};

function pathActiveKey(pathname: string, panel: OpsPanel): OpsNavKey {
  if (pathname.endsWith("/worker-admins")) return "worker-admins";
  if (pathname.endsWith("/admins")) return "admins";
  return panel;
}

export function AdminOperationsLayout({
  mode,
  adminEmail,
  roleLabel,
  loadError,
  children,
}: {
  mode: "super_admin" | "admin";
  adminEmail: string;
  roleLabel?: string;
  loadError?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const home = opsHomePath(mode);
  const navItems = useMemo(() => buildOpsNav(mode), [mode]);
  const mobileTopItems = navItems.slice(0, 5);
  const mobileBottomItems = navItems.slice(5);

  const [panel, setPanelState] = useState<OpsPanel>(() => parseOpsPanel(searchParams.get("panel")));

  useEffect(() => {
    if (pathname === home || pathname === `${home}/`) {
      setPanelState(parseOpsPanel(searchParams.get("panel")));
    }
  }, [home, pathname, searchParams]);

  useEffect(() => {
    function onPopState() {
      if (pathname === home || pathname === `${home}/`) {
        setPanelState(parseOpsPanel(new URL(window.location.href).searchParams.get("panel")));
      }
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [home, pathname]);

  useEffect(() => {
    router.prefetch(`${home}/worker-admins`);
    router.prefetch(`${home}/admins`);
    router.prefetch(home);
  }, [home, router]);

  const setPanel = useCallback(
    (next: OpsPanel) => {
      setPanelState(next);
      const url = next === "overview" ? home : `${home}?panel=${next}`;
      window.history.pushState(null, "", url);
    },
    [home],
  );

  const activeKey = pathActiveKey(pathname, panel);
  const heading = TITLE_BY_KEY[activeKey];

  const navigate = useCallback(
    (event: MouseEvent<HTMLAnchorElement>, href: string, key: OpsNavKey) => {
      const onHome = pathname === home || pathname === `${home}/`;
      const isPanelKey =
        key === "overview" ||
        key === "jobs" ||
        key === "deposits" ||
        key === "workers" ||
        key === "applications" ||
        key === "payouts" ||
        key === "leaderboard" ||
        key === "onboarding";

      // Instant client-side panel switch — no RSC refetch.
      if (onHome && isPanelKey) {
        event.preventDefault();
        startTransition(() => setPanel(key as OpsPanel));
        return;
      }

      // Prefetch destination, then soft-navigate (layout stays mounted).
      event.preventDefault();
      router.prefetch(href);
      startTransition(() => {
        router.push(href);
      });
    },
    [home, pathname, router, setPanel],
  );

  const contextValue = useMemo(
    () => ({ mode, panel, setPanel, activeKey }),
    [mode, panel, setPanel, activeKey],
  );

  return (
    <OpsNavContext.Provider value={contextValue}>
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="Flexwork-USA" className="h-11 w-auto" />
              <p className="text-xs capitalize text-slate-500">
                {mode === "super_admin" ? "Super Admin" : "Admin"}
                {roleLabel ? ` · ${roleLabel}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3">
              <p className="hidden text-sm text-slate-600 sm:block">{adminEmail}</p>
              <AdminSignOutButton />
            </div>
          </div>
          <nav className="mx-auto hidden max-w-[1600px] gap-1 overflow-x-auto px-4 sm:px-6 md:flex" aria-label="Admin">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeKey === item.key;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  prefetch
                  onClick={(event) => navigate(event, item.href, item.key)}
                  className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm ${
                    active
                      ? "border-[#C85A17] font-semibold text-[#C85A17]"
                      : "border-transparent text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <nav className="mx-auto flex max-w-[1600px] gap-1 overflow-x-auto px-4 sm:px-6 md:hidden" aria-label="Primary">
            {mobileTopItems.map((item) => {
              const Icon = item.icon;
              const active = activeKey === item.key;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  prefetch
                  onClick={(event) => navigate(event, item.href, item.key)}
                  className={`inline-flex shrink-0 items-center gap-1.5 border-b-2 px-2.5 py-2.5 text-xs ${
                    active
                      ? "border-[#C85A17] font-semibold text-[#C85A17]"
                      : "border-transparent text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <main className="mx-auto max-w-[1600px] px-4 py-6 pb-24 sm:px-6 md:pb-6">
          <div className="mb-4">
            <h1 className="text-xl font-semibold tracking-tight">{heading.title}</h1>
            {heading.subtitle ? <p className="mt-1 text-sm text-slate-600">{heading.subtitle}</p> : null}
          </div>
          {loadError ? (
            <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {loadError}
            </p>
          ) : null}
          {children}
        </main>
        <nav
          className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white md:hidden"
          aria-label="Admin"
        >
          <div className="flex gap-1 overflow-x-auto px-2 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            {mobileBottomItems.map((item) => {
              const Icon = item.icon;
              const active = activeKey === item.key;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  prefetch
                  onClick={(event) => navigate(event, item.href, item.key)}
                  className={`inline-flex min-w-[4.5rem] shrink-0 flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-[11px] leading-tight ${
                    active ? "font-semibold text-[#C85A17]" : "text-slate-500"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </OpsNavContext.Provider>
  );
}
