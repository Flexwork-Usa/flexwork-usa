export type MarketplaceJob = {
  id: string;
  title: string;
  company: string;
  tier: 1 | 2 | 3;
  summary: string;
  pay: string;
  tokenCost: number;
  category: string;
  location: string;
  schedule: string;
  platform: "outlier" | "handshake" | null;
  platformUrl: string | null;
};

export type JobRow = {
  id: string;
  title: string;
  company: string;
  tier: string | number;
  description: string;
  pay_rate: string;
  token_cost: number | null;
  external_url: string | null;
  is_active: boolean | null;
};
