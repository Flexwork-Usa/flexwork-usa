export const metadata = { title: "FAQ · flexwork-usa" };

const FAQS = [
  {
    q: "How do I buy tokens?",
    a: "Choose a token plan, then send USDT (Tether), USDT (ETH), or USDC (ETH) during the 15-minute payment window. Include the payment reference and submit your TXID when you have sent the funds.",
  },
  {
    q: "How does the hourly timer work?",
    a: "Open Launch Task on an active project, then Start or Pause the timer. Pause during breaks. Idle warnings appear after about five minutes without activity.",
  },
  {
    q: "What happens if an hourly deadline expires?",
    a: "Verified active time may be prorated. Time spent idle after warnings may not count toward full compensation.",
  },
  {
    q: "How do quota projects work?",
    a: "Submit your deliverable with a deadline between 1 day and 1 month. Earnings are confirmed after the work is reviewed.",
  },
  {
    q: "What is the payout minimum?",
    a: "Payouts require at least $50 and can be sent via Crypto, Airtm, or PayPal after they are confirmed.",
  },
  {
    q: "Why can’t I open Jobs?",
    a: "Banned or temporarily disabled accounts can view balance and earnings but cannot access Opportunities or Active Projects until support unlocks the account.",
  },
] as const;

export default function FaqPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900">FAQ</h1>
      <p className="mt-3 text-sm text-slate-600">Hourly rules, payout thresholds, and account restrictions.</p>
      <div className="mt-8 divide-y divide-slate-200 border-y border-slate-200">
        {FAQS.map((item) => (
          <div key={item.q} className="py-5">
            <h2 className="text-base font-semibold text-slate-900">{item.q}</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">{item.a}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
