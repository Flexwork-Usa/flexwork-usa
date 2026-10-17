import { DISCORD_URL } from "@/lib/site";

export const metadata = { title: "Contact · flexwork-usa" };

export default function ContactPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Contact</h1>
      <p className="mt-4 text-sm leading-6 text-slate-600">
        New workers start with an onboarding application. Approved members can use the community channel for
        assessment questions.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <a href="/onboard" className="inline-flex items-center justify-center rounded-lg bg-[#C85A17] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#A84810]">
          Apply to Join
        </a>
        <a href={DISCORD_URL} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-50">
          Community
        </a>
      </div>
    </main>
  );
}
