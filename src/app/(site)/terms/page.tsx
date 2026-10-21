export const metadata = { title: "Terms of Service · flexwork-usa" };

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Terms of Service</h1>
      <div className="mt-6 space-y-6 text-sm leading-7 text-slate-600">
        <section>
          <h2 className="text-base font-semibold text-slate-900">Accounts & tokens</h2>
          <p className="mt-2">
            Accounts are created after an application is approved. New workers receive a 50-token signup bonus.
            Token top-ups are crypto-only through 15-minute sessions using USDT (Tether), USDT (ETH), or USDC (ETH). Affiliate applications stake
            tokens; curated roles may remain free to apply.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-slate-900">Hourly project timer</h2>
          <p className="mt-2">
            Hourly projects use an interactive Start/Pause timer. Elapsed seconds are stored in hourly work logs. Pause
            when you step away. Prolonged idle activity may trigger advisory warnings. If an hourly deadline expires
            with incomplete work, compensation may be prorated to verified active time.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-slate-900">Quota deliverables</h2>
          <p className="mt-2">
            Quota projects require a deliverable submission with a flexible deadline between 1 day and 1 month. Late or
            incomplete deliverables may be rejected or returned for revision.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-slate-900">Payouts</h2>
          <p className="mt-2">
            Workers may request payouts via Crypto, Airtm, or PayPal. The minimum payout is $50. Requests remain pending
            until an administrator approves or rejects them.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-slate-900">Account restrictions</h2>
          <p className="mt-2">
            Banned or temporarily disabled accounts may still sign in to view balances and earnings, but Jobs and Active
            Projects stay locked until support restores access.
          </p>
        </section>
      </div>
    </main>
  );
}
