export type WorkerApplication = {
  id: string;
  jobId: string | null;
  jobTitle: string;
  company: string | null;
  tokenCost: number;
  status: string;
  appliedAt: string;
};

export type WorkerProfileView = {
  fullName: string;
  email: string;
  phone: string;
  tokenBalance: number;
  status: string;
  totalEarnings: number;
  pendingEarnings: number;
  earnedThisMonth: number;
  isWorkerAdmin: boolean;
  walletUsdtTron: string | null;
  walletUsdtEth: string | null;
  walletUsdcEth: string | null;
  payoutUsdtAddress: string | null;
  payoutAirtmEmail: string | null;
  payoutPaypalEmail: string | null;
  payoutMethod: "crypto" | "airtm" | "paypal" | null;
  country: string;
};

export type WorkerDeposit = {
  id: string;
  planTitle: string;
  amountUsd: number;
  tokens: number;
  walletType: string;
  transactionHash: string;
  status: string;
  createdAt: string;
};

export type DashboardTab =
  | "overview"
  | "jobs"
  | "active"
  | "applied"
  | "tokens"
  | "payments"
  | "settings"
  | "support";

export type DashboardTabId = DashboardTab | "topup";
