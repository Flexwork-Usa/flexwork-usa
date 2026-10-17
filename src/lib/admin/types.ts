export type PendingApplication = {
  id: string;
  fullName: string;
  email: string;
  country: string;
  phoneNumber: string;
  createdAt: string;
};

export type WorkerProfileRow = {
  id: string;
  fullName: string | null;
  email: string | null;
  tokenBalance: number;
  walletUsdtTron: string | null;
  walletUsdtEth: string | null;
  walletUsdcEth: string | null;
};

export type PendingDeposit = {
  id: string;
  userId: string;
  workerName: string;
  amountUsd: number;
  tokens: number;
  walletType: string;
  transactionHash: string;
  createdAt: string;
};

export type InspectorDeposit = {
  id: string;
  amountUsd: number;
  tokens: number;
  walletType: string;
  transactionHash: string;
  status: string;
  createdAt: string;
};

export type InspectorApplication = {
  id: string;
  jobTitle: string;
  tier: number | null;
  tokensSpent: number;
  status: string;
  appliedAt: string;
};

export type WorkerInspectorData = {
  id: string;
  fullName: string;
  email: string;
  country: string;
  phoneNumber: string;
  joinedAt: string | null;
  tokenBalance: number;
  deposits: InspectorDeposit[];
  applications: InspectorApplication[];
};
