"use client";

import { useEffect, useState } from "react";
import { AuthPage, authButtonClass, authFieldClass } from "@/components/auth/AuthPage";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { goTo, resolveWorkerHome } from "@/lib/auth/session";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void resolveWorkerHome().then((home) => {
      if (home !== "/login") goTo(home);
    });
  }, []);

  async function onSubmit(event: React.FormEvent) {
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
        setError(signInError?.message ?? "Could not sign in. Check your email and password.");
        return;
      }
      const home = await resolveWorkerHome();
      goTo(home);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not sign in.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthPage
      title="Welcome back"
      subtitle="Sign in with the email and password from your approval message."
      panelTitle="Your remote work, in one place."
      panelBody="Jobs, tokens, payouts, and active projects stay in your dashboard after you sign in."
      footer={
        <>
          New here?{" "}
          <a href="/onboard" className="font-medium text-[#C85A17] hover:text-[#A84810]">
            Apply to join
          </a>
        </>
      }
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        <label className="block text-sm font-medium text-slate-900" htmlFor="email">
          Email
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            className={authFieldClass}
            value={email}
            placeholder="you@email.com"
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="block text-sm font-medium text-slate-900" htmlFor="password">
          Password
          <input
            id="password"
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
