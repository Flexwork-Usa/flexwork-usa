import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import Constants from "expo-constants";

const extra = Constants.expoConfig?.extra as
  | { supabaseUrl?: string; supabaseAnonKey?: string }
  | undefined;

const supabaseUrl = extra?.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = extra?.supabaseAnonKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY for admin-mobile.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export async function requireAdminUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, error: "Access restricted to platform administrators" };

  const { data, error } = await supabase.from("admin_users").select("id, email").eq("id", user.id).maybeSingle();
  if (error || !data) {
    await supabase.auth.signOut();
    return { user: null, error: "Access restricted to platform administrators" };
  }
  return { user, error: null };
}

export async function signOutAdmin() {
  await supabase.auth.signOut();
}
