import { createServerSupabaseClient } from "@/lib/supabase/server";

export type AccountNav = {
  fullName: string;
  email: string;
  role: "admin" | "worker";
  tokenBalance: number;
};

export async function getAccountNav(): Promise<AccountNav | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("full_name, email, role, token_balance")
    .eq("id", user.id)
    .maybeSingle()
    .returns<{
      full_name: string | null;
      email: string | null;
      role: string | null;
      token_balance: number | null;
    }>();

  if (error) {
    throw new Error(error.message);
  }

  return {
    fullName: data?.full_name || "Account",
    email: data?.email || user.email || "",
    role: data?.role === "admin" ? "admin" : "worker",
    tokenBalance: data?.token_balance ?? 0,
  };
}
