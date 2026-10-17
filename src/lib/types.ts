export type Role = "guest" | "worker" | "admin";

export type View = "marketplace" | "dashboard";

export type JobTier = 1 | 2 | 3;

export type ApplicationStatus = "Applied" | "Under Review";

export type PlatformId = "outlier" | "handshake";

export type Job = {
  id: string;
  title: string;
  company: string;
  tier: JobTier;
  summary: string;
  pay: string;
  tokenCost: number;
  category: string;
  location: string;
  schedule: string;
  platform?: PlatformId;
  platformUrl?: string;
  origin?: "admin";
};

export type Application = {
  id: string;
  jobId: string;
  jobTitle: string;
  company: string;
  tier: JobTier;
  status: ApplicationStatus;
  appliedAt: string;
  applicantName: string;
  applicantEmail: string;
  tokensSpent: number;
  resumeName?: string;
  owner: "worker" | "external";
};

export type TokenLogEntry = {
  id: string;
  label: string;
  detail: string;
  delta: number;
  balanceAfter: number;
  at: string;
};

export type NewJobInput = {
  title: string;
  company: string;
  tier: JobTier;
  tokenCost: number;
  pay: string;
  summary: string;
  platform?: PlatformId;
  platformUrl?: string;
};
