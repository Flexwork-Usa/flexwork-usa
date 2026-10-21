export type MarketplaceJob = {
  id: string;
  title: string;
  company: string;
  tier: 1 | 2 | 3;
  summary: string;
  fullDescription: string;
  pay: string;
  tokenCost: number;
  minTokens: number;
  tags: string[];
  category: string;
  categoryId: string | null;
  subcategoryId: string | null;
  location: string;
  schedule: string;
  platform: "outlier" | "handshake" | null;
  platformUrl: string | null;
  slotsNeeded: number;
  applicationCount: number;
  createdAt: string;
  isNew: boolean;
  isHighDemand: boolean;
};

export type JobRow = {
  id: string;
  title: string;
  company?: string | null;
  tier?: string | number | null;
  description?: string | null;
  brief_description?: string | null;
  full_description?: string | null;
  pay_rate: string;
  pay_type?: string | null;
  token_cost?: number | null;
  min_tokens?: number | null;
  tags?: string[] | string | null;
  external_url?: string | null;
  is_active?: boolean | null;
  hiring_status?: string | null;
  slots_needed?: number | null;
  created_at?: string | null;
};

export type ApplicantProfile = {
  fullName: string;
  email: string;
  country: string;
  tokenBalance: number;
};
