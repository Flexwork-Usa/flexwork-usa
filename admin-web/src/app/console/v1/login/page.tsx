"use client";

import { useState } from "react";
import { confirmAdminSession } from "@/actions/admin-auth-actions";
import { AuthPage, authButtonClass, authFieldClass } from "@/components/admin/AuthPage";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export default function ConsoleLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  return (
    <AuthPage
      title="Operations sign in"
      subtitle="Use your admin email and password to open the records console."
      panelTitle="Admin operations console"
      panelBody="Review deposits, payouts, workers, and onboarding from a dedicated workspace."
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

            const confirmed = await confirmAdminSession();
            if (!confirmed.success) {
              await supabase.auth.signOut();
              setError(confirmed.error);
              return;
            }

            const { data: adminUser } = await supabase
              .from("admin_users")
              .select("role, email")
              .eq("id", data.user.id)
              .maybeSingle();
            const role = adminUser?.role;
            if (role === "worker_admin") {
              await supabase.auth.signOut();
              setError("Worker admins sign in on the worker dashboard at flexwork-usa.");
              return;
            }

            window.location.replace(role === "super_admin" ? "/super-admin" : "/dashboard");
          } catch {
            setError("Could not sign in.");
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <label className="block text-sm font-medium text-slate-900" htmlFor="admin-email">
          Email
          <input
            id="admin-email"
            type="email"
            autoComplete="username"
            required
            className={authFieldClass}
            value={email}
            placeholder="admin@flexwork-usa.com"
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="block text-sm font-medium text-slate-900" htmlFor="admin-password">
          Password
          <input
            id="admin-password"
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
