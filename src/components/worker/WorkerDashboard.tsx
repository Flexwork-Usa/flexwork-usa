"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useAnimation } from "framer-motion";
import {
  Briefcase,
  Coins,
  CreditCard,
  Headphones,
  LayoutDashboard,
  Send,
  Settings,
  Zap,
} from "lucide-react";
import ActiveTab from "@/components/dashboard/ActiveTab";
import AppliedTab from "@/components/dashboard/AppliedTab";
import BuyTokensTab from "@/components/dashboard/BuyTokensTab";
import { DepositSessionModal } from "@/components/dashboard/DepositSessionModal";
import JobsTab from "@/components/dashboard/JobsTab";
import LeaderboardWidget from "@/components/dashboard/LeaderboardWidget";
import OverviewTab from "@/components/dashboard/OverviewTab";
import PaymentsTab from "@/components/dashboard/PaymentsTab";
import { PayoutModal } from "@/components/dashboard/PayoutModal";
import SettingsTab from "@/components/dashboard/SettingsTab";
import SupportTab from "@/components/dashboard/SupportTab";
import WorkerAnalytics, { type WorkerEarningsPoint, type WorkerPipelineStat } from "@/components/dashboard/WorkerAnalytics";
import type { DashboardTab, DashboardTabId, WorkerApplication, WorkerDeposit, WorkerProfileView } from "@/components/dashboard/types";
import { Card, isActiveStatus, orangeButton, quietButton } from "@/components/dashboard/ui";
import { BrandLogo } from "@/components/BrandLogo";
import { SignOutButton } from "@/components/SignOutButton";
import { walletTypeFromNetwork, type TokenPurchasePlan, type WalletType } from "@/lib/deposits";
import type { MarketplaceJob } from "@/lib/jobs/types";
import { isRestrictedStatus, MIN_PAYOUT_USD } from "@/lib/platform/rules";
import type { ActiveProject, JobBidLeaderboardRow, LeaderboardEntry, PayoutRequest, PlatformApplication, TreasuryDeposit } from "@/lib/platform/types";

export type { WorkerApplication, WorkerDeposit, WorkerProfileView };

const TABS: Array<{ id: DashboardTab; label: string; icon: typeof LayoutDashboard }> = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "jobs", label: "Jobs", icon: Briefcase },
  { id: "active", label: "Active Projects", icon: Zap },
  { id: "applied", label: "Applied Projects", icon: Send },
  { id: "tokens", label: "Buy Tokens", icon: Coins },
  { id: "payments", label: "Payments & Invoices", icon: CreditCard },
  { id: "settings", label: "Account Settings", icon: Settings },
  { id: "support", label: "Support & Resources", icon: Headphones },
];

const MOBILE_TOP_TABS = TABS.slice(0, 4);
const MOBILE_BOTTOM_TABS = TABS.slice(4);

function tabFrom(value: string | null): DashboardTab {
  if (value === "topup" || value === "tokens") return "tokens";
  return TABS.some((tab) => tab.id === value) ? (value as DashboardTab) : "overview";
}

function panelOf(tab: DashboardTabId): DashboardTab {
  return tab === "topup" ? "tokens" : tab;
}

function dashboardHome(pathname: string) {
  return pathname.startsWith("/worker-admin") ? "/worker-admin/dashboard" : "/dashboard";
}

function writeTab(next: DashboardTabId, pathname: string) {
  const home = dashboardHome(pathname);
  const url = new URL(window.location.href);
  url.pathname =
    next === "payments"
      ? `${home}/payments`
      : next === "tokens" || next === "topup"
        ? `${home}/tokens`
        : next === "applied"
          ? `${home}/applications`
          : home;
  if (next === "overview" || next === "payments" || next === "applied" || next === "tokens" || next === "topup") {
    url.searchParams.delete("tab");
  } else url.searchParams.set("tab", next);
  const href = `${url.pathname}${url.search}`;
  const state = window.history.state as Record<string, unknown> | null;
  window.history.replaceState(state ? { ...state } : { __NA: true }, "", href);
}

export function WorkerDashboard({
  profile,
  applications,
  applicationsError,
  deposits,
  depositsError,
  jobs,
  jobsError,
  platformApplications = [],
  bidLeaderboards = {},
  treasuryDeposits = [],
  leaderboard = [],
  workspaceProjects = [],
  payouts = [],
  analyticsPipeline = [],
  analyticsEarnings = [],
  initialTab,
}: {
  profile: WorkerProfileView;
  applications: WorkerApplication[];
  applicationsError?: string;
  deposits: WorkerDeposit[];
  depositsError?: string;
  jobs: MarketplaceJob[];
  jobsError?: string;
  platformApplications?: PlatformApplication[];
  bidLeaderboards?: Record<string, JobBidLeaderboardRow[]>;
  treasuryDeposits?: TreasuryDeposit[];
  leaderboard?: LeaderboardEntry[];
  workspaceProjects?: ActiveProject[];
  payouts?: PayoutRequest[];
  pendingPayoutTotal?: number;
  analyticsPipeline?: WorkerPipelineStat[];
  analyticsEarnings?: WorkerEarningsPoint[];
  initialTab?: DashboardTabId;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const contentControls = useAnimation();
  const resolvedInitial = initialTab ?? tabFrom(searchParams.get("tab"));
  const tabRef = useRef<DashboardTabId>(resolvedInitial);
  const [activeTab, setActiveTab] = useState<DashboardTabId>(resolvedInitial);
  const [visited, setVisited] = useState<Set<DashboardTab>>(() => new Set([panelOf(resolvedInitial)]));
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<TokenPurchasePlan | null>(null);
  const [selectedNetwork, setSelectedNetwork] = useState<WalletType>("USDT (TRC-20)");
  const [resumeDeposit, setResumeDeposit] = useState<TreasuryDeposit | null>(null);
  const [payoutModalOpen, setPayoutModalOpen] = useState(false);
  const [payoutNotice, setPayoutNotice] = useState<string | null>(null);
  const [balance, setBalance] = useState(profile.tokenBalance);
  const [pendingBalance, setPendingBalance] = useState(profile.pendingEarnings);
  const restricted = isRestrictedStatus(profile.status);
  const [appliedIds, setAppliedIds] = useState(
    () =>
      new Set([
        ...applications.map((item) => item.jobId).filter((id): id is string => Boolean(id)),
        ...platformApplications.map((item) => item.jobId),
      ]),
  );
  const [applyError, setApplyError] = useState<Record<string, string>>({});
  const [pendingJob, setPendingJob] = useState<string | null>(null);

  useEffect(() => {
    setBalance(profile.tokenBalance);
  }, [profile.tokenBalance]);

  useEffect(() => {
    setPendingBalance(profile.pendingEarnings);
  }, [profile.pendingEarnings]);

  const selectTab = useCallback(
    (next: DashboardTabId) => {
      if (tabRef.current !== next) {
        tabRef.current = next;
        requestAnimationFrame(() => {
          void contentControls.start({ opacity: [0, 1], transition: { duration: 0.15, ease: "easeOut" } });
        });
      }
      setActiveTab(next);
      setVisited((current) => {
        const panel = panelOf(next);
        if (current.has(panel)) return current;
        const nextVisited = new Set(current);
        nextVisited.add(panel);
        return nextVisited;
      });
      writeTab(next, pathname);
    },
    [contentControls, pathname],
  );

  useEffect(() => {
    function onPopState() {
      const url = new URL(window.location.href);
      const tab: DashboardTabId = url.pathname.endsWith("/tokens")
        ? "tokens"
        : url.pathname.endsWith("/payments")
          ? url.searchParams.get("tab") === "topup"
            ? "tokens"
            : "payments"
          : url.pathname.endsWith("/applications")
            ? "applied"
            : tabFrom(url.searchParams.get("tab"));
      tabRef.current = tab;
      setActiveTab(tab);
      setVisited((current) => {
        const panel = panelOf(tab);
        if (current.has(panel)) return current;
        const nextVisited = new Set(current);
        nextVisited.add(panel);
        return nextVisited;
      });
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const activeProjects = useMemo(
    () => applications.filter((item) => isActiveStatus(item.status)),
    [applications],
  );
  const appliedProjects = useMemo<WorkerApplication[]>(() => {
    if (platformApplications.length === 0) return applications;
    return platformApplications.map((item) => ({
      id: item.id,
      jobId: item.jobId,
      jobTitle: item.jobTitle,
      company: "flexwork-usa",
      tokenCost: item.tokensStaked,
      status: item.status,
      appliedAt: item.submittedAt,
    }));
  }, [applications, platformApplications]);

  const markApplied = useCallback(
    (jobId: string, tokenBalance?: number) => {
      setAppliedIds((current) => new Set(current).add(jobId));
      if (typeof tokenBalance === "number") setBalance(tokenBalance);
      router.refresh();
    },
    [router],
  );

  const availablePayout = Math.max(0, pendingBalance);
  const payoutProfile = { ...profile, pendingEarnings: pendingBalance };
  const openTopUp = useCallback(() => {
    setSelectedPlan(null);
    setSelectedNetwork("USDT (TRC-20)");
    selectTab("tokens");
  }, [selectTab]);
  const openPlan = useCallback((plan: TokenPurchasePlan, network: WalletType = "USDT (TRC-20)") => {
    setSelectedPlan(plan);
    setSelectedNetwork(network);
    setResumeDeposit(null);
    setDepositModalOpen(true);
  }, []);
  const completeTransaction = useCallback((deposit: TreasuryDeposit) => {
    setSelectedPlan(null);
    setResumeDeposit(deposit);
    setSelectedNetwork(walletTypeFromNetwork(deposit.network));
    setDepositModalOpen(true);
  }, []);
  const requestPayout = useCallback(() => {
    if (availablePayout < MIN_PAYOUT_USD) {
      setPayoutNotice("Minimum payout threshold is $50.00.");
      setPayoutModalOpen(false);
      return;
    }
    setPayoutNotice(null);
    setPayoutModalOpen(true);
  }, [availablePayout]);
  const panel = panelOf(activeTab);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="sticky top-0 z-40 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <BrandLogo imageClassName="h-11 w-auto" />
          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium">
              <Zap className="h-4 w-4 text-[#C85A17]" aria-hidden />
              {balance} Tokens
            </span>
            <button type="button" className={orangeButton} onClick={openTopUp}>
              Top up
            </button>
            <SignOutButton className={quietButton} />
          </div>
        </div>
        <nav className="mx-auto hidden max-w-7xl gap-1 overflow-x-auto px-4 md:flex" aria-label="Dashboard">
          {TABS.map((item) => {
            const Icon = item.icon;
            const selected = panel === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm ${
                  selected
                    ? "border-[#C85A17] font-semibold text-[#C85A17]"
                    : "border-transparent text-slate-600 hover:text-slate-900"
                }`}
                onClick={() => selectTab(item.id)}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {item.label}
              </button>
            );
          })}
        </nav>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 md:hidden" aria-label="Primary">
          {MOBILE_TOP_TABS.map((item) => {
            const Icon = item.icon;
            const selected = panel === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`inline-flex shrink-0 items-center gap-1.5 border-b-2 px-2.5 py-2.5 text-xs ${
                  selected
                    ? "border-[#C85A17] font-semibold text-[#C85A17]"
                    : "border-transparent text-slate-600 hover:text-slate-900"
                }`}
                onClick={() => selectTab(item.id)}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-6 pb-24 md:pb-6">
        {restricted ? (
          <Card className="mb-4 border-amber-200 bg-amber-50 text-sm text-amber-950">
            Your account is {profile.status === "banned" ? "banned" : profile.status === "under_review" ? "under review" : "suspended"}.
            Jobs and Active Projects stay locked until support restores access.
          </Card>
        ) : null}
        <AnimatePresence initial={false}>
          <motion.div key="dashboard-panels" initial={{ opacity: 1 }} animate={contentControls}>
            {visited.has("overview") ? (
              <div hidden={panel !== "overview"} className="space-y-4">
                <OverviewTab
                  fullName={profile.fullName}
                  balance={balance}
                  onTopUp={openTopUp}
                  onRequestPayout={requestPayout}
                  payoutNotice={payoutNotice}
                  totalEarnings={profile.totalEarnings}
                  pendingEarnings={pendingBalance}
                  earnedThisMonth={profile.earnedThisMonth}
                />
                <WorkerAnalytics
                  earnings={analyticsEarnings}
                  payouts={payouts}
                  pendingEarnings={pendingBalance}
                  earnedThisMonth={profile.earnedThisMonth}
                  totalEarnings={profile.totalEarnings}
                />
                <LeaderboardWidget entries={leaderboard} />
              </div>
            ) : null}
            {visited.has("jobs") ? (
              <div hidden={panel !== "jobs"}>
                {restricted ? (
                  <Card className="border-amber-200 bg-amber-50 text-sm text-amber-950">
                    Jobs are locked while your account is restricted. Contact support to restore access.
                  </Card>
                ) : (
                  <JobsTab
                    jobs={jobs}
                    error={jobsError}
                    appliedIds={appliedIds}
                    pendingJob={pendingJob}
                    applyError={applyError}
                    applicant={{
                      fullName: profile.fullName,
                      email: profile.email,
                      country: profile.country,
                      tokenBalance: balance,
                    }}
                    onNeedSignIn={() => router.push("/login")}
                    onApplied={markApplied}
                  />
                )}
              </div>
            ) : null}
            {visited.has("active") ? (
              <div hidden={panel !== "active"}>
                <ActiveTab
                  projects={activeProjects}
                  error={applicationsError}
                  restricted={restricted}
                  activeProjects={workspaceProjects}
                />
              </div>
            ) : null}
            {visited.has("applied") ? (
              <div hidden={panel !== "applied"}>
                <AppliedTab
                  applications={appliedProjects}
                  error={applicationsError}
                  leaderboards={bidLeaderboards}
                  pipeline={analyticsPipeline}
                />
              </div>
            ) : null}
            {visited.has("tokens") ? (
              <div hidden={panel !== "tokens"}>
                <BuyTokensTab onSelectPlan={openPlan} />
              </div>
            ) : null}
            {visited.has("payments") ? (
              <div hidden={panel !== "payments"}>
                <PaymentsTab
                  profile={payoutProfile}
                  deposits={deposits}
                  depositsError={depositsError}
                  onBuyTokens={openTopUp}
                  onCompleteTransaction={completeTransaction}
                  onOpenPayout={requestPayout}
                  payoutNotice={payoutNotice}
                  treasuryDeposits={treasuryDeposits}
                  payouts={payouts}
                />
              </div>
            ) : null}
            {visited.has("settings") ? (
              <div hidden={panel !== "settings"}>
                <SettingsTab profile={{ ...profile, tokenBalance: balance }} />
              </div>
            ) : null}
            {visited.has("support") ? (
              <div hidden={panel !== "support"}>
                <SupportTab />
              </div>
            ) : null}
          </motion.div>
        </AnimatePresence>
      </main>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white md:hidden"
        aria-label="Dashboard"
      >
        <div className="flex justify-around gap-1 px-2 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {MOBILE_BOTTOM_TABS.map((item) => {
            const Icon = item.icon;
            const selected = panel === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`inline-flex min-w-[4.5rem] shrink-0 flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-[11px] leading-tight ${
                  selected ? "font-semibold text-[#C85A17]" : "text-slate-500"
                }`}
                onClick={() => selectTab(item.id)}
              >
                <Icon className="h-5 w-5" aria-hidden />
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>
      {depositModalOpen ? (
        <DepositSessionModal
          open={depositModalOpen}
          initialPlan={selectedPlan}
          initialNetwork={selectedNetwork}
          initialDeposit={resumeDeposit}
          onClose={() => {
            setDepositModalOpen(false);
            setResumeDeposit(null);
          }}
          onChanged={() => router.refresh()}
        />
      ) : null}
      {payoutModalOpen ? (
        <PayoutModal
          open={payoutModalOpen}
          availableEarnings={availablePayout}
          profile={payoutProfile}
          onClose={() => setPayoutModalOpen(false)}
          onChanged={(nextPending) => {
            if (typeof nextPending === "number") setPendingBalance(nextPending);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}
