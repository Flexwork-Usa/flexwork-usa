"use client";

import { useState } from "react";
import { submitOnboardingApplication } from "@/actions/onboarding-actions";
import { fieldClass, primaryButtonClass } from "@/lib/format";

export default function OnboardPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <main className="mx-auto w-full max-w-lg px-4 py-12 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">Request access</h1>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          Tell us who you are. An administrator reviews every application before an account is created.
        </p>

        {submitted ? (
          <p className="mt-8 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm leading-6 text-gray-900">
            Application submitted successfully! An administrator will review your profile and send
            login credentials along with your deposit wallet addresses to your email.
          </p>
        ) : (
          <form
            className="mt-8 space-y-4 rounded-xl border border-gray-200 p-5"
            onSubmit={async (event) => {
              event.preventDefault();
              setSubmitting(true);
              setError(null);
              try {
                const result = await submitOnboardingApplication({
                  fullName,
                  email,
                  country,
                  phoneNumber,
                });
                if (!result.success) {
                  setError(result.error);
                  return;
                }
                setSubmitted(true);
              } catch (caught) {
                setError(caught instanceof Error ? caught.message : "Could not submit the application.");
              } finally {
                setSubmitting(false);
              }
            }}
          >
            <label className="block text-sm font-medium" htmlFor="full-name">
              Full name
              <input
                id="full-name"
                required
                className={fieldClass}
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
              />
            </label>
            <label className="block text-sm font-medium" htmlFor="email">
              Email
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                className={fieldClass}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label className="block text-sm font-medium" htmlFor="country">
              Country
              <input
                id="country"
                required
                className={fieldClass}
                value={country}
                onChange={(event) => setCountry(event.target.value)}
              />
            </label>
            <label className="block text-sm font-medium" htmlFor="phone">
              Phone number
              <input
                id="phone"
                type="tel"
                required
                autoComplete="tel"
                className={fieldClass}
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value)}
              />
            </label>
            {error ? <p className="text-sm text-red-700">{error}</p> : null}
            <button type="submit" className={`${primaryButtonClass} w-full`} disabled={submitting}>
              {submitting ? "Submitting…" : "Submit application"}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
