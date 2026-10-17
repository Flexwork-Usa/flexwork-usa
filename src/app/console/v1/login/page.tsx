"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { fieldClass, primaryButtonClass } from "@/lib/format";

export default function ConsoleLoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4 text-gray-900">
      <form
        className="w-full max-w-sm space-y-3"
        onSubmit={async (event) => {
          event.preventDefault();
          setSubmitting(true);
          setError(null);

          try {
            const supabase = createBrowserSupabaseClient();
            const { data, error: signInError } = await supabase.auth.signInWithPassword({
              email: identifier.trim(),
              password: key,
            });

            if (signInError || !data.user) {
              setError("Unable to authenticate.");
              return;
            }

            const { data: profile } = await supabase
              .from("profiles")
              .select("role, is_approved")
              .eq("id", data.user.id)
              .maybeSingle();

            if (profile?.role !== "admin" || !profile.is_approved) {
              await supabase.auth.signOut();
              router.push("/");
              router.refresh();
              return;
            }

            router.push("/console/v1/x9q7");
            router.refresh();
          } catch {
            setError("Unable to authenticate.");
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <input
          aria-label="Identifier"
          placeholder="Identifier"
          autoComplete="username"
          required
          className={fieldClass}
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
        />
        <input
          aria-label="Key"
          placeholder="Key"
          type="password"
          autoComplete="current-password"
          required
          className={fieldClass}
          value={key}
          onChange={(event) => setKey(event.target.value)}
        />
        {error ? <p className="text-sm text-gray-600">{error}</p> : null}
        <button type="submit" className={`${primaryButtonClass} w-full`} disabled={submitting}>
          {submitting ? "Authenticate" : "Authenticate"}
        </button>
      </form>
    </div>
  );
}
