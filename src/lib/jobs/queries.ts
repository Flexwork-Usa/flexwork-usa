import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { JobRow, MarketplaceJob } from "@/lib/jobs/types";

function asTier(value: string | number): 1 | 2 | 3 {
  const text = String(value).trim().toLowerCase();
  if (text === "2" || text === "affiliate") return 2;
  if (text === "3" || text === "third_party" || text === "third-party") return 3;
  return 1;
}

function partnerFrom(company: string, title: string, externalUrl: string | null) {
  const blob = `${company} ${title} ${externalUrl ?? ""}`.toLowerCase();
  if (blob.includes("outlier")) {
    return {
      platform: "outlier" as const,
      platformUrl: externalUrl || "https://outlier.ai/",
    };
  }
  if (blob.includes("handshake")) {
    return {
      platform: "handshake" as const,
      platformUrl: externalUrl || "https://ai.joinhandshake.com/get-started",
    };
  }
  return { platform: null, platformUrl: externalUrl };
}

export function mapJob(row: JobRow): MarketplaceJob {
  const partner = partnerFrom(row.company, row.title, row.external_url);
  return {
    id: row.id,
    title: row.title,
    company: row.company,
    tier: asTier(row.tier),
    summary: row.description,
    pay: row.pay_rate,
    tokenCost: row.token_cost ?? 0,
    category: row.company,
    location: "Remote — United States",
    schedule: "Flexible",
    platform: partner.platform,
    platformUrl: partner.platformUrl,
  };
}

export async function getActiveJobs(): Promise<MarketplaceJob[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("jobs")
    .select("id, title, company, tier, description, pay_rate, token_cost, external_url, is_active")
    .eq("is_active", true)
    .order("tier", { ascending: true })
    .order("title", { ascending: true })
    .returns<JobRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(mapJob);
}

export async function getMyAppliedJobIds(): Promise<string[]> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("job_applications")
    .select("job_id")
    .eq("user_id", user.id)
    .returns<Array<{ job_id: string | null }>>();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => row.job_id).filter((id): id is string => Boolean(id));
}
