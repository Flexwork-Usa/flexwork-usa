import { DISCORD_URL } from "@/lib/site";

export const metadata = {
  title: "How To Get Started · flexwork-usa",
};

const steps = [
  {
    title: "Request access",
    body: "Submit the onboarding form with your name, email, country, and phone number. An administrator reviews the application before an account is created.",
  },
  {
    title: "Sign in and fund your balance",
    body: "Approved workers receive login details and deposit addresses. Tokens are $0.20 each. Affiliate jobs require a minimum of 10 tokens.",
  },
  {
    title: "Apply by tier",
    body: "Curated roles are free to apply. Affiliate roles spend tokens. Partner platforms open in a new tab with preparation notes beside the listing.",
  },
];

export default function GetStartedPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900">How To Get Started</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        A short path from application to your first remote assignment.
      </p>
      <ol className="mt-10 space-y-4">
        {steps.map((step, index) => (
          <li key={step.title} className="rounded-xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs font-medium tracking-wide text-[#C85A17] uppercase">Step {index + 1}</p>
            <h2 className="mt-2 text-base font-semibold text-slate-900">{step.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{step.body}</p>
          </li>
        ))}
      </ol>

      <section id="guides" className="mt-12 scroll-mt-24">
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">AI Platform Guides</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Tier 3 listings for Outlier AI and Handshake include a preparation drawer on the opportunities page. Open the
          guide before you leave for the partner site.
        </p>
        <a href="/jobs" className="mt-4 inline-flex text-sm font-medium text-[#C85A17] hover:text-[#A84810]">
          Browse opportunities
        </a>
      </section>

      <section id="cv" className="mt-10 scroll-mt-24">
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">CV Preparation</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Lead with remote work, writing samples, and any annotation or evaluation experience. Keep the file name
          plain, use one page when the role does not ask for more, and match the language of the posting.
        </p>
      </section>

      <section id="kyc" className="mt-10 scroll-mt-24">
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">KYC Instructions</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Partner platforms may ask for a government ID and a matching profile photo. Use the same legal name as your
          flexwork-usa application. Have the document ready before you start an assessment so the session does not
          time out.
        </p>
        <a href={DISCORD_URL} target="_blank" rel="noreferrer" className="mt-4 inline-flex text-sm font-medium text-[#C85A17] hover:text-[#A84810]">
          Ask the community
        </a>
      </section>
    </main>
  );
}
