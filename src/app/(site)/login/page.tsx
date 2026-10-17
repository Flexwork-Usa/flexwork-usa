"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { fieldClass, primaryButtonClass } from "@/lib/format";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4 py-12 text-gray-900">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-semibold tracking-tight">Worker login</h1>
        <p className="mt-2 text-sm text-gray-600">Sign in with the email and temporary password from your approval.</p>

        <form
          className="mt-8 space-y-4 rounded-xl border border-gray-200 p-5"
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
                setError(signInError?.message ?? "Could not sign in.");
                return;
              }

              const { data: profile, error: profileError } = await supabase
                .from("profiles")
                .select("is_approved")
                .eq("id", data.user.id)
                .maybeSingle();

              if (profileError) {
                setError(profileError.message);
                return;
              }

              if (!profile?.is_approved) {
                await supabase.auth.signOut();
                setError("Account pending approval or unauthorized.");
                return;
              }

              router.push("/dashboard");
              router.refresh();
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : "Could not sign in.");
            } finally {
              setSubmitting(false);
            }
          }}
        >
          <label className="block text-sm font-medium text-gray-900" htmlFor="email">
            Email
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              className={fieldClass}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="block text-sm font-medium text-gray-900" htmlFor="password">
            Password
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              className={fieldClass}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error ? (
            <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900">
              {error}
            </p>
          ) : null}
          <button type="submit" className={`${primaryButtonClass} w-full`} disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
