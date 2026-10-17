"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import { INITIAL_APPLICATIONS, INITIAL_JOBS, INITIAL_TOKEN_LOG } from "@/lib/data";
import { externalUrl, WORKER } from "@/lib/format";
import type {
  Application,
  ApplicationStatus,
  Job,
  NewJobInput,
  Role,
  TokenLogEntry,
  View,
} from "@/lib/types";

type State = {
  role: Role;
  view: View;
  tokens: number;
  jobs: Job[];
  applications: Application[];
  tokenLog: TokenLogEntry[];
  tokenModalOpen: boolean;
  applyJobId: string | null;
  notice: string | null;
};

type Action =
  | { type: "select-mode"; role: Role }
  | { type: "set-role"; role: Role }
  | { type: "set-view"; view: View }
  | { type: "open-tokens" }
  | { type: "close-tokens" }
  | { type: "open-apply"; jobId: string }
  | { type: "close-apply" }
  | { type: "buy"; tokens: number; priceLabel: string }
  | {
      type: "apply-free";
      jobId: string;
      applicantName: string;
      applicantEmail: string;
      resumeName: string;
    }
  | { type: "apply-tokens"; jobId: string }
  | { type: "track-partner"; jobId: string }
  | { type: "add-job"; input: NewJobInput }
  | { type: "set-status"; applicationId: string; status: ApplicationStatus }
  | { type: "notify"; message: string }
  | { type: "clear-notice" };

const initialState: State = {
  role: "worker",
  view: "marketplace",
  tokens: 25,
  jobs: INITIAL_JOBS,
  applications: INITIAL_APPLICATIONS,
  tokenLog: INITIAL_TOKEN_LOG,
  tokenModalOpen: false,
  applyJobId: null,
  notice: null,
};

function createApplication(
  job: Job,
  status: ApplicationStatus,
  tokensSpent: number,
  extras?: {
    applicantName?: string;
    applicantEmail?: string;
    resumeName?: string;
  },
): Application {
  return {
    id: crypto.randomUUID(),
    jobId: job.id,
    jobTitle: job.title,
    company: job.company,
    tier: job.tier,
    status,
    appliedAt: new Date().toISOString(),
    applicantName: extras?.applicantName ?? WORKER.name,
    applicantEmail: extras?.applicantEmail ?? WORKER.email,
    tokensSpent,
    resumeName: extras?.resumeName,
    owner: "worker",
  };
}

function workerHasApplied(state: State, jobId: string) {
  return state.applications.some(
    (item) => item.jobId === jobId && item.owner === "worker",
  );
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "select-mode":
      return {
        ...state,
        role: action.role,
        view: action.role === "guest" ? "marketplace" : "dashboard",
      };
    case "set-role":
      return { ...state, role: action.role };
    case "set-view":
      return { ...state, view: action.view };
    case "open-tokens":
      return { ...state, tokenModalOpen: true, applyJobId: null };
    case "close-tokens":
      return { ...state, tokenModalOpen: false };
    case "open-apply":
      return { ...state, applyJobId: action.jobId, tokenModalOpen: false };
    case "close-apply":
      return { ...state, applyJobId: null };
    case "notify":
      return { ...state, notice: action.message };
    case "clear-notice":
      return { ...state, notice: null };
    case "buy": {
      if (state.role !== "worker") {
        return {
          ...state,
          notice: "Switch to Worker View before buying tokens.",
        };
      }
      const tokens = state.tokens + action.tokens;
      return {
        ...state,
        tokens,
        tokenModalOpen: false,
        notice: `Added ${action.tokens} tokens. Balance is now ${tokens}.`,
        tokenLog: [
          {
            id: crypto.randomUUID(),
            label: `Purchased ${action.tokens} tokens`,
            detail: action.priceLabel,
            delta: action.tokens,
            balanceAfter: tokens,
            at: new Date().toISOString(),
          },
          ...state.tokenLog,
        ],
      };
    }
    case "apply-free": {
      if (state.role !== "worker") {
        return { ...state, notice: "Switch to Worker View to send an application." };
      }
      const job = state.jobs.find((item) => item.id === action.jobId);
      if (!job) return state;
      if (workerHasApplied(state, job.id)) {
        return { ...state, applyJobId: null, notice: "You already applied to this role." };
      }
      return {
        ...state,
        applications: [
          createApplication(job, "Applied", 0, {
            applicantName: action.applicantName,
            applicantEmail: action.applicantEmail,
            resumeName: action.resumeName,
          }),
          ...state.applications,
        ],
        notice: `Application filed for ${job.title}.`,
      };
    }
    case "apply-tokens": {
      if (state.role !== "worker") {
        return {
          ...state,
          notice: "Switch to Worker View to spend tokens on this role.",
        };
      }
      const job = state.jobs.find((item) => item.id === action.jobId);
      if (!job) return state;
      if (workerHasApplied(state, job.id)) return state;
      if (state.tokens < job.tokenCost) {
        return {
          ...state,
          tokenModalOpen: true,
          notice: `You need ${job.tokenCost} tokens. You have ${state.tokens}.`,
        };
      }
      const tokens = state.tokens - job.tokenCost;
      const application = createApplication(job, "Applied", job.tokenCost);
      return {
        ...state,
        tokens,
        applications: [application, ...state.applications],
        notice: `Applied to ${job.title}. ${job.tokenCost} tokens used.`,
        tokenLog: [
          {
            id: crypto.randomUUID(),
            label: `Applied to ${job.title}`,
            detail: job.company,
            delta: -job.tokenCost,
            balanceAfter: tokens,
            at: application.appliedAt,
          },
          ...state.tokenLog,
        ],
      };
    }
    case "track-partner": {
      if (state.role !== "worker") {
        return {
          ...state,
          notice: "Switch to Worker View to track this application.",
        };
      }
      const job = state.jobs.find((item) => item.id === action.jobId);
      if (!job) return state;
      if (workerHasApplied(state, job.id)) {
        return { ...state, notice: "This platform application is already tracked." };
      }
      return {
        ...state,
        applications: [
          createApplication(job, "Applied", 0),
          ...state.applications,
        ],
        notice: `${job.company} added to My Applications.`,
      };
    }
    case "add-job": {
      const input = action.input;
      const job: Job = {
        id: crypto.randomUUID(),
        title: input.title,
        company: input.company,
        tier: input.tier,
        summary:
          input.summary.trim() ||
          `${input.title.trim()} at ${input.company.trim()}. Remote role posted from the admin desk.`,
        pay: input.pay,
        tokenCost: input.tier === 2 ? input.tokenCost : 0,
        category:
          input.tier === 1
            ? "Operations"
            : input.tier === 2
              ? "Client work"
              : "Partner platform",
        location: "Remote — United States",
        schedule: "Flexible",
        platform: input.tier === 3 ? input.platform : undefined,
        platformUrl: input.tier === 3 ? externalUrl(input.platformUrl) : undefined,
        origin: "admin",
      };
      return {
        ...state,
        jobs: [job, ...state.jobs],
        notice: `${job.title} is live on the marketplace.`,
      };
    }
    case "set-status":
      return {
        ...state,
        applications: state.applications.map((item) =>
          item.id === action.applicationId
            ? { ...item, status: action.status }
            : item,
        ),
      };
    default:
      return state;
  }
}

type AppContextValue = State & {
  applyJob: Job | null;
  selectMode: (role: Role) => void;
  setRole: (role: Role) => void;
  setView: (view: View) => void;
  openTokenModal: () => void;
  closeTokenModal: () => void;
  openApplyModal: (jobId: string) => void;
  closeApplyModal: () => void;
  buyTokens: (tokens: number, priceLabel: string) => void;
  submitApplication: (input: {
    jobId: string;
    applicantName: string;
    applicantEmail: string;
    resumeName: string;
  }) => void;
  applyWithTokens: (jobId: string) => void;
  trackPartnerApplication: (jobId: string) => void;
  addJob: (input: NewJobInput) => void;
  setApplicationStatus: (applicationId: string, status: ApplicationStatus) => void;
  notify: (message: string) => void;
  clearNotice: () => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    if (!state.notice) return;
    const id = window.setTimeout(() => dispatch({ type: "clear-notice" }), 3200);
    return () => window.clearTimeout(id);
  }, [state.notice]);

  useEffect(() => {
    if (!state.tokenModalOpen && !state.applyJobId) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [state.tokenModalOpen, state.applyJobId]);

  const value = useMemo<AppContextValue>(() => {
    return {
      ...state,
      applyJob: state.jobs.find((job) => job.id === state.applyJobId) ?? null,
      selectMode: (role) => dispatch({ type: "select-mode", role }),
      setRole: (role) => dispatch({ type: "set-role", role }),
      setView: (view) => dispatch({ type: "set-view", view }),
      openTokenModal: () => dispatch({ type: "open-tokens" }),
      closeTokenModal: () => dispatch({ type: "close-tokens" }),
      openApplyModal: (jobId) => dispatch({ type: "open-apply", jobId }),
      closeApplyModal: () => dispatch({ type: "close-apply" }),
      buyTokens: (tokens, priceLabel) =>
        dispatch({ type: "buy", tokens, priceLabel }),
      submitApplication: (input) => dispatch({ type: "apply-free", ...input }),
      applyWithTokens: (jobId) => dispatch({ type: "apply-tokens", jobId }),
      trackPartnerApplication: (jobId) =>
        dispatch({ type: "track-partner", jobId }),
      addJob: (input) => dispatch({ type: "add-job", input }),
      setApplicationStatus: (applicationId, status) =>
        dispatch({ type: "set-status", applicationId, status }),
      notify: (message) => dispatch({ type: "notify", message }),
      clearNotice: () => dispatch({ type: "clear-notice" }),
    };
  }, [state]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within AppProvider");
  }
  return context;
}
