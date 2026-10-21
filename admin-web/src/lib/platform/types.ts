export type WorkerStatus = "active" | "under_review" | "temp_disabled" | "suspended" | "banned";

export type AdminRole = "super_admin" | "admin" | "worker_admin";

export type PayoutMethod = "crypto" | "airtm" | "paypal";

export type PayoutStatus = "pending" | "approved" | "rejected";

export type TreasuryNetwork = "TRC20" | "ERC20" | "BEP20";

export type TreasuryDepositStatus = "waiting" | "pending" | "finished" | "rejected" | "expired";

export type JobHiringStatus = "hiring" | "paused" | "closed";

export type ApplicationStatus = "submitted" | "viewed" | "under_review" | "hired" | "rejected";

export type TreasuryAddress = {
  id: string;
  network: TreasuryNetwork;
  address: string;
  isActive: boolean;
};

export type TreasuryDeposit = {
  id: string;
  workerId: string;
  usdtAmount: number;
  tokensIssued: number;
  depositAddress: string;
  memoCode: string;
  txHash: string | null;
  status: TreasuryDepositStatus;
  expiresAt: string;
  createdAt: string;
  network?: TreasuryNetwork;
};

export type PlatformApplication = {
  id: string;
  jobId: string;
  jobTitle: string;
  workerId: string;
  tokensStaked: number;
  status: ApplicationStatus;
  proofData: string | null;
  submittedAt: string;
  rankPosition: number;
  applicantCount: number;
};

export type LeaderboardEntry = {
  id: string;
  workerName: string;
  emailMasked: string;
  country: string;
  skill: string;
  totalEarnings: number;
  rankOrder: number;
};

export type ManagedJob = {
  id: string;
  title: string;
  company: string;
  category: string;
  description: string;
  briefDescription: string;
  fullDescription: string;
  tags: string[];
  minTokens: number;
  payType: "hourly" | "quota";
  payRate: number;
  payLabel: string;
  slotsNeeded: number;
  hiringStatus: JobHiringStatus;
  createdAt: string;
  applicationCount: number;
  isNew: boolean;
  isHighDemand: boolean;
};

export type ManagedWorker = {
  id: string;
  fullName: string | null;
  email: string | null;
  country: string | null;
  tokenBalance: number;
  status: WorkerStatus;
  jobsApplied: number;
  totalTokensSpent: number;
  totalEarnings: number;
  isWorkerAdmin: boolean;
  tempRecoveryPass: string | null;
};

export type AdminAccount = {
  id: string;
  email: string | null;
  fullName: string | null;
  role: AdminRole;
  status: WorkerStatus;
  tempRecoveryPass: string | null;
  createdAt: string;
  createdBy: string | null;
};

export type WorkerAdminAccount = {
  workerId: string;
  email: string;
  fullName: string;
  status: WorkerStatus;
  tempRecoveryPass: string | null;
  pendingEarnings: number;
  earnedThisMonth: number;
  totalEarnings: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PlatformApplicationRow = {
  id: string;
  jobId: string;
  jobTitle: string;
  workerId: string;
  workerName: string;
  workerEmail: string | null;
  country: string | null;
  coverLetter: string | null;
  cvUrl: string | null;
  portfolioUrl: string | null;
  tokensStaked: number;
  status: ApplicationStatus;
  submittedAt: string;
};

export type PayoutRequest = {
  id: string;
  workerId: string;
  workerName: string;
  workerEmail: string | null;
  method: PayoutMethod;
  address: string;
  amount: number;
  status: PayoutStatus;
  createdAt: string;
};

export type AnalyticsBundle = {
  daily: Array<{ day: string; jobsApplied: number; payouts: number }>;
  funnel: Array<{ status: string; count: number }>;
};
