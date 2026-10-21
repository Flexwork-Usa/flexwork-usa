"use client";

import { memo, useState } from "react";
import Link from "next/link";
import { Card, orangeButton } from "@/components/dashboard/ui";
import { DISCORD_URL } from "@/lib/site";

const FAQS = [
  [
    "How do hourly timers work?",
    "Open Launch Task on an active project, then Start or Pause the timer. Pause during breaks. Idle warnings appear after about five minutes.",
  ],
  [
    "How do quota projects work?",
    "Submit your deliverable with a deadline between 1 day and 1 month. Earnings are released after the work is reviewed.",
  ],
  [
    "How do payouts work?",
    "Request Crypto, Airtm, or PayPal payouts from Payments. The minimum is $50. Requests stay pending until they are confirmed.",
  ],
  [
    "Why are Jobs locked?",
    "Banned or temporarily disabled accounts can view balances but cannot open Jobs or Active Projects until support restores access.",
  ],
] as const;

function SupportTab() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-lg font-semibold">Useful tips</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">
          <li>Buy tokens only through the crypto deposit session (USDT Tether, USDT ETH, or USDC ETH).</li>
          <li>Pause the hourly timer during breaks to avoid idle penalties.</li>
          <li>Keep payout destinations accurate across Crypto, Airtm, and PayPal.</li>
        </ul>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link href="/faq" className="font-medium text-[#C85A17] hover:underline">
            Full FAQ
          </Link>
          <Link href="/terms" className="font-medium text-[#C85A17] hover:underline">
            Terms of Service
          </Link>
        </div>
      </Card>
      <Card>
        <h2 className="text-lg font-semibold">FAQs</h2>
        <div className="mt-3 divide-y divide-slate-200">
          {FAQS.map(([question, answer], index) => (
            <div key={question}>
              <button
                type="button"
                className="flex w-full items-center justify-between py-3 text-left text-sm font-medium"
                aria-expanded={open === index}
                onClick={() => setOpen(open === index ? null : index)}
              >
                {question}
                <span className="text-slate-400">{open === index ? "−" : "+"}</span>
              </button>
              {open === index ? <p className="pb-3 text-sm leading-6 text-slate-600">{answer}</p> : null}
            </div>
          ))}
        </div>
      </Card>
      <Card className="bg-orange-50">
        <h2 className="text-lg font-semibold">Discord community</h2>
        <p className="mt-2 text-sm text-slate-600">Join the flexwork-usa channel for support while your account is active.</p>
        <a href={DISCORD_URL} target="_blank" rel="noreferrer" className={`${orangeButton} mt-4`}>
          Join Discord
        </a>
      </Card>
    </div>
  );
}

export default memo(SupportTab);
