import { createAdminClient } from "@/lib/supabase/admin";

export async function provisionWorkerProfile(user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }) {
  try {
    const admin = createAdminClient();
    const { data: existing } = await admin.from("profiles").select("id").eq("id", user.id).maybeSingle();
    if (existing?.id) return;

    const metadata = user.user_metadata ?? {};
    const fullName = String(metadata.full_name ?? metadata.name ?? "").trim() || null;
    const country = String(metadata.country ?? "").trim() || null;
    const payload = {
      id: user.id,
      email: user.email?.trim() || "unknown@flexwork.local",
      full_name: fullName,
      country,
      role: "worker",
      status: "active",
      token_balance: 0,
      total_tokens_spent: 0,
      pending_earnings: 0,
      total_earnings: 0,
    };
    const inserted = await admin.from("profiles").upsert(payload);
    if (inserted.error) {
      await admin.from("profiles").upsert({
        id: payload.id,
        email: payload.email,
        full_name: payload.full_name,
        role: "worker",
        status: "active",
      });
    }
  } catch {
    // Login and dashboard still load if profile provisioning cannot run.
  }
}
