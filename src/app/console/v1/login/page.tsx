"use client";

import { useState } from "react";
import { AuthPage, authButtonClass, authFieldClass } from "@/components/auth/AuthPage";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { goTo } from "@/lib/auth/session";

export default function ConsoleLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  return (
    <AuthPage
      title="Operations sign in"
      subtitle="Use your admin email and password to open the operations console."
      panelTitle="Admin operations console"
      panelBody="Review deposits, payouts, workers, and onboarding from a dedicated workspace."
      badge="Operations access"
      highlights={[
        "Review deposits, payouts, and worker applications",
        "Approve onboarding and manage worker admins",
        "Keep operations records in one console",
      ]}
      footer={
        <>
          Workers sign in at{" "}
          <a href="/login" className="font-medium text-[#C85A17] hover:text-[#A84810]">
            member login
          </a>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setSubmitting(true);
          setError(null);
          try {
            const supabase = createBrowserSupabaseClient();
            const { data, error: signInError } = await supabase.auth.signInWithPassword({
              email: email.trim(),
              password,
            });

            if (signInError || !data.user) {
              setError("Could not sign in. Check your email and password.");
              return;
            }

            const { data: adminUser } = await supabase
              .from("admin_users")
              .select("role")
              .eq("id", data.user.id)
              .maybeSingle();

            if (!adminUser) {
              await supabase.auth.signOut();
              setError("This account does not have operations access.");
              return;
            }

            if (adminUser.role === "worker_admin") {
              goTo("/worker-admin/dashboard");
              return;
            }

            goTo("/console/v1/x9q7");
          } catch {
            setError("Could not sign in.");
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <label className="block text-sm font-medium text-slate-900" htmlFor="console-email">
          Email
          <input
            id="console-email"
            type="email"
            autoComplete="username"
            required
            className={authFieldClass}
            value={email}
            placeholder="admin@flexwork-usa.com"
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="block text-sm font-medium text-slate-900" htmlFor="console-password">
          Password
          <input
            id="console-password"
            type="password"
            autoComplete="current-password"
            required
            className={authFieldClass}
            value={password}
            placeholder="Enter your password"
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">{error}</p>
        ) : null}
        <button type="submit" className={authButtonClass} disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </AuthPage>
  );
}
